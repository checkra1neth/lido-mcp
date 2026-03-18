# Lido MCP Server

A Model Context Protocol (MCP) server that enables AI agents to interact with the [Lido](https://lido.fi) liquid staking protocol on Ethereum. Stake ETH, manage stETH/wstETH positions, track rewards, and participate in governance — all through natural language.

![Demo](demo.gif)

## Features

- **Stake ETH** → receive stETH (rebasing liquid staking token)
- **Unstake** → request withdrawals via the withdrawal queue (approve + request in one call)
- **Wrap/Unwrap** → convert between stETH and wstETH (non-rebasing, DeFi-safe)
- **Balance & Rewards** → query positions, shares, and staking rewards history
- **APR** → current staking yield with 7-day SMA (on-chain + Lido API fallback)
- **Governance** → view and vote on Lido DAO Aragon proposals
- **Dry Run** — all write operations support `dry_run: true` simulation mode

## Quick Start

```bash
npm install
npm run build
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LIDO_RPC_URL` | Yes | Ethereum RPC endpoint (Alchemy, Infura, drpc.org, etc.) |
| `LIDO_CHAIN_ID` | No | Chain ID — `1` for mainnet (default), `17000` for Holesky |
| `LIDO_PRIVATE_KEY` | No | Private key for write operations (read-only without it) |

Aliases `ETH_RPC_URL` and `ETH_PRIVATE_KEY` are also supported.

### Claude Code Integration

Add to your `~/.mcp.json` (or project-level `.mcp.json`):

```json
{
  "mcpServers": {
    "lido": {
      "command": "node",
      "args": ["/path/to/lido-mcp/dist/index.js"],
      "env": {
        "LIDO_RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
        "LIDO_CHAIN_ID": "1",
        "LIDO_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

Restart Claude Code after adding the config. The 11 tools will appear as `mcp__lido__lido_*`.

## Tools

| Tool | Type | Description |
|------|------|-------------|
| `lido_stake` | write | Stake ETH to receive stETH |
| `lido_unstake` | write | Request stETH/wstETH withdrawal (handles approve automatically) |
| `lido_claim_withdrawal` | write | Claim finalized withdrawals to receive ETH |
| `lido_wrap` | write | Wrap stETH → wstETH, or ETH → wstETH atomically |
| `lido_unwrap` | write | Unwrap wstETH → stETH |
| `lido_balance` | read | Get ETH/stETH/wstETH balances and share info |
| `lido_rewards` | read | Get staking rewards history by block range |
| `lido_apr` | read | Current staking APR + 7-day moving average |
| `lido_withdrawal_status` | read | Check pending/claimable withdrawal requests |
| `lido_governance_proposals` | read | List Lido DAO Aragon governance votes |
| `lido_governance_vote` | write | Vote on a proposal (requires LDO tokens) |

All write tools accept `dry_run: true` to simulate without executing.

## Architecture

**SDK for data, viem for transactions.** The Lido SDK handles contract addresses, calldata encoding, balance queries, and protocol-specific logic. Write operations use `populateTx` from the SDK, then send via viem's `sendTransaction` which uses proper EIP-1559 fee estimation (`eth_maxPriorityFeePerGas`).

Built with:
- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server framework
- [`@lidofinance/lido-ethereum-sdk`](https://github.com/lidofinance/lido-ethereum-sdk) — Lido protocol interaction (read + tx encoding)
- [`viem`](https://viem.sh) — Ethereum client (signing + sending with proper gas)
- [`zod`](https://zod.dev) — Schema validation for tool inputs

## Tested On

Verified with real transactions on Holesky testnet:

| Operation | Tx |
|-----------|----|
| Stake 0.01 ETH → stETH | `0x0e2074...` |
| Wrap 0.005 ETH → wstETH | `0xe0099e...` |
| Unwrap 0.002 wstETH → stETH | `0x990b25...` |
| Unstake 0.001 stETH (approve + request) | `0xbb23ab...` |
| Withdrawal status check | Request #14418 pending |

## Skill File

The included `lido.skill.md` gives AI agents a mental model of the Lido protocol before they act — rebasing mechanics, wstETH vs stETH tradeoffs, withdrawal queue, governance, and safe patterns.

## License

MIT
