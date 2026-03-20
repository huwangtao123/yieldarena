#!/usr/bin/env node

function parseArgs(argv) {
  const options = {
    baseUrl: "http://127.0.0.1:4173",
    agentId: "dragonbot",
    competitionId: "mpp-checkers",
    budgetSource: "protocol",
    nickname: "",
    reset: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--base-url" && next) {
      options.baseUrl = next;
      index += 1;
    } else if (arg === "--agent-id" && next) {
      options.agentId = next;
      index += 1;
    } else if (arg === "--competition-id" && next) {
      options.competitionId = next;
      index += 1;
    } else if (arg === "--budget-source" && next) {
      options.budgetSource = next;
      index += 1;
    } else if (arg === "--nickname" && next) {
      options.nickname = next;
      index += 1;
    } else if (arg === "--reset") {
      options.reset = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Yield Arena agent runner

Usage:
  npm run agent:run -- [options]

Options:
  --base-url <url>          Arena base URL (default: http://127.0.0.1:4173)
  --agent-id <id>           Arena agent id (default: dragonbot)
  --competition-id <id>     Competition id (default: mpp-checkers)
  --budget-source <source>  protocol or wallet (default: protocol)
  --nickname <name>         Checkers nickname override
  --reset                   Reset arena demo state before running
  --help                    Show this help
`);
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.error ?? `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function postJson(baseUrl, path, body = {}) {
  return fetchJson(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function getArenaState(baseUrl) {
  return fetchJson(`${baseUrl}/api/arena/state`);
}

function pickBudgetSource(state, preferredKey, entryPrice) {
  const preferred = state.budgetSources[preferredKey];
  if (preferred && preferred.available >= entryPrice) {
    return preferred.key;
  }

  const fallback = Object.values(state.budgetSources).find(
    (source) => source.available >= entryPrice,
  );

  return fallback?.key ?? null;
}

function logSection(title, details) {
  console.log(`\n[${title}]`);
  if (Array.isArray(details)) {
    for (const line of details) {
      console.log(line);
    }
    return;
  }
  console.log(details);
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  try {
    if (options.reset) {
      await postJson(options.baseUrl, "/api/arena/reset");
      logSection("reset", "arena demo state reset");
    }

    let state = await getArenaState(options.baseUrl);
    const agent =
      state.agents.find((item) => item.id === options.agentId) ?? state.agents[0];

    if (!agent) {
      throw new Error("no arena agents available");
    }

    if (state.selectedAgentId !== agent.id) {
      state = await postJson(options.baseUrl, "/api/arena/select-agent", {
        agentId: agent.id,
      });
    }

    const competition =
      state.competitions.find((item) => item.id === options.competitionId) ??
      state.competitions[0];

    if (!competition) {
      throw new Error("no competitions available");
    }

    if (state.selectedCompetitionId !== competition.id) {
      state = await postJson(options.baseUrl, "/api/arena/select-competition", {
        competitionId: competition.id,
      });
    }

    logSection("selection", [
      `agent: ${agent.name} (${agent.id})`,
      `competition: ${competition.title} (${competition.id})`,
      `competition status: ${competition.status}`,
    ]);

    if (competition.status !== "live" || !competition.externalUrl) {
      throw new Error(`competition ${competition.id} is not live`);
    }

    let registration = state.registrations?.[agent.id];
    if (!registration) {
      const nickname = options.nickname || agent.name;
      const registrationResult = await postJson(
        options.baseUrl,
        "/api/arena/register-checkers",
        {
          agentId: agent.id,
          nickname,
        },
      );
      registration = registrationResult.registration;
      state = registrationResult.arenaState;
      logSection("registration", [
        `nickname: ${registration.nickname}`,
        `agent account: ${registration.address}`,
        `parent wallet: ${registration.parentWallet}`,
      ]);
    } else {
      logSection("registration", [
        `nickname: ${registration.nickname}`,
        `agent account: ${registration.address}`,
        `parent wallet: ${registration.parentWallet}`,
        "status: existing registration reused",
      ]);
    }

    let agentAccount = state.agentAccounts?.[agent.id];
    let signer = agentAccount?.signer;
    if (!signer) {
      const signerResult = await postJson(options.baseUrl, "/api/arena/provision-signer", {
        agentId: agent.id,
      });
      signer = signerResult.signer;
      state = signerResult.arenaState;
      logSection("signer", [
        `key id: ${signer.keyId}`,
        `mode: ${signer.executionMode}`,
        `expiry: ${signer.expiry}`,
      ]);
    } else {
      logSection("signer", [
        `key id: ${signer.keyId}`,
        `mode: ${signer.executionMode}`,
        `expiry: ${signer.expiry}`,
        "status: existing signer reused",
      ]);
    }

    const budgetSource = pickBudgetSource(
      state,
      options.budgetSource,
      competition.entryPrice,
    );

    if (!budgetSource) {
      throw new Error("no budget source has enough balance for entry");
    }

    if (state.selectedBudgetSource !== budgetSource) {
      state = await postJson(options.baseUrl, "/api/arena/select-budget", {
        budgetSource,
      });
    }

    logSection("budget", [
      `selected: ${budgetSource}`,
      `available: ${state.budgetSources[budgetSource].available.toFixed(2)}`,
      `entry price: ${competition.entryPrice.toFixed(2)}`,
      `play budget: ${state.playBudget.toFixed(2)}`,
    ]);

    const entryResult = await postJson(options.baseUrl, "/api/arena/enter", {
      competitionId: competition.id,
    });

    logSection("entry", [
      `agent: ${entryResult.entry.agentName}`,
      `competition: ${entryResult.entry.competitionId}`,
      `budget source: ${entryResult.entry.budgetSource}`,
      `amount: ${entryResult.entry.amount.toFixed(2)}`,
      `match id: ${entryResult.entry.matchId ?? "n/a"}`,
      `color: ${entryResult.entry.color ?? "n/a"}`,
      `attends as: ${entryResult.entry.actualPlayerNickname ?? "n/a"}`,
      `participant mode: ${entryResult.entry.participantMode ?? "n/a"}`,
      `external url: ${entryResult.entry.externalUrl}`,
    ]);

    logSection("remaining", [
      `protocol: ${entryResult.arenaState.budgetSources.protocol.available.toFixed(2)}`,
      `wallet: ${entryResult.arenaState.budgetSources.wallet.available.toFixed(2)}`,
      `play budget: ${entryResult.arenaState.playBudget.toFixed(2)}`,
    ]);
  } catch (error) {
    console.error("\n[error]");
    console.error(error.message);
    if (error.payload) {
      console.error(JSON.stringify(error.payload, null, 2));
    }
    process.exit(1);
  }
}

run();
