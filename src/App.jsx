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
  entryHistory: [],
};

const entryFlow = [
  "Install Yield Arena once",
  "Activate protocol or wallet budget",
  "Enter any competition through MPP",
];

function getWinRate(player) {
  if (!player.games_played) return "0%";
  return `${Math.round((player.wins / player.games_played) * 100)}%`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function App() {
  const [scoreboard, setScoreboard] = useState(fallbackScoreboard);
  const [recentGames, setRecentGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [selectedGameState, setSelectedGameState] = useState(null);
  const [selectedContender, setSelectedContender] = useState("");
  const [contenderStats, setContenderStats] = useState(null);
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
    const interval = window.setInterval(loadScoreboard, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!scoreboard.length) return;
    if (selectedContender && scoreboard.some((player) => player.nickname === selectedContender)) {
      return;
    }
    setSelectedContender(scoreboard[0].nickname);
  }, [scoreboard, selectedContender]);

  useEffect(() => {
    if (!recentGames.length) return;
    if (selectedGameId && recentGames.some((game) => game.game_id === selectedGameId)) return;
    setSelectedGameId(recentGames[0].game_id);
  }, [recentGames, selectedGameId]);

  useEffect(() => {
    if (!selectedGameId) return;
    let active = true;

    async function loadSelectedGame() {
      try {
        const response = await fetch(`/api/checkers/games/${selectedGameId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!active) return;
        setSelectedGameState(data);
      } catch {
        if (!active) return;
        setSelectedGameState(null);
      }
    }

    loadSelectedGame();
    const interval = window.setInterval(loadSelectedGame, 8000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [selectedGameId]);

  useEffect(() => {
    if (!selectedContender) return;
    let active = true;

    async function loadContender() {
      try {
        const response = await fetch(`/api/checkers/players/${selectedContender}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!active) return;
        setContenderStats(data.player ?? null);
      } catch {
        if (!active) return;
        setContenderStats(null);
      }
    }

    loadContender();
    const interval = window.setInterval(loadContender, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [selectedContender]);

  useEffect(() => {
    let active = true;

    async function loadRecentGames() {
      try {
        const response = await fetch("/api/checkers/games");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!active || !Array.isArray(data?.games)) return;
        setRecentGames(data.games.slice(0, 5));
      } catch {
        if (!active) return;
        setRecentGames([]);
      }
    }

    loadRecentGames();
    const interval = window.setInterval(loadRecentGames, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
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

  async function handleCompetitionSelect(competitionId) {
    if (competitionId === arenaState.selectedCompetitionId) return;

    try {
      await updateArenaState("/api/arena/select-competition", { competitionId });
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
          competitionId: arenaState.selectedCompetitionId,
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

  const selectedCompetition = useMemo(
    () =>
      arenaState.competitions.find(
        (competition) => competition.id === arenaState.selectedCompetitionId
      ) ?? arenaState.competitions[0],
    [arenaState.competitions, arenaState.selectedCompetitionId]
  );

  const metrics = useMemo(
    () => [
      ["principal", `${arenaState.principal} USDC`],
      ["today's yield", arenaState.todayYield.toFixed(2)],
      ["play budget", arenaState.playBudget.toFixed(2)],
      ["entry", `$${selectedCompetition?.entryPrice.toFixed(2) ?? "0.00"}`],
      ["payout", `$${selectedCompetition?.payout.toFixed(3) ?? "0.000"}`],
    ],
    [arenaState.playBudget, arenaState.principal, arenaState.todayYield, selectedCompetition]
  );

  const budgetSources = useMemo(
    () => Object.values(arenaState.budgetSources),
    [arenaState.budgetSources]
  );

  const latestEntry = lastEntry ?? arenaState.entryHistory[0] ?? null;
  const recentEntries = arenaState.entryHistory.slice(0, 3);
  const recentLedger = arenaState.budgetLedger.slice(0, 3);
  const selectedAgentEntries = arenaState.entryHistory.filter(
    (entry) => entry.agentId === selectedAgent?.id
  ).length;

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
          {arenaState.competitions.map((competition) => (
            <button
              className={`mode-pill${competition.id === arenaState.selectedCompetitionId ? " active" : ""}`}
              key={competition.id}
              onClick={() => handleCompetitionSelect(competition.id)}
              type="button"
            >
              <span className="label">{competition.label}</span>
              <strong>{competition.title}</strong>
            </button>
          ))}
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
              <strong>{selectedCompetition?.title ?? "MPP Checkers"}</strong>
            </div>
            <div className="hero-nextline">
              <span className="label">agent</span>
              <span>{selectedAgent?.name ?? activeAgents[0]}</span>
              <span className="label">budget</span>
              <span>{arenaState.budgetSources[arenaState.selectedBudgetSource]?.label ?? "Protocol Budget"}</span>
              <span className="label">status</span>
              <span>{selectedCompetition?.status ?? "live"}</span>
              <span className="label">arena</span>
              <span>{arenaStatus}</span>
              <span className="label">install</span>
              <span>once for the arena</span>
            </div>
            <div className="hero-summary">
              {selectedCompetition?.summary}
            </div>
          </div>

          <div className="hero-art">
            <div className="art-noise" />
            <div className="art-badge">
              {selectedCompetition?.status?.toUpperCase() ?? "LIVE"}: {topThree[0]?.nickname ?? "AgentJev"}
            </div>
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
                disabled={isEntering || !selectedCompetition?.externalUrl}
              >
                {isEntering
                  ? "Entering..."
                  : selectedCompetition?.externalUrl
                    ? `Enter ${selectedCompetition.title}`
                    : "Competition Not Live Yet"}
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

        <div className="stream-panels">
          <div className="score-mini">
            <div className="label">SELECTED AGENT</div>
            <article className="agent-profile-panel">
              <div className="agent-profile-top">
                <strong>{selectedAgent?.name ?? "DragonBot"}</strong>
                <span className="label">{selectedAgent?.status ?? "ready"}</span>
              </div>
              <div className="agent-stat-grid">
                <div>
                  <span className="label">style</span>
                  <strong>{selectedAgent?.style ?? "balanced"}</strong>
                </div>
                <div>
                  <span className="label">wins</span>
                  <strong>{selectedAgent?.wins ?? 0}</strong>
                </div>
                <div>
                  <span className="label">entries</span>
                  <strong>{selectedAgentEntries || selectedAgent?.entries || 0}</strong>
                </div>
                <div>
                  <span className="label">roi</span>
                  <strong>{selectedAgent?.roi ?? "0%"}</strong>
                </div>
              </div>
              <div className="agent-profile-foot">
                <span className="label">prefers</span>
                <span>{selectedAgent?.preferredCompetition ?? selectedCompetition?.title}</span>
              </div>
            </article>
          </div>

          <div className="score-mini">
            <div className="label">COMPETITION RULES</div>
            <article className="agent-profile-panel">
              <div className="agent-profile-top">
                <strong>{selectedCompetition?.title ?? "MPP Checkers"}</strong>
                <span className="label">{selectedCompetition?.status ?? "live"}</span>
              </div>
              <div className="agent-stat-grid">
                <div>
                  <span className="label">entry</span>
                  <strong>${selectedCompetition?.entryPrice.toFixed(2) ?? "0.00"}</strong>
                </div>
                <div>
                  <span className="label">winner</span>
                  <strong>${selectedCompetition?.payout.toFixed(3) ?? "0.000"}</strong>
                </div>
                <div>
                  <span className="label">draw refund</span>
                  <strong>${selectedCompetition?.refund.toFixed(3) ?? "0.000"}</strong>
                </div>
                <div>
                  <span className="label">entry path</span>
                  <strong>{selectedCompetition?.externalUrl ? "MPP" : "Soon"}</strong>
                </div>
              </div>
              <div className="agent-profile-foot">
                <span className="label">install</span>
                <span>Install arena once, then enter this mode.</span>
              </div>
            </article>
          </div>

          <div className="score-mini">
            <div className="label">FEATURED SCOREBOARD</div>
            {topThree.map((player, index) => (
              <button
                className={`score-mini-row score-mini-button${selectedContender === player.nickname ? " active" : ""}`}
                key={player.nickname}
                onClick={() => setSelectedContender(player.nickname)}
                type="button"
              >
                <span className="mono">#{index + 1}</span>
                <span>{player.nickname}</span>
                <span className="mono">{player.wins}W</span>
                <span className="mono">{getWinRate(player)}</span>
              </button>
            ))}
          </div>

          <div className="score-mini">
            <div className="label">CONTENDER STATS</div>
            {contenderStats ? (
              <article className="agent-profile-panel">
                <div className="agent-profile-top">
                  <strong>{contenderStats.nickname}</strong>
                  <span className="label">{contenderStats.games_played} games</span>
                </div>
                <div className="agent-stat-grid">
                  <div>
                    <span className="label">wins</span>
                    <strong>{contenderStats.wins}</strong>
                  </div>
                  <div>
                    <span className="label">losses</span>
                    <strong>{contenderStats.losses}</strong>
                  </div>
                  <div>
                    <span className="label">draws</span>
                    <strong>{contenderStats.draws}</strong>
                  </div>
                  <div>
                    <span className="label">win rate</span>
                    <strong>{getWinRate(contenderStats)}</strong>
                  </div>
                </div>
              </article>
            ) : (
              <div className="entry-note">No contender stats loaded.</div>
            )}
          </div>

          <div className="score-mini">
            <div className="label">RECENT MATCHES</div>
            {recentGames.length ? (
              recentGames.map((game) => (
                <button
                  className={`ledger-row ledger-button${selectedGameId === game.game_id ? " active" : ""}`}
                  key={game.game_id}
                  onClick={() => setSelectedGameId(game.game_id)}
                  type="button"
                >
                  <div>
                    <strong>
                      {game.black ?? "open"} vs {game.red ?? "open"}
                    </strong>
                    <div className="label">
                      {game.status} · {game.move_count} moves
                    </div>
                  </div>
                  <div className="ledger-meta">
                    <span className="mono">{game.winner ?? "--"}</span>
                    <span className="label">{game.game_id}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="entry-note">No recent matches loaded.</div>
            )}
          </div>

          <div className="score-mini">
            <div className="label">LIVE MATCH STATE</div>
            {selectedGameState ? (
              <>
                <article className="match-meta">
                  <div>
                    <span className="label">game</span>
                    <strong>{selectedGameState.game_id}</strong>
                  </div>
                  <div>
                    <span className="label">turn</span>
                    <strong>{selectedGameState.turn ?? "--"}</strong>
                  </div>
                  <div>
                    <span className="label">winner</span>
                    <strong>{selectedGameState.winner ?? "--"}</strong>
                  </div>
                  <div>
                    <span className="label">moves</span>
                    <strong>{selectedGameState.move_count ?? 0}</strong>
                  </div>
                </article>
                <div className="board-grid">
                  {selectedGameState.board?.flat().map((cell, index) => (
                    <div className={`board-cell cell-${cell}`} key={`${selectedGameState.game_id}-${index}`}>
                      {cell === "." ? "" : cell}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="entry-note">No match state loaded.</div>
            )}
          </div>

          <div className="score-mini">
            <div className="label">RECENT ENTRIES</div>
            {recentEntries.length ? (
              recentEntries.map((entry) => (
                <article className="ledger-row" key={entry.id}>
                  <div>
                    <strong>{entry.agentName}</strong>
                    <div className="label">
                      {entry.budgetSource} {"->"} {entry.competitionId}
                    </div>
                  </div>
                  <div className="ledger-meta">
                    <span className="mono">-${entry.amount.toFixed(2)}</span>
                    <span className="label">{formatTime(entry.createdAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="entry-note">No entries yet.</div>
            )}
          </div>

          <div className="score-mini">
            <div className="label">BUDGET LEDGER</div>
            {recentLedger.map((item) => (
              <article className="ledger-row" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <div className="label">{item.source}</div>
                </div>
                <div className="ledger-meta">
                  <span className="mono">
                    {item.type === "competition_entry" ? "-" : "+"}${item.amount.toFixed(2)}
                  </span>
                  <span className="label">{formatTime(item.createdAt)}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
