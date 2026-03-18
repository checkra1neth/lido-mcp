import { type LidoSDK } from "@lidofinance/lido-ethereum-sdk";
import {
  type ToolResponse,
  formatApr,
  formatEthAmount,
  formatStethAmount,
  formatWstethAmount,
  toolError,
  toolSuccess,
  validateAddress,
} from "../utils.js";

export async function handleBalance(
  sdk: LidoSDK,
  args: { account: string },
): Promise<ToolResponse> {
  try {
    const account = validateAddress(args.account);

    const [ethBalance, stethBalance, wstethBalance, sharesBalance, shareRate] =
      await Promise.all([
        sdk.core.balanceETH(account),
        sdk.steth.balance(account),
        sdk.wsteth.balance(account),
        sdk.shares.balance(account),
        sdk.shares.getShareRate(),
      ]);

    const wstethInSteth =
      wstethBalance > 0n
        ? await sdk.wrap.convertWstethToSteth(wstethBalance)
        : 0n;

    const totalStaked = stethBalance + wstethInSteth;

    return toolSuccess({
      account,
      balances: {
        ETH: formatEthAmount(ethBalance),
        stETH: formatStethAmount(stethBalance),
        wstETH: formatWstethAmount(wstethBalance),
        wstETH_in_stETH: formatStethAmount(wstethInSteth),
      },
      totalStaked: formatStethAmount(totalStaked),
      shares: sharesBalance.toString(),
      shareRate: shareRate.toString(),
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export async function handleRewards(
  sdk: LidoSDK,
  args: {
    account: string;
    from_block?: string;
    to_block?: string;
  },
): Promise<ToolResponse> {
  try {
    const account = validateAddress(args.account);

    const toBlock = args.to_block ? BigInt(args.to_block) : undefined;

    let fromBlock: bigint;
    if (args.from_block) {
      fromBlock = BigInt(args.from_block);
    } else {
      const latestBlock = await sdk.core.rpcProvider.getBlockNumber();
      fromBlock = BigInt(latestBlock) - 216000n;
      if (fromBlock < 0n) fromBlock = 0n;
    }

    const rewards = await sdk.rewards.getRewardsFromChain({
      address: account,
      from: { block: fromBlock },
      to: toBlock ? { block: toBlock } : undefined,
      stepBlock: 50000,
    });

    const rebaseEvents = rewards.rewards.filter(
      (r) => r.type === "rebase",
    );

    return toolSuccess({
      account,
      period: {
        fromBlock: rewards.fromBlock.toString(),
        toBlock: rewards.toBlock.toString(),
      },
      totalRewards: formatStethAmount(rewards.totalRewards),
      baseBalance: formatStethAmount(rewards.baseBalance),
      rebaseCount: rebaseEvents.length,
      recentRebases: rebaseEvents.slice(-5).map((r) => ({
        change: formatStethAmount(r.change),
        apr: r.apr ? formatApr(r.apr) : "N/A",
        shareRate: r.shareRate.toString(),
      })),
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export async function handleApr(sdk: LidoSDK): Promise<ToolResponse> {
  try {
    const [lastApr, smaApr] = await Promise.all([
      sdk.statistics.apr.getLastApr(),
      sdk.statistics.apr.getSmaApr({ days: 7 }),
    ]);

    return toolSuccess({
      currentAPR: formatApr(lastApr),
      sevenDayAvgAPR: formatApr(smaApr),
      description:
        "APR represents the annualized return from staking ETH via Lido. The 7-day SMA smooths out short-term fluctuations.",
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}
