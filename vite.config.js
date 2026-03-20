import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { randomBytes } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, ".data");
const agentsPath = path.join(dataDir, "agents.json");
const registrationsPath = path.join(dataDir, "registrations.json");
const competitionWalletsPath = path.join(dataDir, "competition-wallets.json");
const agentSignersPath = path.join(dataDir, "agent-signers.json");
const execFileAsync = promisify(execFile);
const tempoBinPath = process.env.HOME
  ? path.join(process.env.HOME, ".local", "bin", "tempo")
  : "/Users/taowang/.local/bin/tempo";

function loadTempoWalletAddress() {
  try {
    const output = execFileSync(tempoBinPath, ["wallet", "-t", "whoami"], {
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    const match = output.match(/wallet:\s*"?(0x[a-fA-F0-9]{40})"?/);
    return match?.[1] ?? "0xa11ce00000000000000000000000000000000001";
  } catch {
    return "0xa11ce00000000000000000000000000000000001";
  }
}

const mainTempoWalletAddress = loadTempoWalletAddress();

function slugifyAgentId(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function createAgentRecord({ id, name, style = "balanced" }) {
  return {
    id,
    name,
    style,
    status: "ready",
    wins: 0,
    entries: 0,
    roi: "+0%",
    preferredCompetition: "MPP Checkers",
  };
}

function createDefaultAgents() {
  return [
    createAgentRecord({
      id: "yield-arena-bot",
      name: "yieldArenaBot",
    }),
  ];
}

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
      address: mainTempoWalletAddress,
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
    selectedBudgetSource: "auto",
    selectedCompetitionId: "mpp-checkers",
    agents: createDefaultAgents(),
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
        authorXHandle: "@jevgenijs",
        authorXUrl: "https://x.com/jevgenijs",
        summary: "Live 1v1 board competition with MPP-priced entry and public scoreboard.",
      },
      {
        id: "private-challenges",
        label: "pending",
        title: "Private Challenges",
        status: "pending",
        entryPrice: 0.01,
        payout: 0.02,
        refund: 0,
        externalUrl: "",
        authorXHandle: "not listed",
        authorXUrl: "",
        summary: "Direct agent-vs-agent rooms funded by wallet yield and settled inside the arena.",
      },
    ],
    budgetSources: {
      auto: { key: "auto", label: "Play Budget", available: 0.08 },
      protocol: { key: "protocol", label: "Protocol Budget", available: 0.01 },
      wallet: { key: "wallet", label: "Wallet Budget", available: 0.07 },
    },
    competitionWallets: {},
    agentAccounts: {},
    agentSigners: {},
    runPlans: {},
    liveCompetitionEntries: {},
    fundingLedger: initialLedger,
    budgetLedger: initialLedger,
    registrations: {},
    entryHistory: [],
  };
}

const arenaState = createInitialArenaState();

function loadPersistedAgents() {
  if (!existsSync(agentsPath)) {
    return createDefaultAgents();
  }

  try {
    const raw = readFileSync(agentsPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : createDefaultAgents();
  } catch {
    return createDefaultAgents();
  }
}

function persistAgents() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(agentsPath, JSON.stringify(arenaState.agents, null, 2), "utf8");
}

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

function getRunPlanKey(agentId, competitionId) {
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

function normalizeStrategy(value) {
  const strategy = typeof value === "string" ? value.trim() : "";
  return strategy.slice(0, 280);
}

function pickCheckersMove({ gameState, color, strategy }) {
  const validMoves = Array.isArray(gameState?.valid_moves) ? gameState.valid_moves : [];
  if (!validMoves.length) {
    return null;
  }

  const normalizedStrategy = normalizeStrategy(strategy).toLowerCase();
  const prefersAggressive = /aggressive|attack|fast win|capture|压制|进攻|快攻|吃子/.test(
    normalizedStrategy,
  );
  const prefersDefensive = /defensive|safe|draw|defend|稳|保守|防守|和棋/.test(
    normalizedStrategy,
  );
  const prefersCenter = /center|middle|control|中心|控制/.test(normalizedStrategy);
  const centerSquares = new Set([13, 14, 17, 18]);
  const promotionRow = color === "red" ? 0 : 7;

  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  for (const move of validMoves) {
    let score = 0;
    const fromRow = move.from_pos?.[0] ?? 0;
    const toRow = move.to_pos?.[0] ?? 0;
    const advancement = color === "red" ? fromRow - toRow : toRow - fromRow;
    const onEdge = move.to_pos?.[1] === 0 || move.to_pos?.[1] === 7;

    if (move.is_jump) score += 40;
    score += advancement * 2;

    if (toRow === promotionRow) score += 18;
    if (centerSquares.has(move.to)) score += 6;

    if (prefersAggressive) {
      if (move.is_jump) score += 20;
      score += advancement * 2;
    }

    if (prefersDefensive) {
      if (!move.is_jump) score += 4;
      if (onEdge) score += 6;
    }

    if (prefersCenter && centerSquares.has(move.to)) {
      score += 12;
    }

    if (score > bestScore) {
      bestMove = move;
      bestScore = score;
    }
  }

  return bestMove;
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
        strategy: legacyRegistration.customStrategy ?? "",
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
  arenaState.budgetSources.auto.available = roundMoney(
    arenaState.vaults.protocol.availableAllowance + arenaState.vaults.wallet.availableAllowance,
  );
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
arenaState.agents = loadPersistedAgents();
if (!arenaState.agents.some((agent) => agent.id === arenaState.selectedAgentId)) {
  arenaState.selectedAgentId = arenaState.agents[0]?.id ?? "yield-arena-bot";
}
hydrateCompetitionWalletsFromRegistrations();
syncDerivedArenaState();

function resetArenaState() {
  Object.assign(arenaState, createInitialArenaState());
  if (existsSync(agentsPath)) {
    unlinkSync(agentsPath);
  }
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

function createArenaAgent({ name } = {}) {
  const baseName = (name?.trim() || "").slice(0, 32);
  const existingNames = new Set(arenaState.agents.map((agent) => agent.name.toLowerCase()));
  const existingIds = new Set(arenaState.agents.map((agent) => agent.id));

  let nextName = baseName || `yieldArenaBot${arenaState.agents.length + 1}`;
  let nextId = slugifyAgentId(nextName) || `agent-${Date.now()}`;
  let suffix = 2;

  while (existingNames.has(nextName.toLowerCase()) || existingIds.has(nextId)) {
    const seed = baseName || "yieldArenaBot";
    nextName = `${seed}${suffix}`;
    nextId = slugifyAgentId(nextName) || `agent-${Date.now()}-${suffix}`;
    suffix += 1;
  }

  const styles = ["balanced", "aggressive", "defensive"];
  const style = styles[arenaState.agents.length % styles.length];
  const agent = createAgentRecord({
    id: nextId,
    name: nextName,
    style,
  });

  arenaState.agents.unshift(agent);
  arenaState.selectedAgentId = agent.id;
  persistAgents();
  return agent;
}

function deleteArenaAgent({
  agentId = arenaState.selectedAgentId,
} = {}) {
  const agentIndex = arenaState.agents.findIndex((agent) => agent.id === agentId);
  if (agentIndex === -1) {
    throw new Error("agent not found");
  }

  if (arenaState.agents.length <= 1) {
    throw new Error("keep at least one agent in the arena");
  }

  const removedAgent = arenaState.agents[agentIndex];
  let sweptAmount = 0;
  let sweptWallets = 0;

  for (const [walletKey, competitionWallet] of Object.entries(arenaState.competitionWallets)) {
    if (competitionWallet.agentId !== agentId) {
      continue;
    }

    if (competitionWallet.balance > 0) {
      const amount = competitionWallet.balance;
      const now = new Date().toISOString();
      competitionWallet.balance = 0;
      competitionWallet.sweptTotal = roundMoney(competitionWallet.sweptTotal + amount);
      competitionWallet.lastSweepAt = now;
      arenaState.vaults.wallet.availableAllowance = roundMoney(
        arenaState.vaults.wallet.availableAllowance + amount,
      );
      sweptAmount = roundMoney(sweptAmount + amount);
      sweptWallets += 1;

      addFundingLedgerItem({
        id: `ledger-delete-sweep-${Date.now()}-${walletKey}`,
        type: "agent_delete_sweep",
        label: `Deleted ${removedAgent.name} and swept ${competitionWallet.competitionId} wallet`,
        source: "wallet",
        amount,
        agentId,
        competitionId: competitionWallet.competitionId,
        walletAddress: competitionWallet.address,
        createdAt: now,
      });
    }

    delete arenaState.competitionWallets[walletKey];
    delete arenaState.liveCompetitionEntries[walletKey];
    delete arenaState.runPlans[walletKey];
  }

  delete arenaState.registrations[agentId];
  delete arenaState.agentSigners[agentId];

  arenaState.agents.splice(agentIndex, 1);

  if (arenaState.selectedAgentId === agentId) {
    arenaState.selectedAgentId = arenaState.agents[0]?.id ?? "yield-arena-bot";
  }

  addFundingLedgerItem({
    id: `ledger-agent-delete-${Date.now()}`,
    type: "agent_delete",
    label: `Deleted ${removedAgent.name}`,
    source: "wallet",
    amount: sweptAmount,
    agentId,
    createdAt: new Date().toISOString(),
  });

  syncDerivedArenaState();
  persistAgents();
  persistRegistrations();
  persistCompetitionWallets();
  persistAgentSigners();

  return {
    removedAgent,
    sweptAmount,
    sweptWallets,
  };
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

async function submitCheckersMove({ gameId, from, to, address }) {
  const response = await fetch(`https://mpp-checkers.com/games/${gameId}/move`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      address,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error ?? `move failed (${response.status})`);
    error.payload = payload;
    throw error;
  }

  return payload;
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

function getBudgetPreferenceOrder(selectedBudgetSource = arenaState.selectedBudgetSource) {
  if (selectedBudgetSource === "protocol") {
    return ["protocol"];
  }

  if (selectedBudgetSource === "wallet") {
    return ["wallet"];
  }

  return ["protocol", "wallet"];
}

function pickFundingSourceForEntry(entryPrice, selectedBudgetSource = arenaState.selectedBudgetSource) {
  const order = getBudgetPreferenceOrder(selectedBudgetSource);
  return order.find((sourceKey) => {
    const source = arenaState.budgetSources[sourceKey];
    return source && source.available >= entryPrice;
  }) ?? null;
}

function getRunnableBudget(selectedBudgetSource = arenaState.selectedBudgetSource) {
  if (selectedBudgetSource === "protocol") {
    return arenaState.vaults.protocol.availableAllowance;
  }

  if (selectedBudgetSource === "wallet") {
    return arenaState.vaults.wallet.availableAllowance;
  }

  return roundMoney(
    arenaState.vaults.protocol.availableAllowance + arenaState.vaults.wallet.availableAllowance,
  );
}

function getRunnableEntryCount({
  competitionId = arenaState.selectedCompetitionId,
  selectedBudgetSource = arenaState.selectedBudgetSource,
} = {}) {
  const competition = arenaState.competitions.find((item) => item.id === competitionId);
  if (!competition || !competition.entryPrice) {
    return 0;
  }

  return Math.floor(getRunnableBudget(selectedBudgetSource) / competition.entryPrice);
}

async function ensureCheckersRegistration({
  agentId = arenaState.selectedAgentId,
  nickname,
  customStrategy,
} = {}) {
  const agent = arenaState.agents.find((item) => item.id === agentId);
  if (!agent) {
    throw new Error("agent not found");
  }

  const existing = arenaState.registrations[agent.id];
  const nextStrategy = normalizeStrategy(customStrategy);
  if (existing) {
    const strategyChanged = nextStrategy !== (existing.customStrategy ?? "");
    if (strategyChanged) {
      existing.customStrategy = nextStrategy;
      persistRegistrations();
      syncDerivedArenaState();
    }
    return {
      registration: existing,
      created: false,
      updated: strategyChanged,
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
    customStrategy: nextStrategy,
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
    updated: false,
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
  preferredBudgetSource = arenaState.selectedBudgetSource,
} = {}) {
  const agent = arenaState.agents.find(
    (item) => item.id === arenaState.selectedAgentId,
  );
  const agentSigner = arenaState.agentSigners[arenaState.selectedAgentId];
  const registration = arenaState.registrations[arenaState.selectedAgentId];
  const competition = arenaState.competitions.find(
    (item) => item.id === competitionId,
  );

  if (!agent || !competition) {
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
  const effectiveBudgetSource = pickFundingSourceForEntry(entryCost, preferredBudgetSource);
  const walletKey = getCompetitionWalletKey(agent.id, competitionId);
  const competitionWallet = arenaState.competitionWallets[walletKey];

  if (!effectiveBudgetSource && competitionWallet?.balance < entryCost) {
    const error = new Error("insufficient budget");
    error.available = arenaState.playBudget;
    error.required = entryCost;
    throw error;
  }

  if (!competitionWallet || competitionWallet.status !== "ready") {
    throw new Error("competition wallet is not ready");
  }

  let topUp = null;
  if (competitionWallet.balance < entryCost) {
    const topUpAmount = roundMoney(entryCost - competitionWallet.balance);
    const fundingResult = topUpCompetitionWallet({
      agentId: agent.id,
      competitionId,
      sourceKey: effectiveBudgetSource,
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
    budgetSource: effectiveBudgetSource ?? preferredBudgetSource,
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
    customStrategy: registration?.customStrategy ?? "",
    signerKeyId: agentSigner.keyId,
    createdAt: new Date().toISOString(),
  };

  const ledgerItem = {
    id: `ledger-${Date.now()}`,
    type: "competition_entry",
    label: `Entered ${competitionId}`,
    source: effectiveBudgetSource ?? preferredBudgetSource,
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

function buildRunPlan({
  agentId,
  competitionId,
  preferredBudgetSource,
  targetEntries,
  completedEntries,
  customStrategy,
}) {
  return {
    id: `run-${agentId}-${competitionId}`,
    agentId,
    competitionId,
    preferredBudgetSource,
    customStrategy: normalizeStrategy(customStrategy),
    targetEntries,
    completedEntries,
    remainingEntries: Math.max(0, targetEntries - completedEntries),
    status: Math.max(0, targetEntries - completedEntries) > 0 ? "armed" : "completed",
    lastAdvancedAt: new Date().toISOString(),
  };
}

async function startCompetitionRun({
  agentId = arenaState.selectedAgentId,
  competitionId = arenaState.selectedCompetitionId,
  preferredBudgetSource = arenaState.selectedBudgetSource,
  customStrategy,
} = {}) {
  const existingRunPlan = arenaState.runPlans[getRunPlanKey(agentId, competitionId)];
  if (existingRunPlan && existingRunPlan.status === "armed" && existingRunPlan.remainingEntries > 0) {
    const error = new Error("run already in progress");
    error.runPlan = existingRunPlan;
    throw error;
  }

  const targetEntries = Math.max(
    1,
    getRunnableEntryCount({ competitionId, selectedBudgetSource: preferredBudgetSource }),
  );

  const firstEntry = await enterSelectedCompetition({
    competitionId,
    preferredBudgetSource,
  });

  const runPlan = buildRunPlan({
    agentId,
    competitionId,
    preferredBudgetSource,
    targetEntries,
    completedEntries: 1,
    customStrategy,
  });

  arenaState.runPlans[getRunPlanKey(agentId, competitionId)] = runPlan;
  runPlan.lastEntryId = firstEntry.entry.id;

  return {
    runPlan,
    latestEntry: firstEntry.entry,
    topUp: firstEntry.topUp,
  };
}

async function advanceRunPlans() {
  let advancedCount = 0;
  let moveCount = 0;

  for (const [runPlanKey, runPlan] of Object.entries(arenaState.runPlans)) {
    if (!runPlan || runPlan.status !== "armed" || runPlan.remainingEntries <= 0) {
      continue;
    }

    const liveEntry = arenaState.liveCompetitionEntries[runPlanKey];
    if (!liveEntry) {
      continue;
    }

    if (runPlan.competitionId !== "mpp-checkers") {
      continue;
    }

    const remoteState = await fetchGameState(liveEntry.gameId);
    liveEntry.status = remoteState.status ?? liveEntry.status;
    liveEntry.turn = remoteState.turn ?? liveEntry.turn;
    liveEntry.winner = remoteState.winner ?? null;
    liveEntry.opponent =
      liveEntry.color === "black" ? remoteState.red ?? null : remoteState.black ?? null;
    liveEntry.lastSyncedAt = new Date().toISOString();

    const stillOpen = liveEntry.status === "waiting" || liveEntry.status === "active";
    if (stillOpen) {
      const isOurTurn = liveEntry.status === "active" && remoteState.turn === liveEntry.color;
      const strategy =
        arenaState.registrations[runPlan.agentId]?.customStrategy ??
        runPlan.customStrategy ??
        "";

      if (isOurTurn) {
        const nextMove = pickCheckersMove({
          gameState: remoteState,
          color: liveEntry.color,
          strategy,
        });

        if (nextMove) {
          try {
            const movedState = await submitCheckersMove({
              gameId: liveEntry.gameId,
              from: nextMove.from,
              to: nextMove.to,
              address: liveEntry.payerWallet ?? arenaState.mainLoginWallet.address,
            });

            liveEntry.status = movedState.status ?? liveEntry.status;
            liveEntry.turn = movedState.turn ?? liveEntry.turn;
            liveEntry.winner = movedState.winner ?? liveEntry.winner;
            liveEntry.opponent =
              liveEntry.color === "black" ? movedState.red ?? null : movedState.black ?? null;
            liveEntry.lastSyncedAt = new Date().toISOString();
            liveEntry.lastMove = {
              from: nextMove.from,
              to: nextMove.to,
              isJump: Boolean(nextMove.is_jump),
              movedAt: new Date().toISOString(),
            };
            delete liveEntry.lastMoveError;
            moveCount += 1;
          } catch (error) {
            liveEntry.lastMoveError = error.message || "move failed";
            liveEntry.lastSyncedAt = new Date().toISOString();
          }
        }
      }

      continue;
    }

    if (!pickFundingSourceForEntry(
      arenaState.competitions.find((item) => item.id === runPlan.competitionId)?.entryPrice ?? 0,
      runPlan.preferredBudgetSource,
    )) {
      runPlan.status = "budget_exhausted";
      runPlan.lastAdvancedAt = new Date().toISOString();
      continue;
    }

    const nextEntry = await enterSelectedCompetition({
      competitionId: runPlan.competitionId,
      preferredBudgetSource: runPlan.preferredBudgetSource,
    });

    runPlan.completedEntries += 1;
    runPlan.remainingEntries = Math.max(0, runPlan.targetEntries - runPlan.completedEntries);
    runPlan.status = runPlan.remainingEntries > 0 ? "armed" : "completed";
    runPlan.lastAdvancedAt = new Date().toISOString();
    runPlan.lastEntryId = nextEntry.entry.id;
    advancedCount += 1;
  }

  return {
    advancedCount,
    moveCount,
    runPlans: arenaState.runPlans,
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

      server.middlewares.use("/api/arena/create-agent", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const agent = createArenaAgent({ name: body.name });
          json(res, 200, {
            agent,
            arenaState,
          });
        } catch {
          json(res, 400, { error: "invalid json body" });
        }
      });

      server.middlewares.use("/api/arena/delete-agent", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const result = deleteArenaAgent({
            agentId: body.agentId ?? arenaState.selectedAgentId,
          });
          json(res, 200, {
            deleted: result.removedAgent,
            sweptAmount: result.sweptAmount,
            sweptWallets: result.sweptWallets,
            arenaState,
          });
        } catch (error) {
          json(res, 409, { error: error.message || "delete agent failed" });
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
            customStrategy: body.customStrategy,
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
            customStrategy: body.customStrategy,
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
          let sourceKey = body.source ?? arenaState.selectedBudgetSource;
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

          if (sourceKey === "auto") {
            sourceKey = pickFundingSourceForEntry(amount, "auto");
            if (!sourceKey) {
              json(res, 409, { error: "no funded source available for top-up" });
              return;
            }
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

      server.middlewares.use("/api/arena/resume-match", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const agentId = body.agentId ?? arenaState.selectedAgentId;
          const competitionId = body.competitionId ?? arenaState.selectedCompetitionId;
          const gameId = body.gameId;
          const color = body.color;
          const registration = arenaState.registrations[agentId];
          const signer = arenaState.agentSigners[agentId];

          if (!registration) {
            json(res, 409, { error: "agent is not registered for this competition" });
            return;
          }

          if (!signer) {
            json(res, 409, { error: "agent signer is not provisioned" });
            return;
          }

          if (!gameId || (color !== "black" && color !== "red")) {
            json(res, 400, { error: "gameId and color are required" });
            return;
          }

          const remoteState = await fetchGameState(gameId);
          const walletKey = getCompetitionWalletKey(agentId, competitionId);
          arenaState.liveCompetitionEntries[walletKey] = {
            agentId,
            competitionId,
            gameId,
            color,
            status: remoteState.status ?? "active",
            turn: remoteState.turn ?? null,
            winner: remoteState.winner ?? null,
            opponent: color === "black" ? remoteState.red ?? null : remoteState.black ?? null,
            participantMode: signer.executionMode,
            payerWallet: arenaState.mainLoginWallet.address,
            payerNickname: color === "black" ? remoteState.black ?? null : remoteState.red ?? null,
            registeredWallet: registration.address,
            registeredNickname: registration.nickname,
            signerKeyId: signer.keyId,
            joinedAt: new Date().toISOString(),
            lastSyncedAt: new Date().toISOString(),
          };

          arenaState.runPlans[walletKey] = {
            id: `run-${agentId}-${competitionId}-resume`,
            agentId,
            competitionId,
            preferredBudgetSource: arenaState.selectedBudgetSource,
            customStrategy: registration.customStrategy ?? "",
            targetEntries: 2,
            completedEntries: 1,
            remainingEntries: 1,
            status: "armed",
            lastAdvancedAt: new Date().toISOString(),
            lastEntryId: `resume-${gameId}`,
          };

          syncDerivedArenaState();
          json(res, 200, {
            arenaState,
            liveEntry: arenaState.liveCompetitionEntries[walletKey],
            runPlan: arenaState.runPlans[walletKey],
          });
        } catch (error) {
          json(res, 409, { error: error.message || "resume match failed" });
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

      server.middlewares.use("/api/arena/advance-run", async (req, res) => {
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed" });
          return;
        }

        try {
          const result = await advanceRunPlans();
          json(res, 200, {
            advancedCount: result.advancedCount,
            moveCount: result.moveCount,
            runPlans: result.runPlans,
            arenaState,
          });
        } catch (error) {
          json(res, 409, { error: error.message || "advance run failed" });
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
            customStrategy: body.customStrategy,
          });
          const signer = ensureAgentSigner({
            agentId: body.agentId ?? arenaState.selectedAgentId,
          });
          const run = await startCompetitionRun({
            agentId: body.agentId ?? arenaState.selectedAgentId,
            competitionId: body.competitionId ?? arenaState.selectedCompetitionId,
            preferredBudgetSource: body.budgetSource ?? arenaState.selectedBudgetSource,
            customStrategy: body.customStrategy,
          });

          json(res, 200, {
            activation: {
              registrationCreated: registration.created,
              signerCreated: signer.created,
            },
            registration: registration.registration,
            signer: signer.signer,
            entry: run.latestEntry,
            run,
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
