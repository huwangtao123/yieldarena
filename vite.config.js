import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { randomBytes } from "node:crypto";

function createInitialArenaState() {
  return {
    mainLoginWallet: {
      label: "Main Arena Login",
      address: "0xa11ce00000000000000000000000000000000001",
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
    budgetLedger: [
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
    ],
    registrations: {},
    entryHistory: [],
  };
}

const arenaState = createInitialArenaState();

function resetArenaState() {
  Object.assign(arenaState, createInitialArenaState());
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

          json(res, 200, {
            registration,
            arenaState,
          });
        } catch {
          json(res, 400, { error: "invalid registration request" });
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
          const competition = arenaState.competitions.find(
            (item) => item.id === competitionId,
          );

          if (!budget || !agent || !competition) {
            json(res, 400, { error: "arena state is incomplete" });
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
          if (budget.available < entryCost) {
            json(res, 409, {
              error: "insufficient budget",
              available: budget.available,
              required: entryCost,
            });
            return;
          }

          budget.available = Number((budget.available - entryCost).toFixed(2));
          arenaState.playBudget = Number(
            Object.values(arenaState.budgetSources)
              .reduce((sum, source) => sum + source.available, 0)
              .toFixed(2),
          );

          const entry = {
            id: `entry-${Date.now()}`,
            competitionId,
            agentId: agent.id,
            agentName: agent.name,
            budgetSource: budget.key,
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
            createdAt: entry.createdAt,
          };

          arenaState.entryHistory.unshift(entry);
          arenaState.budgetLedger.unshift(ledgerItem);

          json(res, 200, {
            entry,
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
