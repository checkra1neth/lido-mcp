import { type LidoSDK } from "@lidofinance/lido-ethereum-sdk";
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
        try {
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
        } catch (txError) {
          // populateTx may fail due to gas estimation (insufficient funds etc.)
          // Return preview without tx details
          return toolSuccess({
            dryRun: true,
            description: `Would wrap ${formatEthAmount(value)} → ~${formatWstethAmount(expectedWsteth)}`,
            note: "ETH→wstETH is atomic: stakes ETH and wraps in one transaction",
            warning: `Could not populate tx: ${txError instanceof Error ? txError.message : String(txError)}`,
          });
        }
      }

      try {
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
      } catch (txError) {
        return toolSuccess({
          dryRun: true,
          description: `Would wrap ${formatStethAmount(value)} → ~${formatWstethAmount(expectedWsteth)}`,
          note: "Requires stETH approval for the wstETH contract first",
          warning: `Could not populate tx: ${txError instanceof Error ? txError.message : String(txError)}`,
        });
      }
    }

    if (fromETH) {
      const tx = await sdk.wrap.wrapEth({
        value,
        account,
        callback: ({ stage }) => {
          if (stage === "sign")
            console.error("[lido_wrap] Waiting for signature...");
        },
      });
      return toolSuccess({
        dryRun: false,
        transactionHash: tx.hash,
        description: `Wrapped ${formatEthAmount(value)} → wstETH`,
        details: {
          stethWrapped: tx.result
            ? formatStethAmount(tx.result.stethWrapped)
            : "unknown",
          wstethReceived: tx.result
            ? formatWstethAmount(tx.result.wstethReceived)
            : "unknown",
        },
      });
    }

    // stETH → wstETH: approve then wrap
    await sdk.wrap.approveStethForWrap({
      value,
      account,
      callback: ({ stage }) => {
        if (stage === "sign")
          console.error("[lido_wrap] Approving stETH spend...");
      },
    });

    const tx = await sdk.wrap.wrapSteth({
      value,
      account,
      callback: ({ stage }) => {
        if (stage === "sign")
          console.error("[lido_wrap] Wrapping stETH...");
      },
    });

    return toolSuccess({
      dryRun: false,
      transactionHash: tx.hash,
      description: `Wrapped ${formatStethAmount(value)} → wstETH`,
      details: {
        stethWrapped: tx.result
          ? formatStethAmount(tx.result.stethWrapped)
          : "unknown",
        wstethReceived: tx.result
          ? formatWstethAmount(tx.result.wstethReceived)
          : "unknown",
      },
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export async function handleUnwrap(
  sdk: LidoSDK,
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

    const tx = await sdk.wrap.unwrap({
      value,
      account,
      callback: ({ stage }) => {
        if (stage === "sign")
          console.error("[lido_unwrap] Waiting for signature...");
      },
    });

    return toolSuccess({
      dryRun: false,
      transactionHash: tx.hash,
      description: `Unwrapped ${formatWstethAmount(value)} → stETH`,
      details: {
        wstethUnwrapped: tx.result
          ? formatWstethAmount(tx.result.wstethUnwrapped)
          : "unknown",
        stethReceived: tx.result
          ? formatStethAmount(tx.result.stethReceived)
          : "unknown",
      },
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}
