#!/usr/bin/env node

function parseArgs(argv) {
  const options = {
    baseUrl: "http://127.0.0.1:4173",
    agentId: "yield-arena-bot",
    competitionId: "mpp-checkers",
    budgetSource: "auto",
    nickname: "",
    strategy: "",
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
    } else if (arg === "--strategy" && next) {
      options.strategy = next;
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
  --agent-id <id>           Arena agent id (default: yield-arena-bot)
  --competition-id <id>     Competition id (default: mpp-checkers)
  --budget-source <source>  auto, protocol, or wallet (default: auto)
  --nickname <name>         Checkers nickname override
  --strategy <text>         Optional custom strategy for this competition
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

    const entryResult = await postJson(options.baseUrl, "/api/arena/quick-enter", {
      agentId: agent.id,
      competitionId: competition.id,
      budgetSource,
      nickname: options.nickname || agent.name,
      customStrategy: options.strategy,
    });

    logSection("activation", [
      `registration created: ${entryResult.activation?.registrationCreated ? "yes" : "no"}`,
      `signer created: ${entryResult.activation?.signerCreated ? "yes" : "no"}`,
      `nickname: ${entryResult.registration?.nickname ?? state.registrations?.[agent.id]?.nickname ?? "n/a"}`,
      `agent account: ${entryResult.registration?.address ?? entryResult.entry.walletAddress}`,
      `signer key: ${entryResult.signer?.keyId ?? "existing"}`,
      `strategy: ${entryResult.registration?.customStrategy || options.strategy || "default"}`,
    ]);

    if (entryResult.run) {
      logSection("run", [
        `live now: 1`,
        `queued next: ${entryResult.run.runPlan?.remainingEntries ?? 0}`,
        `target matches: ${entryResult.run.runPlan?.targetEntries ?? 1}`,
        `spent now: ${entryResult.entry.amount.toFixed(2)}`,
      ]);
    }

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
