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
- Oracle reports trigger rebases (typically once per day)
- **Gotcha**: some smart contracts and DeFi protocols don't handle rebasing tokens correctly. If a contract stores your stETH balance as a fixed number, you'll lose rewards.

### wstETH (Wrapped stETH)
- **Non-rebasing wrapper**: balance stays constant, but each wstETH is worth more stETH over time
- wstETH/stETH exchange rate increases monotonically
- **Preferred for**: DeFi (Aave, Uniswap, Curve), L2 bridges, any contract that stores balances
- **Safe to use everywhere** — no rebasing edge cases

### When to use which?
| Use case | Token | Why |
|----------|-------|-----|
| Hold in wallet, watch balance grow | stETH | Satisfying to see balance increase |
| Supply to DeFi protocol | wstETH | Avoids rebasing issues |
| Bridge to L2 | wstETH | Only wstETH is bridged |
| Withdraw from Lido | Either | Both accepted by withdrawal queue |
| Collateral on Aave/Maker | wstETH | Required by these protocols |

## Staking (ETH → stETH)

```
User deposits ETH → Lido pool → Node operators stake it → User gets stETH
```

- No minimum deposit (practically: gas cost makes <0.01 ETH uneconomical)
- Staking can be paused by protocol (check `isStakingPaused`)
- There's a per-transaction stake limit (check `currentStakeLimit`)
- Referral address can be passed for tracking (doesn't affect user)

## Wrapping (stETH ↔ wstETH)

- **stETH → wstETH**: requires approval first, then wrap
- **ETH → wstETH**: single atomic transaction (stakes + wraps)
- **wstETH → stETH**: unwrap, no approval needed
- Conversion rate: `wstETH_amount = stETH_amount / stETH_per_wstETH`

## Withdrawal Queue

Withdrawing stETH/wstETH back to ETH is **NOT instant**:

1. **Request**: submit stETH/wstETH to the withdrawal queue → receive an NFT
2. **Wait**: protocol finalizes your request (typically 1-5 days)
3. **Claim**: once finalized, claim your ETH

Important details:
- Min withdrawal: ~100 wei stETH
- Max per request: 1000 stETH (split larger amounts)
- **Bunker mode**: if activated, withdrawals take longer (rare, indicates protocol stress)
- NFT is transferable — you can sell your place in queue

## Rewards & APR

- APR typically 3-5% (varies with network conditions)
- Rewards come from: consensus layer rewards + execution layer tips/MEV
- 10% fee on rewards: split between node operators (5%) and DAO treasury (5%)
- Rebases happen when oracle reports (daily)

## Governance (Lido DAO)

Lido is governed by **LDO token holders** through Aragon voting:

- **Main phase (48h)**: vote FOR or AGAINST
- **Objection phase (24h)**: can only vote AGAINST
- **Quorum**: 5% of total LDO supply must vote YES
- Voting power is **snapshotted** at vote creation — buying LDO after doesn't help
- **Easy Track**: lightweight process for routine decisions (passes unless 0.5% object)

## Safe Patterns

1. **Always use wstETH for DeFi** — rebasing stETH can cause unexpected behavior
2. **Check staking limits** before large stakes
3. **Use dry_run** before any write operation to preview the result
4. **Never send stETH to contracts** that don't explicitly support rebasing tokens
5. **Split large withdrawals** into chunks ≤1000 stETH
6. **Check withdrawal queue status** — bunker mode means longer waits
7. **Verify voting power** before attempting governance votes

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
