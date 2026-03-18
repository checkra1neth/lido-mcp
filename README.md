# Lido MCP Server

A Model Context Protocol (MCP) server that enables AI agents to interact with the [Lido](https://lido.fi) liquid staking protocol on Ethereum.

## Features

- **Stake ETH** → receive stETH
- **Unstake** → request withdrawals via the withdrawal queue
- **Wrap/Unwrap** → convert between stETH and wstETH
- **Balance & Rewards** → query positions and staking rewards
- **APR** → get current staking yield
- **Governance** → view and vote on Lido DAO proposals
- **Dry Run** — all write operations support simulation mode

## Quick Start

```bash
npm install
npm run build
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LIDO_RPC_URL` | Yes | Ethereum RPC endpoint (Alchemy, Infura, etc.) |
| `LIDO_CHAIN_ID` | No | Chain ID (default: 1 for mainnet, 17000 for Holesky) |
| `LIDO_PRIVATE_KEY` | No | Private key for write operations (read-only without it) |

Aliases `ETH_RPC_URL` and `ETH_PRIVATE_KEY` are also supported.

### Claude Code Integration

Add to your `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lido": {
      "command": "node",
      "args": ["/path/to/lido-mcp/dist/index.js"],
      "env": {
        "LIDO_RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
        "LIDO_CHAIN_ID": "1"
      }
    }
  }
}
```

## Tools

| Tool | Type | Description |
|------|------|-------------|
| `lido_stake` | write | Stake ETH to receive stETH |
| `lido_unstake` | write | Request stETH/wstETH withdrawal |
| `lido_claim_withdrawal` | write | Claim finalized withdrawals |
| `lido_wrap` | write | Wrap stETH → wstETH (or ETH → wstETH) |
| `lido_unwrap` | write | Unwrap wstETH → stETH |
| `lido_balance` | read | Get ETH/stETH/wstETH balances |
| `lido_rewards` | read | Get staking rewards history |
| `lido_apr` | read | Current staking APR |
| `lido_withdrawal_status` | read | Check withdrawal request status |
| `lido_governance_proposals` | read | List governance proposals |
| `lido_governance_vote` | write | Vote on a proposal (requires LDO) |

All write tools accept `dry_run: true` to simulate without executing.

## Architecture

Built with:
- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server framework
- [`@lidofinance/lido-ethereum-sdk`](https://github.com/lidofinance/lido-ethereum-sdk) — Lido protocol interaction
- [`viem`](https://viem.sh) — Ethereum client

## License

MIT
