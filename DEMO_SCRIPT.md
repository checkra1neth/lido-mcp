# Demo Video Script (2 minutes)

## Setup (0:00 - 0:15)
- Show `claude_desktop_config.json` with lido-mcp server configured
- Terminal: `cd ~/Projects/lido-mcp && npm run build`
- "This is a Lido MCP server that enables AI agents to interact with Lido protocol"

## 1. Check APR (0:15 - 0:25)
Ask Claude: "What's the current Lido staking APR?"
- Shows lido_apr tool call
- Returns current APR and 7-day average

## 2. Check Balance (0:25 - 0:40)
Ask Claude: "What are the stETH and wstETH balances for 0x...?"
- Shows lido_balance tool call
- Returns ETH, stETH, wstETH balances with share info

## 3. Dry Run Stake (0:40 - 1:00)
Ask Claude: "I want to stake 0.1 ETH on Holesky testnet. Do a dry run first."
- Shows lido_stake with dry_run=true
- Returns populated transaction, staking limits, gas estimate
- "dry_run lets you preview every write operation before executing"

## 4. Dry Run Wrap (1:00 - 1:15)
Ask Claude: "Now show me what wrapping that stETH to wstETH would look like"
- Shows lido_wrap with dry_run=true
- Returns conversion preview

## 5. Governance (1:15 - 1:35)
Ask Claude: "Show me the latest Lido governance proposals"
- Shows lido_governance_proposals
- Returns active votes with quorum, phase, voting power

## 6. Skill File (1:35 - 1:50)
- Show lido.skill.md
- "The skill file gives agents context about Lido — when to use stETH vs wstETH, safe patterns, withdrawal queue mechanics"

## 7. Closing (1:50 - 2:00)
- "11 tools, full dry_run support, Zod schemas, TypeScript"
- "Built with Claude Code in a single conversation"
- Show GitHub repo

## Recording Tips
- Use Holesky testnet (LIDO_CHAIN_ID=17000)
- Have RPC URL ready (Alchemy/Infura free tier works)
- Can use any address for read-only operations
- For write dry_run: use any valid address
