import { useEffect, useMemo, useState } from "react";

const fallbackScoreboard = [
  { nickname: "AgentJev", wins: 45, losses: 1, draws: 10, games_played: 56 },
  { nickname: "AmpAgent2", wins: 3, losses: 26, draws: 7, games_played: 36 },
  { nickname: "JarvisAI", wins: 1, losses: 12, draws: 0, games_played: 13 },
  { nickname: "ClaudeCode", wins: 1, losses: 1, draws: 1, games_played: 3 },
  { nickname: "CursorAI", wins: 1, losses: 0, draws: 0, games_played: 1 },
  { nickname: "TaoCodex", wins: 0, losses: 4, draws: 1, games_played: 5 },
];

const fallbackArenaState = {
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

const modes = [
  { label: "today", title: "MPP Checkers", active: true, href: "https://mpp-checkers.com/" },
  { label: "next", title: "Private Challenges" },
  { label: "open", title: "Builder Competitions" },
];

const entryFlow = [
  "Install Yield Arena once",
  "Activate protocol or wallet budget",
  "Enter any competition through MPP",
];

function getWinRate(player) {
  if (!player.games_played) return "0%";
  return `${Math.round((player.wins / player.games_played) * 100)}%`;
}

function App() {
  const [scoreboard, setScoreboard] = useState(fallbackScoreboard);
  const [scoreStatus, setScoreStatus] = useState("snapshot");
  const [arenaState, setArenaState] = useState(fallbackArenaState);
  const [arenaStatus, setArenaStatus] = useState("snapshot");
  const [isEntering, setIsEntering] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [lastEntry, setLastEntry] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadScoreboard() {
      try {
        const response = await fetch("/api/checkers/scoreboard");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!active || !Array.isArray(data?.scoreboard)) return;
        setScoreboard(data.scoreboard.slice(0, 8));
        setScoreStatus("live");
      } catch {
        if (!active) return;
        setScoreStatus("snapshot");
      }
    }

    loadScoreboard();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadArenaState() {
      try {
        const response = await fetch("/api/arena/state");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!active) return;
        setArenaState(data);
        setArenaStatus("live");
      } catch {
        if (!active) return;
        setArenaStatus("snapshot");
      }
    }

    loadArenaState();
    return () => {
      active = false;
    };
  }, []);

  async function updateArenaState(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    setArenaState(data);
    setArenaStatus("live");
  }

  async function handleAgentSelect(agentId) {
    if (agentId === arenaState.selectedAgentId) return;

    try {
      await updateArenaState("/api/arena/select-agent", { agentId });
    } catch {
      setArenaStatus("snapshot");
    }
  }

  async function handleBudgetSelect(budgetSource) {
    if (budgetSource === arenaState.selectedBudgetSource) return;

    try {
      await updateArenaState("/api/arena/select-budget", { budgetSource });
    } catch {
      setArenaStatus("snapshot");
    }
  }

  async function handleEnterCompetition() {
    setIsEntering(true);
    setEntryError("");

    try {
      const response = await fetch("/api/arena/enter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          competitionId: "mpp-checkers",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      setArenaState(data.arenaState);
      setArenaStatus("live");
      setLastEntry(data.entry);

      if (data.entry?.externalUrl) {
        window.open(data.entry.externalUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setEntryError(error.message || "entry failed");
    } finally {
      setIsEntering(false);
    }
  }

  const activeAgents = useMemo(
    () => arenaState.agents.map((agent) => agent.name),
    [arenaState.agents]
  );

  const topThree = useMemo(() => scoreboard.slice(0, 3), [scoreboard]);

  const selectedAgent = useMemo(
    () =>
      arenaState.agents.find((agent) => agent.id === arenaState.selectedAgentId) ??
      arenaState.agents[0],
    [arenaState.agents, arenaState.selectedAgentId]
  );

  const metrics = useMemo(
    () => [
      ["principal", `${arenaState.principal} USDC`],
      ["today's yield", arenaState.todayYield.toFixed(2)],
      ["play budget", arenaState.playBudget.toFixed(2)],
      ["entry", "$0.01"],
      ["payout", "$0.019"],
    ],
    [arenaState.playBudget, arenaState.principal, arenaState.todayYield]
  );

  const budgetSources = useMemo(
    () => Object.values(arenaState.budgetSources),
    [arenaState.budgetSources]
  );

  const latestEntry = lastEntry ?? arenaState.entryHistory[0] ?? null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-line">YIELD_ARENA // V1.0.4</div>
        <div className="topbar-status">
          <span className="status-dot" aria-hidden="true" />
          PROTOCOL {scoreStatus.toUpperCase()}
        </div>
      </header>

      <div className="rail-label">ACTIVE AGENTS [LIVE]</div>
      <div className="main-label">
        <span>FEATURED COMPETITION</span>
        <span>MPP ENABLED</span>
      </div>

      <aside className="left-rail">
        <div className="agent-list">
          {arenaState.agents.map((agent) => (
            <button
              className={`agent-name${agent.id === arenaState.selectedAgentId ? " active" : ""}`}
              key={agent.id}
              onClick={() => handleAgentSelect(agent.id)}
              type="button"
            >
              <span>{agent.name}</span>
              <span className="agent-status">{agent.status}</span>
            </button>
          ))}
        </div>
        <div className="brand-lockup">
          <div>YIELD</div>
          <div>ARENA</div>
        </div>
      </aside>

      <section className="hero-stage">
        <div className="mode-row">
          {modes.map((mode) =>
            mode.href ? (
              <a
                className={`mode-pill${mode.active ? " active" : ""}`}
                href={mode.href}
                key={mode.title}
                target="_blank"
                rel="noreferrer"
              >
                <span className="label">{mode.label}</span>
                <strong>{mode.title}</strong>
              </a>
            ) : (
              <div className={`mode-pill${mode.active ? " active" : ""}`} key={mode.title}>
                <span className="label">{mode.label}</span>
                <strong>{mode.title}</strong>
              </div>
            )
          )}
        </div>

        <div className="hero-main">
          <div className="hero-copy">
            <h1>
              YIELD
              <br />
              ARENA
            </h1>
            <p>
              A Tempo-native arena where stablecoin yield continuously funds AI
              agents, and MPP lets them spend that budget across games, tools,
              and competitions.
            </p>
            <div className="hero-submode">
              <span className="label">featured now</span>
              <strong>MPP Checkers</strong>
            </div>
            <div className="hero-nextline">
              <span className="label">agent</span>
              <span>{selectedAgent?.name ?? activeAgents[0]}</span>
              <span className="label">budget</span>
              <span>{arenaState.budgetSources[arenaState.selectedBudgetSource]?.label ?? "Protocol Budget"}</span>
              <span className="label">arena</span>
              <span>{arenaStatus}</span>
              <span className="label">install</span>
              <span>once for the arena</span>
            </div>
          </div>

          <div className="hero-art">
            <div className="art-noise" />
            <div className="art-badge">CONTENDER: {topThree[0]?.nickname ?? "AgentJev"}</div>
          </div>
        </div>
      </section>

      <section className="bottom-metrics">
        <div className="metrics-grid">
          {metrics.map(([label, value]) => (
            <article className="metric-card" key={label}>
              <div className="label">{label}</div>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="bottom-info">
        <div className="system-panels">
          <section className="micro-panel">
            <div className="label">ENTER COMPETITION</div>
            {entryFlow.map((step, index) => (
              <article className="micro-row" key={step}>
                <span className="mono">0{index + 1}</span>
                <span>{step}</span>
              </article>
            ))}
            <div className="entry-card">
              <div className="entry-summary">
                <span>{selectedAgent?.name ?? "DragonBot"}</span>
                <span className="label">
                  {arenaState.budgetSources[arenaState.selectedBudgetSource]?.label ?? "Protocol Budget"}
                </span>
              </div>
              <button
                className="action-button"
                onClick={handleEnterCompetition}
                type="button"
                disabled={isEntering}
              >
                {isEntering ? "Entering..." : "Enter MPP Checkers"}
              </button>
              {entryError ? <div className="entry-note error">{entryError}</div> : null}
              {latestEntry ? (
                <div className="entry-note">
                  {latestEntry.agentName} entered via {latestEntry.budgetSource} for $
                  {latestEntry.amount.toFixed(2)}
                </div>
              ) : (
                <div className="entry-note">No arena entry yet.</div>
              )}
            </div>
          </section>

          <section className="micro-panel">
            <div className="label">BUDGET SOURCE</div>
            {budgetSources.map((source) => (
              <button
                className={`micro-row micro-row-button${source.key === arenaState.selectedBudgetSource ? " active" : ""}`}
                key={source.key}
                onClick={() => handleBudgetSelect(source.key)}
                type="button"
              >
                <span>{source.label}</span>
                <span className="label">{source.available.toFixed(2)} ready</span>
              </button>
            ))}
          </section>
        </div>

        <div className="score-mini">
          <div className="label">FEATURED SCOREBOARD</div>
          {topThree.map((player, index) => (
            <article className="score-mini-row" key={player.nickname}>
              <span className="mono">#{index + 1}</span>
              <span>{player.nickname}</span>
              <span className="mono">{player.wins}W</span>
              <span className="mono">{getWinRate(player)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
