import { type LidoSDK } from "@lidofinance/lido-ethereum-sdk";
import {
  type ToolResponse,
  formatEthAmount,
  formatStethAmount,
  parseEthValue,
  toolError,
  toolSuccess,
  validateAddress,
} from "../utils.js";

export async function handleStake(
  sdk: LidoSDK,
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

    if (args.dry_run) {
      try {
        const populatedTx = await sdk.stake.stakeEthPopulateTx({
          value,
          account,
          referralAddress: args.referral
            ? validateAddress(args.referral)
            : undefined,
        });

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
      } catch (txError) {
        // populateTx may fail due to gas estimation on insufficient balance
        return toolSuccess({
          dryRun: true,
          description: `Would stake ${formatEthAmount(value)} to receive stETH`,
          stakingLimits: {
            currentLimit: formatEthAmount(limits.currentStakeLimit),
            maxLimit: formatEthAmount(limits.maxStakeLimit),
          },
          warning: `Could not populate tx: ${txError instanceof Error ? txError.message : String(txError)}`,
        });
      }
    }

    const tx = await sdk.stake.stakeEth({
      value,
      account,
      referralAddress: args.referral
        ? validateAddress(args.referral)
        : undefined,
      callback: ({ stage }) => {
        if (stage === "sign") {
          console.error("[lido_stake] Waiting for signature...");
        } else if (stage === "receipt") {
          console.error("[lido_stake] Transaction submitted...");
        }
      },
    });

    return toolSuccess({
      dryRun: false,
      transactionHash: tx.hash,
      description: `Successfully staked ${formatEthAmount(value)}`,
      details: {
        stethReceived: tx.result
          ? formatStethAmount(tx.result.stethReceived)
          : "unknown",
        sharesReceived: tx.result
          ? tx.result.sharesReceived.toString()
          : "unknown",
      },
    });
  } catch (error) {
    return toolError(
      error instanceof Error ? error.message : String(error),
    );
  }
}
