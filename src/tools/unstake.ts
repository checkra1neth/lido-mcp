import { type LidoSDK } from "@lidofinance/lido-ethereum-sdk";
import { type WalletClient, type PublicClient } from "viem";
import {
  type ToolResponse,
  formatEthAmount,
  formatStethAmount,
  formatWstethAmount,
  parseEthValue,
  toolError,
  toolSuccess,
  validateAddress,
} from "../utils.js";

export async function handleUnstake(
  sdk: LidoSDK,
  publicClient: PublicClient,
  walletClient: WalletClient | undefined,
  args: {
    amount: string;
    token?: string;
    account: string;
    dry_run?: boolean;
  },
): Promise<ToolResponse> {
  try {
    const value = parseEthValue(args.amount);
    const account = validateAddress(args.account);
    const token = (args.token || "stETH") as "stETH" | "wstETH";

    const isPaused = await sdk.withdraw.views.isPaused();
    if (isPaused) {
      return toolError("Withdrawal queue is currently paused.");
    }

    const minAmount =
      token === "stETH"
        ? await sdk.withdraw.views.minStethWithdrawalAmount()
        : await sdk.withdraw.views.minWStethWithdrawalAmount();

    if (value < minAmount) {
      const formatter =
        token === "stETH" ? formatStethAmount : formatWstethAmount;
      return toolError(
        `Amount below minimum withdrawal: ${formatter(minAmount)}`,
      );
    }

    const populatedTx =
      await sdk.withdraw.request.requestWithdrawalPopulateTx({
        amount: value,
        token,
        account,
      });

    if (args.dry_run) {
      return toolSuccess({
        dryRun: true,
        description: `Would request withdrawal of ${args.amount} ${token} via Lido queue`,
        note: "Withdrawal is NOT instant. Typically takes 1-5 days to finalize.",
        transaction: {
          to: populatedTx.to,
          from: populatedTx.from,
          data: populatedTx.data,
        },
      });
    }

    if (!walletClient?.account) {
      return toolError(
        "Wallet not configured. Set LIDO_PRIVATE_KEY to enable write operations.",
      );
    }

    // Approve token spend for withdrawal queue
    const approveTx = await sdk.withdraw.approval.approvePopulateTx({
      amount: value,
      token,
      account,
    });

    const approveHash = await walletClient.sendTransaction({
      to: approveTx.to as `0x${string}`,
      data: approveTx.data as `0x${string}`,
      account: walletClient.account,
      chain: walletClient.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    // Submit withdrawal request
    const hash = await walletClient.sendTransaction({
      to: populatedTx.to as `0x${string}`,
      data: populatedTx.data as `0x${string}`,
      account: walletClient.account,
      chain: walletClient.chain,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return toolSuccess({
      dryRun: false,
      transactionHash: hash,
      description: `Withdrawal request submitted for ${args.amount} ${token}`,
      details: {
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        approveHash,
        note: "Use lido_withdrawal_status to track. Use lido_claim_withdrawal once finalized.",
      },
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export async function handleWithdrawalStatus(
  sdk: LidoSDK,
  args: { account: string },
): Promise<ToolResponse> {
  try {
    const account = validateAddress(args.account);

    const [claimableInfo, pendingInfo] = await Promise.all([
      sdk.withdraw.requestsInfo.getClaimableRequestsInfo({ account }),
      sdk.withdraw.requestsInfo.getPendingRequestsInfo({ account }),
    ]);

    const isBunker = await sdk.withdraw.views.isBunkerModeActive();

    return toolSuccess({
      account,
      claimable: {
        count: claimableInfo.claimableRequests.length,
        totalStETH: formatStethAmount(claimableInfo.claimableAmountStETH),
        requests: claimableInfo.claimableRequests.map((r) => ({
          id: r.stringId,
          amountStETH: formatStethAmount(r.amountOfStETH),
          isFinalized: r.isFinalized,
          isClaimed: r.isClaimed,
        })),
      },
      pending: {
        count: pendingInfo.pendingRequests.length,
        totalStETH: formatStethAmount(pendingInfo.pendingAmountStETH),
        requests: pendingInfo.pendingRequests.map((r) => ({
          id: r.stringId,
          amountStETH: formatStethAmount(r.amountOfStETH),
          timestamp: new Date(Number(r.timestamp) * 1000).toISOString(),
        })),
      },
      queueStatus: {
        bunkerMode: isBunker,
        note: isBunker
          ? "Bunker mode active — withdrawals may take longer"
          : "Queue operating normally",
      },
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export async function handleClaimWithdrawal(
  sdk: LidoSDK,
  publicClient: PublicClient,
  walletClient: WalletClient | undefined,
  args: {
    account: string;
    request_ids?: string[];
    dry_run?: boolean;
  },
): Promise<ToolResponse> {
  try {
    const account = validateAddress(args.account);

    const ethInfo =
      await sdk.withdraw.requestsInfo.getClaimableRequestsETHByAccount({
        account,
      });

    if (ethInfo.sortedIds.length === 0) {
      return toolError(
        "No claimable withdrawal requests found. Requests may still be pending.",
      );
    }

    const requestIds = args.request_ids
      ? args.request_ids.map(BigInt)
      : ethInfo.sortedIds;

    if (args.dry_run) {
      return toolSuccess({
        dryRun: true,
        description: `Would claim ${requestIds.length} withdrawal request(s)`,
        claimableETH: formatEthAmount(ethInfo.ethSum),
        requestIds: requestIds.map(String),
      });
    }

    if (!walletClient?.account) {
      return toolError(
        "Wallet not configured. Set LIDO_PRIVATE_KEY to enable write operations.",
      );
    }

    // Use SDK's claim which handles hints calculation internally
    const tx = await sdk.withdraw.claim.claimRequests({
      requestsIds: requestIds,
      hints: ethInfo.hints,
      callback: ({ stage }) => {
        if (stage === "sign") {
          console.error("[lido_claim] Waiting for signature...");
        }
      },
    });

    return toolSuccess({
      dryRun: false,
      transactionHash: tx.hash,
      description: `Claimed ${requestIds.length} withdrawal request(s)`,
      details: {
        ethReceived: formatEthAmount(ethInfo.ethSum),
      },
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}
