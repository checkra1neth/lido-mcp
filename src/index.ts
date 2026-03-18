#!/usr/bin/env node

// Prevent unhandled rejections from crashing the server
process.on("unhandledRejection", (reason) => {
  console.error("[lido-mcp] Unhandled rejection:", reason);
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LidoSDK } from "@lidofinance/lido-ethereum-sdk";
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

import { getNetworkConfig, type NetworkConfig } from "./config.js";
import { toolError } from "./utils.js";
import { handleStake } from "./tools/stake.js";
import {
  handleUnstake,
  handleWithdrawalStatus,
  handleClaimWithdrawal,
} from "./tools/unstake.js";
import { handleWrap, handleUnwrap } from "./tools/wrap.js";
import { handleBalance, handleRewards, handleApr } from "./tools/balance.js";
import {
  handleGovernanceProposals,
  handleGovernanceVote,
} from "./tools/governance.js";

// Environment configuration
const CHAIN_ID = parseInt(process.env.LIDO_CHAIN_ID || "1", 10);
const RPC_URL = process.env.LIDO_RPC_URL || process.env.ETH_RPC_URL;
const PRIVATE_KEY =
  process.env.LIDO_PRIVATE_KEY || process.env.ETH_PRIVATE_KEY;

if (!RPC_URL) {
  console.error(
    "Error: LIDO_RPC_URL or ETH_RPC_URL environment variable is required",
  );
  process.exit(1);
}

const networkConfig: NetworkConfig = getNetworkConfig(CHAIN_ID);

const publicClient: PublicClient = createPublicClient({
  chain: networkConfig.chain,
  transport: http(RPC_URL),
});

let walletClient: WalletClient | undefined;
if (PRIVATE_KEY) {
  const account = privateKeyToAccount(
    PRIVATE_KEY.startsWith("0x")
      ? (PRIVATE_KEY as `0x${string}`)
      : (`0x${PRIVATE_KEY}` as `0x${string}`),
  );
  walletClient = createWalletClient({
    account,
    chain: networkConfig.chain,
    transport: http(RPC_URL),
  });
}

const sdk = new LidoSDK({
  chainId: CHAIN_ID,
  rpcUrls: [RPC_URL],
  web3Provider: walletClient,
});


// Create MCP server
const server = new McpServer({
  name: "lido-mcp",
  version: "1.0.0",
});

// === READ TOOLS ===

server.tool(
  "lido_balance",
  "Get ETH, stETH, and wstETH balances for an address. Shows both token balances and underlying share information.",
  { account: z.string().describe("Ethereum address to check balances for") },
  async (args) => handleBalance(sdk, args),
);

server.tool(
  "lido_rewards",
  "Get staking rewards information for an address. Shows accumulated rewards from stETH rebasing.",
  {
    account: z.string().describe("Ethereum address to check rewards for"),
    from_block: z
      .string()
      .optional()
      .describe("Block number to start from (default: ~30 days ago)"),
    to_block: z
      .string()
      .optional()
      .describe("Block number to end at (default: latest)"),
  },
  async (args) => handleRewards(sdk, args),
);

server.tool(
  "lido_apr",
  "Get the current Lido staking APR (Annual Percentage Rate). Shows both latest and 7-day moving average.",
  {},
  async () => handleApr(sdk),
);

server.tool(
  "lido_withdrawal_status",
  "Check the status of withdrawal requests for an account. Shows pending, claimable, and claimed withdrawals.",
  {
    account: z
      .string()
      .describe("Ethereum address to check withdrawals for"),
  },
  async (args) => handleWithdrawalStatus(sdk, args),
);

server.tool(
  "lido_governance_proposals",
  "List recent and active Lido DAO governance proposals (Aragon votes). Shows vote status, quorum progress, and phase.",
  {
    count: z
      .number()
      .optional()
      .describe("Number of recent votes to fetch (default: 10, max: 50)"),
    active_only: z
      .boolean()
      .optional()
      .describe("Only show currently active (open) votes"),
  },
  async (args) =>
    handleGovernanceProposals(sdk, publicClient, networkConfig, args),
);

// === WRITE TOOLS ===

server.tool(
  "lido_stake",
  "Stake ETH to receive stETH via Lido protocol. stETH is a rebasing token — balance increases daily. Supports dry_run.",
  {
    amount: z.string().describe('Amount of ETH to stake (e.g., "1.5")'),
    account: z.string().describe("Ethereum address to stake from"),
    referral: z.string().optional().describe("Optional referral address"),
    dry_run: z
      .boolean()
      .optional()
      .describe("Simulate without executing (default: false)"),
  },
  async (args) => handleStake(sdk, publicClient, walletClient, args),
);

server.tool(
  "lido_unstake",
  "Request stETH/wstETH withdrawal via Lido queue. NOT instant — takes 1-5 days. Receive NFT, then claim.",
  {
    amount: z.string().describe("Amount to withdraw"),
    token: z
      .enum(["stETH", "wstETH"])
      .optional()
      .describe("Token to withdraw (default: stETH)"),
    account: z
      .string()
      .describe("Ethereum address requesting withdrawal"),
    dry_run: z.boolean().optional().describe("Simulate without executing"),
  },
  async (args) => handleUnstake(sdk, publicClient, walletClient, args),
);

server.tool(
  "lido_claim_withdrawal",
  "Claim finalized withdrawal requests to receive ETH. Only works for requests that have been finalized.",
  {
    account: z.string().describe("Ethereum address to claim for"),
    request_ids: z
      .array(z.string())
      .optional()
      .describe(
        "Specific request IDs to claim. If omitted, claims all claimable.",
      ),
    dry_run: z.boolean().optional().describe("Simulate without executing"),
  },
  async (args) =>
    handleClaimWithdrawal(sdk, publicClient, walletClient, args),
);

server.tool(
  "lido_wrap",
  "Wrap stETH into wstETH (non-rebasing, DeFi-safe). Can also wrap ETH→wstETH directly in one tx.",
  {
    amount: z.string().describe("Amount to wrap"),
    source: z
      .enum(["stETH", "ETH"])
      .optional()
      .describe("Wrap from stETH (default) or ETH"),
    account: z.string().describe("Ethereum address"),
    dry_run: z.boolean().optional().describe("Simulate without executing"),
  },
  async (args) => handleWrap(sdk, publicClient, walletClient, args),
);

server.tool(
  "lido_unwrap",
  "Unwrap wstETH back to stETH. After unwrapping, balance increases with each oracle report.",
  {
    amount: z.string().describe("Amount of wstETH to unwrap"),
    account: z.string().describe("Ethereum address"),
    dry_run: z.boolean().optional().describe("Simulate without executing"),
  },
  async (args) => handleUnwrap(sdk, publicClient, walletClient, args),
);

server.tool(
  "lido_governance_vote",
  "Vote on a Lido DAO proposal. Requires LDO tokens at the vote's snapshot block. Objection phase: AGAINST only.",
  {
    vote_id: z.number().describe("Vote/proposal ID number"),
    support: z
      .boolean()
      .describe("true = vote FOR, false = vote AGAINST"),
    account: z
      .string()
      .describe("Ethereum address to vote from (must hold LDO)"),
    dry_run: z.boolean().optional().describe("Simulate without executing"),
  },
  async (args) => {
    if (!walletClient) {
      return toolError(
        "Wallet not configured. Set LIDO_PRIVATE_KEY to enable write operations.",
      );
    }
    return handleGovernanceVote(publicClient, walletClient, networkConfig, args);
  },
);

// Start server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Lido MCP Server started on ${networkConfig.name} (chain ${CHAIN_ID})`,
  );
  console.error(`Tools: 11 registered`);
  console.error(`Wallet: ${walletClient ? "configured" : "read-only mode"}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
