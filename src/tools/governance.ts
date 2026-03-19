import { type LidoSDK } from "@lidofinance/lido-ethereum-sdk";
import { type PublicClient, type WalletClient } from "viem";
import { VOTING_ABI, type NetworkConfig } from "../config.js";
import {
  type ToolResponse,
  formatLdoAmount,
  formatPercent,
  toolError,
  toolSuccess,
  validateAddress,
} from "../utils.js";

interface VoteInfo {
  id: number;
  open: boolean;
  executed: boolean;
  startDate: string;
  phase: string;
  yea: string;
  nay: string;
  votingPower: string;
  supportRequired: string;
  minQuorum: string;
  participation: string;
  canExecute: boolean;
}

async function fetchVote(
  publicClient: PublicClient,
  networkConfig: NetworkConfig,
  voteId: number,
): Promise<VoteInfo> {
  const result = (await publicClient.readContract({
    address: networkConfig.contracts.voting,
    abi: VOTING_ABI,
    functionName: "getVote",
    args: [BigInt(voteId)],
  })) as readonly [
    boolean,
    boolean,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    string,
    number,
  ];

  const [
    open,
    executed,
    startDate,
    _snapshotBlock,
    supportRequired,
    minAcceptQuorum,
    yea,
    nay,
    votingPower,
    _script,
    phase,
  ] = result;

  const totalVoted = yea + nay;
  const participation =
    votingPower > 0n
      ? ((totalVoted * 10000n) / votingPower).toString()
      : "0";

  const canExecute = (await publicClient.readContract({
    address: networkConfig.contracts.voting,
    abi: VOTING_ABI,
    functionName: "canExecute",
    args: [BigInt(voteId)],
  })) as boolean;

  return {
    id: voteId,
    open,
    executed,
    startDate: new Date(Number(startDate) * 1000).toISOString(),
    phase: phase === 0 ? "Main (48h)" : "Objection (24h)",
    yea: formatLdoAmount(yea),
    nay: formatLdoAmount(nay),
    votingPower: formatLdoAmount(votingPower),
    supportRequired: formatPercent(supportRequired),
    minQuorum: formatPercent(minAcceptQuorum),
    participation: `${(Number(participation) / 100).toFixed(2)}%`,
    canExecute,
  };
}

export async function handleGovernanceProposals(
  _sdk: LidoSDK,
  publicClient: PublicClient,
  networkConfig: NetworkConfig,
  args: {
    count?: number;
    active_only?: boolean;
  },
): Promise<ToolResponse> {
  try {
    const totalVotes = (await publicClient.readContract({
      address: networkConfig.contracts.voting,
      abi: VOTING_ABI,
      functionName: "votesLength",
    })) as bigint;

    const count = Math.min(args.count || 10, 50);
    const start =
      totalVotes > BigInt(count) ? Number(totalVotes) - count : 0;

    const votes: VoteInfo[] = [];
    for (let i = Number(totalVotes) - 1; i >= start; i--) {
      const vote = await fetchVote(publicClient, networkConfig, i);
      if (args.active_only && !vote.open) continue;
      votes.push(vote);
    }

    return toolSuccess({
      totalVotesEver: totalVotes.toString(),
      showing: votes.length,
      votes,
      note: "Vote at https://vote.lido.fi/ or use lido_governance_vote tool",
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export async function handleGovernanceVote(
  publicClient: PublicClient,
  walletClient: WalletClient,
  networkConfig: NetworkConfig,
  args: {
    vote_id: number;
    support: boolean;
    account: string;
    dry_run?: boolean;
  },
): Promise<ToolResponse> {
  try {
    const account = validateAddress(args.account);
    const voteId = BigInt(args.vote_id);

    const canVote = (await publicClient.readContract({
      address: networkConfig.contracts.voting,
      abi: VOTING_ABI,
      functionName: "canVote",
      args: [voteId, account],
    })) as boolean;

    if (!canVote) {
      return toolError(
        "Cannot vote: either you have no LDO at the snapshot block, the vote is closed, or you already voted.",
      );
    }

    const voterState = (await publicClient.readContract({
      address: networkConfig.contracts.voting,
      abi: VOTING_ABI,
      functionName: "getVoterState",
      args: [voteId, account],
    })) as number;

    if (voterState !== 0) {
      const stateStr = voterState === 1 ? "FOR" : "AGAINST";
      return toolError(`Already voted ${stateStr} on this proposal.`);
    }

    const voteInfo = await fetchVote(
      publicClient,
      networkConfig,
      args.vote_id,
    );

    if (args.dry_run) {
      return toolSuccess({
        dryRun: true,
        description: `Would vote ${args.support ? "FOR" : "AGAINST"} on proposal #${args.vote_id}`,
        proposal: voteInfo,
        note:
          voteInfo.phase.includes("Objection") && args.support
            ? "WARNING: During objection phase, only AGAINST votes are accepted"
            : undefined,
      });
    }

    const hash = await walletClient.writeContract({
      address: networkConfig.contracts.voting,
      abi: VOTING_ABI,
      functionName: "vote",
      args: [voteId, args.support],
      account,
      chain: networkConfig.chain,
    });

    return toolSuccess({
      dryRun: false,
      transactionHash: hash,
      description: `Voted ${args.support ? "FOR" : "AGAINST"} on proposal #${args.vote_id}`,
      proposal: voteInfo,
    });
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}
