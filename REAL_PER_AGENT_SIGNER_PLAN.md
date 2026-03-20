# Real Per-Agent Signer Implementation Plan

## Goal

Move `Yield Arena` from:

- agent-specific signer metadata
- arena-enforced yield budget
- main-wallet delegated paid entry

to:

- one real Tempo agent account per agent
- one real signer/access key per agent account
- external competition entry executed by that agent signer
- signer spending constrained by arena yield policy

## Current State

Today the repo already has:

- `agentAccounts`
- `agentSigners`
- `competitionWallets`
- vault-side `protocol` and `wallet` allowances
- auto top-up and sweep accounting
- live match orchestration

But real paid entry still executes through the main Tempo wallet path.

That means:

- the arena already knows **which agent should act**
- the arena already knows **how much yield-backed budget is available**
- the arena does **not yet** make the agent account the real external signer

## Target State

For each agent:

1. provision a real Tempo agent account
2. provision a real signer / access key for that account
3. bind signer policy to arena budget policy
4. execute paid competition entry with that signer
5. route prize and refund flows back through the same account

## Implementation Phases

### Phase 1. Make signer state explicit

Status: implement now

- separate `requestedMode` from `effectiveMode`
- track whether real per-agent execution is actually available
- store the current limitation when fallback is used
- sync signer budget policy to the current arena allowance

This turns the signer model from vague metadata into a truthful execution model.

### Phase 2. Replace delegated execution path

Status: next

- replace the current `runTempoRequestJson(...)` join path
- execute `MPP Checkers` paid entry with the agent account signer
- ensure the external competition sees the agent account as payer / player

This is the real cutover point.

### Phase 3. Tie signer spend policy to yield policy

Status: partial now, full later

- today: arena syncs a signer budget policy snapshot
- later: enforce that policy in the real Tempo signer / access key layer

This is what makes “limited by daily yield” literally true.

### Phase 4. Settlement and recovery

Status: later

- receive prize / refund into the agent-side competition wallet
- sweep back to wallet allowance
- preserve signer and entry history across retries / crashes

## What This Repo Can Implement Right Now

Without replacing the external Tempo execution path yet, this repo can already improve:

- signer truthfulness
- execution-path visibility
- budget-policy synchronization
- preflight validation for real signer readiness

That is the safest next step because it narrows the gap between:

- what the UI claims
- what the model records
- what the current execution path can actually do

## What Still Requires Deeper Tempo Integration

These pieces are still blocked on a real agent signer execution path:

- paid `tempo request` using the agent account instead of the main wallet
- external player identity matching the agent account address
- true signer-side spend enforcement instead of arena-side allowance enforcement

## Success Criteria

The implementation is complete only when all of the following are true:

- each agent has a real Tempo account
- each agent has a real usable signer / access key
- external paid entry is executed by that agent signer
- external competitions see the agent account as the real participant
- signer spend is constrained by arena yield policy
