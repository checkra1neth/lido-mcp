import { type LidoSDK } from "@lidofinance/lido-ethereum-sdk";
import { type WalletClient, type PublicClient } from "viem";
import {
  type ToolResponse,
  formatEthAmount,
  parseEthValue,
  toolError,
  toolSuccess,
  validateAddress,
} from "../utils.js";

export async function handleStake(
  sdk: LidoSDK,
  publicClient: PublicClient,
  walletClient: WalletClient | undefined,
  args: {
    amount: string;
    account: string;
    referral?: string;
    dry_run?: boolean;
  },
): Promise<ToolResponse> {
  try {
    const value = parseEthValue(args.amount);
    const account = validateAddress(args.account);

    const limits = await sdk.stake.getStakeLimitInfo();
    if (limits.isStakingPaused) {
      return toolError("Staking is currently paused on Lido protocol.");
    }
    if (value > limits.currentStakeLimit) {
      return toolError(
        `Amount exceeds current stake limit. Max: ${formatEthAmount(limits.currentStakeLimit)}`,
      );
    }

    // Use SDK to populate tx (gets contract address, encodes calldata)
    const populatedTx = await sdk.stake.stakeEthPopulateTx({
      value,
      account,
      referralAddress: args.referral
        ? validateAddress(args.referral)
        : undefined,
    });

    if (args.dry_run) {
      return toolSuccess({
        dryRun: true,
        description: `Would stake ${formatEthAmount(value)} to receive stETH`,
        transaction: {
          to: populatedTx.to,
          from: populatedTx.from,
          value: populatedTx.value?.toString(),
          data: populatedTx.data,
        },
        stakingLimits: {
          currentLimit: formatEthAmount(limits.currentStakeLimit),
          maxLimit: formatEthAmount(limits.maxStakeLimit),
        },
      });
    }

    if (!walletClient?.account) {
      return toolError(
        "Wallet not configured. Set LIDO_PRIVATE_KEY to enable write operations.",
      );
    }

    // Send via viem — uses proper EIP-1559 fee estimation (eth_maxPriorityFeePerGas)
    // SDK's internal getFeeData uses eth_feeHistory which underestimates on low-activity chains
    const hash = await walletClient.sendTransaction({
      to: populatedTx.to as `0x${string}`,
      data: populatedTx.data as `0x${string}`,
      value: populatedTx.value ?? 0n,
      account: walletClient.account,
      chain: walletClient.chain,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return toolSuccess({
      dryRun: false,
      transactionHash: hash,
      description: `Successfully staked ${formatEthAmount(value)}`,
      details: {
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
      },
    });
  } catch (error) {
    return toolError(
      error instanceof Error ? error.message : String(error),
    );
  }
}
