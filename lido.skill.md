---
name: lido-protocol
description: Mental model for Lido liquid staking protocol — stETH, wstETH, withdrawal queue, and governance
---

# Lido Protocol — Mental Model for AI Agents

## What is Lido?

Lido is a **liquid staking protocol** for Ethereum. Instead of locking 32 ETH to run a validator, users deposit any amount of ETH into Lido and receive **stETH** — a liquid representation of their staked ETH that earns staking rewards automatically.

## Key Tokens

### stETH (Lido Staked Ether)
- **Rebasing token**: your balance increases ~daily as staking rewards are distributed
- 1 stETH ≈ 1 ETH (soft peg maintained by market)
- Oracle reports trigger rebases (typically once per day, 9 oracles with 5/9 quorum)
- **Internal accounting**: stETH uses a **share-based system** — your actual holding is measured in shares, and your displayed balance = `shares * totalPooledEther / totalShares`
- **1-2 wei rounding**: transfers can lose 1-2 wei due to integer division in share↔balance conversion. Use `transferShares()` instead of `transfer()` when precision matters
- **No Transfer event on rebase**: stETH does NOT emit ERC-20 `Transfer` events during daily rebases — only on explicit transfers. Monitor oracle report events or poll balances directly
- **Not strictly ERC-20**: the only deviation is the missing Transfer event on rebase

### wstETH (Wrapped stETH)
- **Non-rebasing wrapper**: balance stays constant, but each wstETH is worth more stETH over time
- wstETH/stETH exchange rate increases monotonically
- 1 wstETH balance = 1 share (exact mapping, no rounding)
- **Preferred for**: DeFi (Aave, Uniswap, Curve), L2 bridges, any contract that stores balances
- **Safe to use everywhere** — no rebasing edge cases
- Exchange rate: check via `wstETH.stEthPerToken()` or `wstETH.getStETHByWstETH(10**18)`

### When to use which?
| Use case | Token | Why |
|----------|-------|-----|
| Hold in wallet, watch balance grow | stETH | Satisfying to see balance increase |
| Supply to DeFi protocol | wstETH | Avoids rebasing issues |
| Bridge to L2 | wstETH | Only wstETH is bridged; stETH loses rewards if bridged |
| Withdraw from Lido | Either | Both accepted by withdrawal queue |
| Collateral on Aave/Maker | wstETH | Required by these protocols |
| Internal smart contract accounting | shares | Use `getSharesByPooledEth()` / `getPooledEthByShares()` |

## Staking (ETH → stETH)

```
User deposits ETH → Lido pool → Node operators stake it → User gets stETH
```

- No minimum deposit (practically: gas cost makes <0.01 ETH uneconomical)
- **Staking rate limit**: sliding 24-hour window with maximum cap. Check `getCurrentStakeLimit()` >= your amount before staking
- Rate limit regenerates per-block at a parametrized rate
- Staking can be paused by protocol (check `isStakingPaused`)
- Referral address can be passed for tracking (doesn't affect user)
- **ETH → wstETH shortcut**: WstETH contract accepts ETH directly — stakes and wraps atomically

## Wrapping (stETH ↔ wstETH)

- **stETH → wstETH**: requires approval first, then wrap
- **ETH → wstETH**: single atomic transaction (stakes + wraps)
- **wstETH → stETH**: unwrap, no approval needed
- Conversion rate: `wstETH_amount = stETH_amount / stETH_per_wstETH`
- After unwrap, stETH amount may differ from original wrap amount due to rebases that occurred

## Withdrawal Queue

Withdrawing stETH/wstETH back to ETH is **NOT instant**:

1. **Request**: submit stETH/wstETH to the withdrawal queue → receive an NFT (unstETH ERC-721)
2. **Wait**: protocol finalizes your request (typically 1-5 days)
3. **Claim**: once finalized, claim your ETH (NFT is burned)

Important details:
- **Min withdrawal**: 100 wei of stETH
- **Max per request**: 1000 stETH (split larger amounts into multiple requests)
- **Requests are non-cancellable** once placed
- **NFT is transferable**: you can sell/transfer your place in queue before claiming
- Only the current NFT holder can claim
- **Bunker mode**: if activated, withdrawals take longer (rare, indicates protocol stress). Check `isBunkerModeActive()`
- **No rewards during wait**: token holders don't earn rewards while stETH is locked in the queue. Rewards since lock are burned on finalization, distributed to remaining stakers
- **Checkpoint hints**: use `findCheckpointHints()` to reduce gas costs when claiming
- Request variants: standard approval, ERC-2612 permit, wstETH direct, wstETH with permit
- Claim variants: single (`claimWithdrawal`), batch (`claimWithdrawals`), batch to recipient (`claimWithdrawalsTo`)

### Finalization
Happens when:
- Sufficient ETH available in Lido buffer (from new stakes, beacon withdrawals, tips, MEV)
- Adequate timelock elapsed
- `prefinalize()` calculates required ETH and shares to burn
- `finalize()` locks ETH, burns stETH/shares, updates status

## Rewards & APR

- APR typically 3-5% (varies with network conditions)
- Rewards come from: consensus layer rewards + execution layer tips/MEV
- **10% fee** on rewards: split between node operators (5%) and DAO treasury (5%)
- Fee collected via share minting, not additional transfers
- Rebases happen when oracle reports (daily, 9 oracles, 5/9 quorum required)
- **Oracle sanity checks**: max APR hard cap 27% (daily rebase ≤ 27/365 %), max staked drop 5%
- If quorum not reached: oracle skips, cumulative update on next successful report
- stETH is fully auto-compounding after V2 — all withdrawn and MEV rewards restaked

## Governance (Lido DAO)

Lido is governed by **LDO token holders** through Aragon voting:

- **Main phase (48h)**: vote FOR or AGAINST
- **Objection phase (24h)**: can only vote AGAINST
- **Quorum**: 5% of total LDO supply must vote YES
- Voting power is **snapshotted** at vote creation — buying LDO after doesn't help
- **Easy Track**: lightweight process for routine decisions (passes unless 0.5% object within 72h)
- Available on both Mainnet and Holesky testnet

### LDO Token
- **Mainnet**: `0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32`
- **Holesky**: `0x14ae7daeecdf57034f3E9db8564e46Dba8D97344`
- **Gotcha**: LDO `transfer()` and `transferFrom()` return `false` on failure instead of reverting. Always check return values: `require(token.transfer(...), "failed")`

## Safe Patterns

1. **Always use wstETH for DeFi** — rebasing stETH can cause unexpected behavior
2. **Use shares for internal accounting** — call `getSharesByPooledEth()` instead of storing stETH balances
3. **Use `transferShares()`** instead of `transfer()` to avoid 1-2 wei rounding loss
4. **Check staking limits** before large stakes — `getCurrentStakeLimit()`
5. **Use dry_run** before any write operation to preview the result
6. **Never send stETH to contracts** that don't explicitly support rebasing tokens
7. **Split large withdrawals** into chunks ≤ 1000 stETH
8. **Check withdrawal queue status** — bunker mode means longer waits
9. **Verify voting power** before attempting governance votes
10. **Never cache stETH balances** for >24h due to daily rebases
11. **Only bridge wstETH** across chains — bridging stETH prevents reward collection
12. **Permit front-running**: `requestWithdrawalsWithPermit()` can be front-run; implement fallback to standard `requestWithdrawals()` if permit fails
13. **Use exchange rate feeds** (not market price) for LST collateral valuation

## Common Workflows

### "I want to earn yield on my ETH"
1. `lido_stake` — deposit ETH, receive stETH
2. Hold stETH (balance grows daily) or wrap to wstETH for DeFi

### "I want to get my ETH back"
1. `lido_unstake` — submit withdrawal request
2. `lido_withdrawal_status` — monitor progress
3. `lido_claim_withdrawal` — claim ETH once finalized

### "I want to use stETH in DeFi"
1. `lido_wrap` — convert stETH to wstETH
2. Use wstETH in DeFi protocol
3. Later: `lido_unwrap` to get stETH back

### "I want to participate in governance"
1. `lido_governance_proposals` — see active votes
2. `lido_governance_vote` — cast your vote (requires LDO tokens)
