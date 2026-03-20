import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, ".data");
const registrationsPath = path.join(dataDir, "registrations.json");
const competitionWalletsPath = path.join(dataDir, "competition-wallets.json");
const agentSignersPath = path.join(dataDir, "agent-signers.json");
const execFileAsync = promisify(execFile);
const tempoBinPath = process.env.HOME
  ? path.join(process.env.HOME, ".local", "bin", "tempo")
  : "/Users/taowang/.local/bin/tempo";

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
    selectedAgentId: "yield-arena-bot",
    selectedBudgetSource: "protocol",
    selectedCompetitionId: "mpp-checkers",
    agents: [
      {
        id: "yield-arena-bot",
        name: "yieldArenaBot",
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
    agentAccounts: {},
    agentSigners: {},
    liveCompetitionEntries: {},
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

function loadPersistedAgentSigners() {
  if (!existsSync(agentSignersPath)) {
    return {};
  }

  try {
    const raw = readFileSync(agentSignersPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistAgentSigners() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    agentSignersPath,
    JSON.stringify(arenaState.agentSigners, null, 2),
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

function createAgentSignerRecord({
  agentId,
  accountAddress,
  executionMode = "delegated_main_wallet",
}) {
  const now = Date.now();
  const expiry = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const publicKey = `0x${randomBytes(32).toString("hex")}`;

  return {
    agentId,
    accountAddress,
    keyId: `signer-${agentId}-${now}`,
    signatureType: "P256",
    publicKey,
    status: "provisioned",
    executionMode,
    provisionedAt: new Date(now).toISOString(),
    lastUsedAt: null,
    expiry,
    enforceLimits: true,
    spendingLimits: [
      {
        token: "USDC",
        limit: 1,
        remaining: 1,
        periodSeconds: 86400,
      },
    ],
    allowedCompetitions: ["mpp-checkers"],
    allowedDestinations: ["mpp-checkers"],
  };
}

function buildAgentAccounts() {
  const nextAgentAccounts = {};

  for (const agent of arenaState.agents) {
    const legacyRegistration = arenaState.registrations[agent.id];
    const signer = arenaState.agentSigners[agent.id] ?? null;
    const competitionProfiles = {};

    if (legacyRegistration) {
      competitionProfiles[legacyRegistration.competitionId] = {
        nickname: legacyRegistration.nickname,
        registeredAt: legacyRegistration.createdAt,
      };
    }

    const competitionWallet = Object.values(arenaState.competitionWallets).find(
      (item) => item.agentId === agent.id,
    );

    if (!legacyRegistration && !competitionWallet) {
      continue;
    }

    nextAgentAccounts[agent.id] = {
      agentId: agent.id,
      accountType: "tempo_agent_account",
      address: competitionWallet?.address ?? legacyRegistration?.address ?? null,
      parentAccount: arenaState.mainLoginWallet.address,
      signer,
      signerStatus: signer?.status ?? (legacyRegistration ? "identity_provisioned" : "pending"),
      executionMode: signer?.executionMode ??
        (legacyRegistration?.address === arenaState.mainLoginWallet.address
          ? "native"
          : legacyRegistration
            ? "delegated_main_wallet"
            : "pending"),
      balance: competitionWallet?.balance ?? 0,
      fundedTotals: competitionWallet?.fundedTotals ?? {
        protocol: 0,
        wallet: 0,
      },
      spentTotal: competitionWallet?.spentTotal ?? 0,
      sweptTotal: competitionWallet?.sweptTotal ?? 0,
      lastFundingSource: competitionWallet?.lastFundingSource ?? null,
      lastFundingAt: competitionWallet?.lastFundingAt ?? null,
      lastSpendAt: competitionWallet?.lastSpendAt ?? null,
      lastSweepAt: competitionWallet?.lastSweepAt ?? null,
      competitionProfiles,
    };
  }

  arenaState.agentAccounts = nextAgentAccounts;
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
  buildAgentAccounts();
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
arenaState.agentSigners = loadPersistedAgentSigners();
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
  if (existsSync(agentSignersPath)) {
    unlinkSync(agentSignersPath);
  }
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function runTempoRequestJson(url, args = []) {
  const { stdout } = await execFileAsync(
    tempoBinPath,
    ["request", "-s", ...args, url],
    {
      timeout: 45000,
      maxBuffer: 1024 * 1024,
    },
  );

  return JSON.parse(stdout);
}

async function fetchGameState(gameId) {
  const response = await fetch(`https://mpp-checkers.com/games/${gameId}`);
  if (!response.ok) {
    throw new Error(`failed to load game state (${response.status})`);
  }

  return response.json();
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

async function ensureCheckersRegistration({
  agentId = arenaState.selectedAgentId,
  nickname,
} = {}) {
  const agent = arenaState.agents.find((item) => item.id === agentId);
  if (!agent) {
    throw new Error("agent not found");
  }

  const existing = arenaState.registrations[agent.id];
  if (existing) {
    return {
      registration: existing,
      created: false,
    };
  }

  const baseNickname = nickname?.trim() || agent.name;
  let payload = {};
  let resolvedNickname = baseNickname;
  let registeredAddress = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const address = generateAssociatedWallet();
    resolvedNickname = attempt === 0
      ? baseNickname
      : `${baseNickname}${String(randomBytes(2).toString("hex")).slice(0, 4)}`;

    const upstream = await fetch("https://mpp-checkers.com/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nickname: resolvedNickname,
        address,
      }),
    });

    payload = await upstream.json().catch(() => ({}));
    if (upstream.ok) {
      registeredAddress = payload.player?.address ?? address;
      break;
    }

    const errorMessage = String(payload?.error ?? "").toLowerCase();
    if (errorMessage.includes("nickname already taken") && attempt < 4) {
      continue;
    }

    throw new Error(payload?.error ?? "checkers registration failed");
  }

  if (!registeredAddress) {
    throw new Error("failed to register a unique checkers nickname");
  }

  const registration = {
    competitionId: "mpp-checkers",
    nickname: payload.player?.nickname ?? resolvedNickname,
    address: registeredAddress,
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

  return {
    registration,
    created: true,
  };
}

function ensureAgentSigner({
  agentId = arenaState.selectedAgentId,
} = {}) {
  const agentAccount = arenaState.agentAccounts[agentId];
  const registration = arenaState.registrations[agentId];

  if (!agentAccount || !registration) {
    throw new Error("agent account is not provisioned yet");
  }

  if (arenaState.agentSigners[agentId]) {
    syncDerivedArenaState();
    return {
      signer: arenaState.agentSigners[agentId],
      created: false,
    };
  }

  const signer = createAgentSignerRecord({
    agentId,
    accountAddress: agentAccount.address,
    executionMode:
      registration.address === arenaState.mainLoginWallet.address
        ? "native"
        : "delegated_main_wallet",
  });

  arenaState.agentSigners[agentId] = signer;
  persistAgentSigners();
  syncDerivedArenaState();

  return {
    signer,
    created: true,
  };
}

async function enterSelectedCompetition({
  competitionId = arenaState.selectedCompetitionId,
} = {}) {
  const budget = arenaState.budgetSources[arenaState.selectedBudgetSource];
  const agent = arenaState.agents.find(
    (item) => item.id === arenaState.selectedAgentId,
  );
  const agentSigner = arenaState.agentSigners[arenaState.selectedAgentId];
  const registration = arenaState.registrations[arenaState.selectedAgentId];
  const competition = arenaState.competitions.find(
    (item) => item.id === competitionId,
  );

  if (!budget || !agent || !competition) {
    throw new Error("arena state is incomplete");
  }

  if (!registration) {
    throw new Error("agent is not registered for this competition");
  }

  if (!agentSigner || agentSigner.status !== "provisioned") {
    throw new Error("agent signer is not provisioned");
  }

  if (
    agentSigner.allowedCompetitions?.length &&
    !agentSigner.allowedCompetitions.includes(competitionId)
  ) {
    throw new Error("competition is not allowed by signer policy");
  }

  if (competition.status !== "live" || !competition.externalUrl) {
    throw new Error("competition is not live");
  }

  const entryCost = competition.entryPrice;
  const walletKey = getCompetitionWalletKey(agent.id, competitionId);
  const competitionWallet = arenaState.competitionWallets[walletKey];

  if (!competitionWallet || competitionWallet.status !== "ready") {
    throw new Error("competition wallet is not ready");
  }

  let topUp = null;
  if (competitionWallet.balance < entryCost) {
    const topUpAmount = roundMoney(entryCost - competitionWallet.balance);
    if (budget.available < topUpAmount) {
      const error = new Error("insufficient budget");
      error.available = budget.available;
      error.required = topUpAmount;
      throw error;
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

  let remoteJoin = null;
  let remoteState = null;
  let liveEntry = null;

  if (competitionId === "mpp-checkers") {
    remoteJoin = await runTempoRequestJson("https://mpp-checkers.com/games", [
      "-X",
      "POST",
    ]);
    remoteState = await fetchGameState(remoteJoin.game_id);
    const actualPlayerNickname = remoteJoin.color === "black"
      ? remoteState.black
      : remoteState.red;

    liveEntry = {
      agentId: agent.id,
      competitionId,
      gameId: remoteJoin.game_id,
      color: remoteJoin.color,
      status: remoteState.status ?? remoteJoin.status,
      turn: remoteState.turn ?? remoteJoin.turn,
      winner: remoteState.winner ?? null,
      opponent:
        remoteJoin.color === "black" ? remoteState.red ?? null : remoteState.black ?? null,
      participantMode: agentSigner.executionMode,
      payerWallet: arenaState.mainLoginWallet.address,
      payerNickname: actualPlayerNickname ?? null,
      registeredWallet: registration.address,
      registeredNickname: registration.nickname,
      signerKeyId: agentSigner.keyId,
      joinedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    };

    arenaState.liveCompetitionEntries[walletKey] = liveEntry;
  }

  agentSigner.lastUsedAt = new Date().toISOString();

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
    payerWallet: arenaState.mainLoginWallet.address,
    amount: entryCost,
    status: "entered",
    externalUrl: competition.externalUrl,
    matchId: remoteJoin?.game_id ?? null,
    matchStatus: remoteState?.status ?? remoteJoin?.status ?? null,
    color: remoteJoin?.color ?? null,
    participantMode: liveEntry?.participantMode ?? agentSigner.executionMode,
    actualPlayerNickname: liveEntry?.payerNickname ?? null,
    signerKeyId: agentSigner.keyId,
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
  persistAgentSigners();

  return {
    entry,
    ledgerItem,
    topUp,
    liveEntry,
    remoteJoin,
    remoteState,
  };
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
          const result = await ensureCheckersRegistration({
            agentId: body.agentId,
            nickname: body.nickname,
          });

          json(res, 200, {
            registration: result.registration,
            created: result.created,
            arenaState,
          });
        } catch (error) {
          json(res, 400, { error: error.message || "invalid registration request" });
        }
      });

      server.middlewares.use("/api/arena/activate-agent", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const registration = await ensureCheckersRegistration({
            agentId: body.agentId,
            nickname: body.nickname,
          });
          const signer = ensureAgentSigner({
            agentId: body.agentId ?? arenaState.selectedAgentId,
          });

          json(res, 200, {
            activation: {
              registrationCreated: registration.created,
              signerCreated: signer.created,
            },
            registration: registration.registration,
            signer: signer.signer,
            arenaState,
          });
        } catch (error) {
          json(res, 400, { error: error.message || "activation failed" });
        }
      });

      server.middlewares.use("/api/arena/provision-signer", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const result = ensureAgentSigner({
            agentId: body.agentId,
          });

          json(res, 200, {
            signer: result.signer,
            created: result.created,
            arenaState,
          });
        } catch (error) {
          json(res, 400, { error: error.message || "signer provisioning failed" });
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
          const result = await enterSelectedCompetition({ competitionId });

          json(res, 200, {
            entry: result.entry,
            topUp: result.topUp,
            remoteJoin: result.remoteJoin,
            liveEntry: result.liveEntry,
            arenaState,
          });
        } catch (error) {
          json(res, 409, {
            error: error.message || "entry failed",
            available: error.available,
            required: error.required,
          });
        }
      });

      server.middlewares.use("/api/arena/quick-enter", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const registration = await ensureCheckersRegistration({
            agentId: body.agentId,
            nickname: body.nickname,
          });
          const signer = ensureAgentSigner({
            agentId: body.agentId ?? arenaState.selectedAgentId,
          });
          const result = await enterSelectedCompetition({
            competitionId: body.competitionId ?? arenaState.selectedCompetitionId,
          });

          json(res, 200, {
            activation: {
              registrationCreated: registration.created,
              signerCreated: signer.created,
            },
            registration: registration.registration,
            signer: signer.signer,
            entry: result.entry,
            topUp: result.topUp,
            remoteJoin: result.remoteJoin,
            liveEntry: result.liveEntry,
            arenaState,
          });
        } catch (error) {
          json(res, 409, {
            error: error.message || "quick enter failed",
            available: error.available,
            required: error.required,
          });
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
