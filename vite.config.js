import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, ".data");
const registrationsPath = path.join(dataDir, "registrations.json");
const competitionWalletsPath = path.join(dataDir, "competition-wallets.json");

function createInitialArenaState() {
  const initialLedger = [
    {
      id: "ledger-yield-refresh",
      type: "yield_refresh",
      label: "Daily yield refreshed",
      source: "wallet",
      amount: 0.08,
      createdAt: "2026-03-19T15:00:00.000Z",
    },
    {
      id: "ledger-protocol-start",
      type: "starter_budget",
      label: "Protocol starter budget loaded",
      source: "protocol",
      amount: 0.01,
      createdAt: "2026-03-19T15:01:00.000Z",
    },
  ];

  return {
    mainLoginWallet: {
      label: "Main Arena Login",
      address: "0xa11ce00000000000000000000000000000000001",
    },
    vaults: {
      protocol: {
        key: "protocol",
        label: "Protocol Vault",
        role: "starter budget",
        availableAllowance: 0.01,
        dailyAllowance: 0.01,
        lifetimeFunded: 0,
      },
      wallet: {
        key: "wallet",
        label: "Wallet Vault",
        principal: 100,
        todayYield: 0.08,
        availableAllowance: 0.07,
        lifetimeFunded: 0,
        withdrawablePrincipal: 100,
      },
    },
    principal: 100,
    todayYield: 0.08,
    playBudget: 0.08,
    selectedAgentId: "dragonbot",
    selectedBudgetSource: "protocol",
    selectedCompetitionId: "mpp-checkers",
    agents: [
      {
        id: "dragonbot",
        name: "DragonBot",
        style: "balanced",
        status: "ready",
        wins: 4,
        entries: 6,
        roi: "+18%",
        preferredCompetition: "MPP Checkers",
      },
      {
        id: "scout-v2",
        name: "Scout_V2",
        style: "defensive",
        status: "active",
        wins: 2,
        entries: 4,
        roi: "+6%",
        preferredCompetition: "Private Challenges",
      },
      {
        id: "oracle-prime",
        name: "Oracle_Prime",
        style: "aggressive",
        status: "trial",
        wins: 1,
        entries: 2,
        roi: "-2%",
        preferredCompetition: "Builder Competitions",
      },
    ],
    competitions: [
      {
        id: "mpp-checkers",
        label: "today",
        title: "MPP Checkers",
        status: "live",
        entryPrice: 0.01,
        payout: 0.019,
        refund: 0.009,
        externalUrl: "https://mpp-checkers.com/",
        summary: "Live 1v1 board competition with MPP-priced entry and public scoreboard.",
      },
      {
        id: "private-challenges",
        label: "next",
        title: "Private Challenges",
        status: "next",
        entryPrice: 0.01,
        payout: 0.02,
        refund: 0,
        externalUrl: "",
        summary: "Direct agent-vs-agent rooms funded by wallet yield and settled inside the arena.",
      },
      {
        id: "builder-competitions",
        label: "open",
        title: "Builder Competitions",
        status: "open",
        entryPrice: 0,
        payout: 0,
        refund: 0,
        externalUrl: "",
        summary: "Adapter-based competition slots for new games, tools, and experimental 1v1 formats.",
      },
    ],
    budgetSources: {
      protocol: { key: "protocol", label: "Protocol Budget", available: 0.01 },
      wallet: { key: "wallet", label: "Wallet Budget", available: 0.07 },
    },
    competitionWallets: {},
    fundingLedger: initialLedger,
    budgetLedger: initialLedger,
    registrations: {},
    entryHistory: [],
  };
}

const arenaState = createInitialArenaState();

function loadPersistedRegistrations() {
  if (!existsSync(registrationsPath)) {
    return {};
  }

  try {
    const raw = readFileSync(registrationsPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistRegistrations() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    registrationsPath,
    JSON.stringify(arenaState.registrations, null, 2),
    "utf8",
  );
}

function loadPersistedCompetitionWallets() {
  if (!existsSync(competitionWalletsPath)) {
    return {};
  }

  try {
    const raw = readFileSync(competitionWalletsPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistCompetitionWallets() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    competitionWalletsPath,
    JSON.stringify(arenaState.competitionWallets, null, 2),
    "utf8",
  );
}

function roundMoney(value) {
  return Number(value.toFixed(2));
}

function getCompetitionWalletKey(agentId, competitionId) {
  return `${agentId}:${competitionId}`;
}

function createCompetitionWalletRecord({ agentId, competitionId, address, parentWallet }) {
  return {
    id: `cw-${agentId}-${competitionId}`,
    agentId,
    competitionId,
    address,
    parentWallet,
    status: "ready",
    balance: 0,
    fundedTotals: {
      protocol: 0,
      wallet: 0,
    },
    spentTotal: 0,
    sweptTotal: 0,
    lastFundingSource: null,
    lastFundingAt: null,
    lastSpendAt: null,
    lastSweepAt: null,
  };
}

function syncDerivedArenaState() {
  arenaState.principal = arenaState.vaults.wallet.principal;
  arenaState.todayYield = arenaState.vaults.wallet.todayYield;
  arenaState.budgetSources.protocol.available = arenaState.vaults.protocol.availableAllowance;
  arenaState.budgetSources.wallet.available = arenaState.vaults.wallet.availableAllowance;
  arenaState.playBudget = roundMoney(
    arenaState.vaults.protocol.availableAllowance + arenaState.vaults.wallet.availableAllowance,
  );
  arenaState.budgetLedger = arenaState.fundingLedger;
}

function hydrateCompetitionWalletsFromRegistrations() {
  for (const [agentId, registration] of Object.entries(arenaState.registrations)) {
    const key = getCompetitionWalletKey(agentId, registration.competitionId);
    if (!arenaState.competitionWallets[key]) {
      arenaState.competitionWallets[key] = createCompetitionWalletRecord({
        agentId,
        competitionId: registration.competitionId,
        address: registration.address,
        parentWallet: registration.parentWallet,
      });
    }
  }
}

function addFundingLedgerItem(item) {
  arenaState.fundingLedger.unshift(item);
}

function topUpCompetitionWallet({
  agentId,
  competitionId,
  sourceKey,
  amount,
  label,
}) {
  const walletKey = getCompetitionWalletKey(agentId, competitionId);
  const competitionWallet = arenaState.competitionWallets[walletKey];
  const vault = arenaState.vaults[sourceKey];

  if (!competitionWallet || competitionWallet.status !== "ready") {
    throw new Error("competition wallet is not ready");
  }

  if (!vault) {
    throw new Error("vault not found");
  }

  if (vault.availableAllowance < amount) {
    throw new Error("insufficient budget");
  }

  const now = new Date().toISOString();
  vault.availableAllowance = roundMoney(vault.availableAllowance - amount);
  vault.lifetimeFunded = roundMoney((vault.lifetimeFunded ?? 0) + amount);
  competitionWallet.balance = roundMoney(competitionWallet.balance + amount);
  competitionWallet.fundedTotals[sourceKey] = roundMoney(
    (competitionWallet.fundedTotals[sourceKey] ?? 0) + amount,
  );
  competitionWallet.lastFundingSource = sourceKey;
  competitionWallet.lastFundingAt = now;

  const ledgerItem = {
    id: `ledger-topup-${Date.now()}`,
    type: "top_up",
    label,
    source: sourceKey,
    amount,
    agentId,
    competitionId,
    walletAddress: competitionWallet.address,
    createdAt: now,
  };

  addFundingLedgerItem(ledgerItem);
  syncDerivedArenaState();
  persistCompetitionWallets();

  return {
    competitionWallet,
    ledgerItem,
  };
}

function sweepCompetitionWallet({
  agentId,
  competitionId,
  destinationKey = "wallet",
}) {
  const walletKey = getCompetitionWalletKey(agentId, competitionId);
  const competitionWallet = arenaState.competitionWallets[walletKey];
  const vault = arenaState.vaults[destinationKey];

  if (!competitionWallet || competitionWallet.status !== "ready") {
    throw new Error("competition wallet is not ready");
  }

  if (!vault) {
    throw new Error("vault not found");
  }

  if (competitionWallet.balance <= 0) {
    throw new Error("competition wallet has no balance to sweep");
  }

  const amount = competitionWallet.balance;
  const now = new Date().toISOString();
  competitionWallet.balance = 0;
  competitionWallet.sweptTotal = roundMoney(competitionWallet.sweptTotal + amount);
  competitionWallet.lastSweepAt = now;
  vault.availableAllowance = roundMoney(vault.availableAllowance + amount);

  const ledgerItem = {
    id: `ledger-sweep-${Date.now()}`,
    type: "sweep",
    label: `Swept ${competitionId} wallet back to ${destinationKey}`,
    source: destinationKey,
    amount,
    agentId,
    competitionId,
    walletAddress: competitionWallet.address,
    createdAt: now,
  };

  addFundingLedgerItem(ledgerItem);
  syncDerivedArenaState();
  persistCompetitionWallets();

  return {
    competitionWallet,
    ledgerItem,
  };
}

arenaState.registrations = loadPersistedRegistrations();
arenaState.competitionWallets = loadPersistedCompetitionWallets();
hydrateCompetitionWalletsFromRegistrations();
syncDerivedArenaState();

function resetArenaState() {
  Object.assign(arenaState, createInitialArenaState());
  if (existsSync(registrationsPath)) {
    unlinkSync(registrationsPath);
  }
  if (existsSync(competitionWalletsPath)) {
    unlinkSync(competitionWalletsPath);
  }
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function generateAssociatedWallet() {
  return `0x${randomBytes(20).toString("hex")}`;
}

function arenaDevApi() {
  return {
    name: "arena-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/arena/state", (_req, res) => {
        json(res, 200, arenaState);
      });

      server.middlewares.use("/api/arena/reset", (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        resetArenaState();
        json(res, 200, arenaState);
      });

      server.middlewares.use("/api/arena/select-agent", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const agent = arenaState.agents.find((item) => item.id === body.agentId);
          if (!agent) {
            json(res, 404, { error: "agent not found" });
            return;
          }

          arenaState.selectedAgentId = agent.id;
          json(res, 200, arenaState);
        } catch {
          json(res, 400, { error: "invalid json body" });
        }
      });

      server.middlewares.use("/api/arena/select-budget", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const budget = arenaState.budgetSources[body.budgetSource];
          if (!budget) {
            json(res, 404, { error: "budget source not found" });
            return;
          }

          arenaState.selectedBudgetSource = budget.key;
          json(res, 200, arenaState);
        } catch {
          json(res, 400, { error: "invalid json body" });
        }
      });

      server.middlewares.use("/api/arena/select-competition", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const competition = arenaState.competitions.find(
            (item) => item.id === body.competitionId,
          );
          if (!competition) {
            json(res, 404, { error: "competition not found" });
            return;
          }

          arenaState.selectedCompetitionId = competition.id;
          json(res, 200, arenaState);
        } catch {
          json(res, 400, { error: "invalid json body" });
        }
      });

      server.middlewares.use("/api/arena/register-checkers", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const agentId = body.agentId ?? arenaState.selectedAgentId;
          const agent = arenaState.agents.find((item) => item.id === agentId);
          if (!agent) {
            json(res, 404, { error: "agent not found" });
            return;
          }

          const existing = arenaState.registrations[agent.id];
          if (existing) {
            json(res, 200, {
              registration: existing,
              arenaState,
            });
            return;
          }

          const nickname = body.nickname?.trim() || agent.name;
          const address = generateAssociatedWallet();

          const upstream = await fetch("https://mpp-checkers.com/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nickname,
              address,
            }),
          });

          const payload = await upstream.json().catch(() => ({}));
          if (!upstream.ok) {
            json(res, upstream.status, {
              error: payload?.error ?? "checkers registration failed",
            });
            return;
          }

          const registration = {
            competitionId: "mpp-checkers",
            nickname: payload.player?.nickname ?? nickname,
            address: payload.player?.address ?? address,
            createdAt: payload.player?.created_at ?? new Date().toISOString(),
            parentWallet: arenaState.mainLoginWallet.address,
          };

          arenaState.registrations[agent.id] = registration;
          arenaState.competitionWallets[
            getCompetitionWalletKey(agent.id, registration.competitionId)
          ] = createCompetitionWalletRecord({
            agentId: agent.id,
            competitionId: registration.competitionId,
            address: registration.address,
            parentWallet: registration.parentWallet,
          });
          persistRegistrations();
          persistCompetitionWallets();
          syncDerivedArenaState();

          json(res, 200, {
            registration,
            arenaState,
          });
        } catch {
          json(res, 400, { error: "invalid registration request" });
        }
      });

      server.middlewares.use("/api/arena/top-up", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const agentId = body.agentId ?? arenaState.selectedAgentId;
          const competitionId = body.competitionId ?? arenaState.selectedCompetitionId;
          const sourceKey = body.source ?? arenaState.selectedBudgetSource;
          const competition = arenaState.competitions.find((item) => item.id === competitionId);
          const amount = roundMoney(
            Number(body.amount ?? competition?.entryPrice ?? 0),
          );

          if (!arenaState.registrations[agentId]) {
            json(res, 409, { error: "agent is not registered for this competition" });
            return;
          }

          if (!competition || amount <= 0) {
            json(res, 400, { error: "invalid top-up request" });
            return;
          }

          const result = topUpCompetitionWallet({
            agentId,
            competitionId,
            sourceKey,
            amount,
            label: `Topped up ${competition.title} wallet`,
          });

          json(res, 200, {
            topUp: result.ledgerItem,
            competitionWallet: result.competitionWallet,
            arenaState,
          });
        } catch (error) {
          json(res, 409, { error: error.message || "top-up failed" });
        }
      });

      server.middlewares.use("/api/arena/sweep", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const agentId = body.agentId ?? arenaState.selectedAgentId;
          const competitionId = body.competitionId ?? arenaState.selectedCompetitionId;
          const destinationKey = body.destination ?? "wallet";

          const result = sweepCompetitionWallet({
            agentId,
            competitionId,
            destinationKey,
          });

          json(res, 200, {
            sweep: result.ledgerItem,
            competitionWallet: result.competitionWallet,
            arenaState,
          });
        } catch (error) {
          json(res, 409, { error: error.message || "sweep failed" });
        }
      });

      server.middlewares.use("/api/arena/enter", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const competitionId = body.competitionId ?? arenaState.selectedCompetitionId;
          const budget = arenaState.budgetSources[arenaState.selectedBudgetSource];
          const agent = arenaState.agents.find(
            (item) => item.id === arenaState.selectedAgentId,
          );
          const registration = arenaState.registrations[arenaState.selectedAgentId];
          const competition = arenaState.competitions.find(
            (item) => item.id === competitionId,
          );

          if (!budget || !agent || !competition) {
            json(res, 400, { error: "arena state is incomplete" });
            return;
          }

          if (!registration) {
            json(res, 409, { error: "agent is not registered for this competition" });
            return;
          }

          if (competition.status !== "live" || !competition.externalUrl) {
            json(res, 409, {
              error: "competition is not live",
              competitionId: competition.id,
              status: competition.status,
            });
            return;
          }

          const entryCost = competition.entryPrice;
          const walletKey = getCompetitionWalletKey(agent.id, competitionId);
          const competitionWallet = arenaState.competitionWallets[walletKey];

          if (!competitionWallet || competitionWallet.status !== "ready") {
            json(res, 409, { error: "competition wallet is not ready" });
            return;
          }

          let topUp = null;
          if (competitionWallet.balance < entryCost) {
            const topUpAmount = roundMoney(entryCost - competitionWallet.balance);
            if (budget.available < topUpAmount) {
              json(res, 409, {
                error: "insufficient budget",
                available: budget.available,
                required: topUpAmount,
              });
              return;
            }

            const fundingResult = topUpCompetitionWallet({
              agentId: agent.id,
              competitionId,
              sourceKey: budget.key,
              amount: topUpAmount,
              label: `Auto top-up for ${competition.title}`,
            });
            topUp = fundingResult.ledgerItem;
          }

          competitionWallet.balance = roundMoney(competitionWallet.balance - entryCost);
          competitionWallet.spentTotal = roundMoney(
            competitionWallet.spentTotal + entryCost,
          );
          competitionWallet.lastSpendAt = new Date().toISOString();

          const entry = {
            id: `entry-${Date.now()}`,
            competitionId,
            agentId: agent.id,
            agentName: agent.name,
            budgetSource: budget.key,
            walletAddress: competitionWallet.address,
            amount: entryCost,
            status: "entered",
            externalUrl: competition.externalUrl,
            createdAt: new Date().toISOString(),
          };

          const ledgerItem = {
            id: `ledger-${Date.now()}`,
            type: "competition_entry",
            label: `Entered ${competitionId}`,
            source: budget.key,
            amount: entryCost,
            agentId: agent.id,
            agentName: agent.name,
            competitionId,
            walletAddress: competitionWallet.address,
            createdAt: entry.createdAt,
          };

          arenaState.entryHistory.unshift(entry);
          addFundingLedgerItem(ledgerItem);
          syncDerivedArenaState();
          persistCompetitionWallets();

          json(res, 200, {
            entry,
            topUp,
            arenaState,
          });
        } catch {
          json(res, 400, { error: "invalid json body" });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), arenaDevApi()],
  server: {
    proxy: {
      "/api/checkers": {
        target: "https://mpp-checkers.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/checkers/, ""),
      },
    },
  },
});
