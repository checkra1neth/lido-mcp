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

export async function handleWrap(
  sdk: LidoSDK,
  publicClient: PublicClient,
  walletClient: WalletClient | undefined,
  args: {
    amount: string;
    source?: string;
    account: string;
    dry_run?: boolean;
  },
): Promise<ToolResponse> {
  try {
    const value = parseEthValue(args.amount);
    const account = validateAddress(args.account);
    const fromETH = args.source === "ETH";

    const expectedWsteth = await sdk.wrap.convertStethToWsteth(value);

    if (args.dry_run) {
      if (fromETH) {
        const populatedTx = await sdk.wrap.wrapEthPopulateTx({
          value,
          account,
        });
        return toolSuccess({
          dryRun: true,
          description: `Would wrap ${formatEthAmount(value)} → ~${formatWstethAmount(expectedWsteth)}`,
          note: "ETH→wstETH is atomic: stakes ETH and wraps in one transaction",
          transaction: {
            to: populatedTx.to,
            from: populatedTx.from,
            value: populatedTx.value?.toString(),
            data: populatedTx.data,
          },
        });
      }

      const populatedTx = await sdk.wrap.wrapStethPopulateTx({
        value,
        account,
      });
      return toolSuccess({
        dryRun: true,
        description: `Would wrap ${formatStethAmount(value)} → ~${formatWstethAmount(expectedWsteth)}`,
        note: "Requires stETH approval for the wstETH contract first",
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

    if (fromETH) {
      const populatedTx = await sdk.wrap.wrapEthPopulateTx({
        value,
        account,
      });

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
        description: `Wrapped ${formatEthAmount(value)} → wstETH`,
        details: {
          status: receipt.status,
          blockNumber: receipt.blockNumber.toString(),
        },
      });
    }

    // stETH → wstETH: approve then wrap
    const approveTx = await sdk.wrap.approveStethForWrapPopulateTx({
      value,
      account,
    });

    const approveHash = await walletClient.sendTransaction({
      to: approveTx.to as `0x${string}`,
      data: approveTx.data as `0x${string}`,
      account: walletClient.account,
      chain: walletClient.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const wrapTx = await sdk.wrap.wrapStethPopulateTx({
      value,
      account,
    });

    const hash = await walletClient.sendTransaction({
      to: wrapTx.to as `0x${string}`,
      data: wrapTx.data as `0x${string}`,
      account: walletClient.account,
      chain: walletClient.chain,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return toolSuccess({
      dryRun: false,
      transactionHash: hash,
      description: `Wrapped ${formatStethAmount(value)} → wstETH`,
      details: {
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
      },
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export async function handleUnwrap(
  sdk: LidoSDK,
  publicClient: PublicClient,
  walletClient: WalletClient | undefined,
  args: {
    amount: string;
    account: string;
    dry_run?: boolean;
  },
): Promise<ToolResponse> {
  try {
    const value = parseEthValue(args.amount);
    const account = validateAddress(args.account);

    const expectedSteth = await sdk.wrap.convertWstethToSteth(value);

    if (args.dry_run) {
      const populatedTx = await sdk.wrap.unwrapPopulateTx({
        value,
        account,
      });
      return toolSuccess({
        dryRun: true,
        description: `Would unwrap ${formatWstethAmount(value)} → ~${formatStethAmount(expectedSteth)}`,
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

    const populatedTx = await sdk.wrap.unwrapPopulateTx({
      value,
      account,
    });

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
      description: `Unwrapped ${formatWstethAmount(value)} → stETH`,
      details: {
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
      },
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}
