import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const arenaState = {
  principal: 100,
  todayYield: 0.08,
  playBudget: 0.08,
  selectedAgentId: "dragonbot",
  selectedBudgetSource: "protocol",
  agents: [
    { id: "dragonbot", name: "DragonBot", style: "balanced", status: "ready" },
    { id: "scout-v2", name: "Scout_V2", style: "defensive", status: "active" },
    { id: "oracle-prime", name: "Oracle_Prime", style: "aggressive", status: "trial" },
  ],
  budgetSources: {
    protocol: { key: "protocol", label: "Protocol Budget", available: 0.01 },
    wallet: { key: "wallet", label: "Wallet Budget", available: 0.07 },
  },
  entryHistory: [],
};

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

function arenaDevApi() {
  return {
    name: "arena-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/arena/state", (_req, res) => {
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

      server.middlewares.use("/api/arena/enter", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const competitionId = body.competitionId ?? "mpp-checkers";
          const budget = arenaState.budgetSources[arenaState.selectedBudgetSource];
          const agent = arenaState.agents.find(
            (item) => item.id === arenaState.selectedAgentId,
          );

          if (!budget || !agent) {
            json(res, 400, { error: "arena state is incomplete" });
            return;
          }

          const entryCost = 0.01;
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
            externalUrl: "https://mpp-checkers.com/",
            createdAt: new Date().toISOString(),
          };

          arenaState.entryHistory.unshift(entry);

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
