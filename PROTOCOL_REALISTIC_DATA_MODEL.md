# Protocol-Realistic Data Model

`Yield Arena` 的 realistic 版本把资金分成两层：

- `vaults` 负责资金归属和 allowance
- `competition wallets` 负责真实比赛支付和外部 player identity

核心原则：

- `principal` 留在用户 vault
- `yield` 才能变成可花 allowance
- `competition wallet` 只持有小额 float
- entry 前先 `top-up`
- 比赛完成后再 `sweep`

## Core Objects

### 1. `vaults`

```json
{
  "vaults": {
    "protocol": {
      "label": "Protocol Vault",
      "role": "starter budget",
      "availableAllowance": 0.01,
      "dailyAllowance": 0.01,
      "lifetimeFunded": 0.02
    },
    "wallet": {
      "label": "Wallet Vault",
      "principal": 100,
      "todayYield": 0.08,
      "availableAllowance": 0.07,
      "lifetimeFunded": 0.01,
      "withdrawablePrincipal": 100
    }
  }
}
```

用途：

- `protocol.availableAllowance` 给新 agent 或新 competition 做 starter funding
- `wallet.availableAllowance` 代表用户 yield 中可进入比赛的部分
- `principal` 不会直接转进比赛钱包

### 2. `competitionWallets`

每个 `agent + competition` 有一把专用钱包。

```json
{
  "competitionWallets": {
    "yield-arena-bot:mpp-checkers": {
      "id": "cw-yield-arena-bot-mpp-checkers",
      "agentId": "yield-arena-bot",
      "competitionId": "mpp-checkers",
      "address": "0xabc...",
      "parentWallet": "0xa11ce...",
      "status": "ready",
      "balance": 0.00,
      "fundedTotals": {
        "protocol": 0.01,
        "wallet": 0.02
      },
      "spentTotal": 0.02,
      "sweptTotal": 0.01,
      "lastFundingSource": "wallet",
      "lastFundingAt": "2026-03-19T23:30:00.000Z",
      "lastSpendAt": "2026-03-19T23:31:00.000Z",
      "lastSweepAt": "2026-03-19T23:32:00.000Z"
    }
  }
}
```

用途：

- 作为外部 game 的真实 player identity
- 作为外部支付的执行钱包
- 只保留小额 float，不是资金归属地

### 3. `registrations`

```json
{
  "registrations": {
    "yield-arena-bot": {
      "competitionId": "mpp-checkers",
      "nickname": "yieldArenaBotPersist",
      "address": "0xabc...",
      "createdAt": "2026-03-19T23:29:00.000Z",
      "parentWallet": "0xa11ce..."
    }
  }
}
```

用途：

- 保存外部 competition 的 nickname 和 wallet mapping
- `competitionWallets` 关注资金执行
- `registrations` 关注外部 identity

### 4. `fundingLedger`

统一记录 top-up、entry、sweep。

```json
{
  "fundingLedger": [
    {
      "id": "ledger-topup-1",
      "type": "top_up",
      "source": "protocol",
      "agentId": "yield-arena-bot",
      "competitionId": "mpp-checkers",
      "walletAddress": "0xabc...",
      "amount": 0.01,
      "createdAt": "2026-03-19T23:30:00.000Z"
    },
    {
      "id": "ledger-entry-1",
      "type": "competition_entry",
      "source": "protocol",
      "agentId": "yield-arena-bot",
      "competitionId": "mpp-checkers",
      "walletAddress": "0xabc...",
      "amount": 0.01,
      "createdAt": "2026-03-19T23:31:00.000Z"
    },
    {
      "id": "ledger-sweep-1",
      "type": "sweep",
      "source": "wallet",
      "agentId": "yield-arena-bot",
      "competitionId": "mpp-checkers",
      "walletAddress": "0xabc...",
      "amount": 0.009,
      "createdAt": "2026-03-19T23:32:00.000Z"
    }
  ]
}
```

## Entry Flow

### 1. Provision

- arena 生成 `competition wallet`
- 用它去注册外部 game
- 写入 `registrations`
- 写入 `competitionWallets`

### 2. Preflight

entry 前检查：

- competition 是否 live
- agent 是否已注册
- competition wallet 是否 ready
- wallet balance 是否足够

### 3. Top-Up

如果 `competition wallet.balance < entryPrice`：

- 从选中的 vault allowance 划拨差额
- 增加 `competitionWallet.balance`
- 减少对应 `vault.availableAllowance`
- 写入 `fundingLedger`

### 4. Spend

- competition wallet 支付 entry
- 减少 `competitionWallet.balance`
- 增加 `competitionWallet.spentTotal`
- 写入 `fundingLedger`

### 5. Sweep

比赛结束后：

- prize / refund 先回到 competition wallet
- arena 再把 balance sweep 回 vault-side allowance
- 写入 `fundingLedger`

## MVP-First Implementation Scope

第一版先实现：

- `competitionWallets` 状态
- auto `top-up` on entry
- manual `sweep`
- ledger item 明确区分 `top_up / competition_entry / sweep`

先不实现：

- 真链上转账
- prize 自动监听
- proportional return-to-origin accounting
- per-competition escrow policies
