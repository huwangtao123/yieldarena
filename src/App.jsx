import { useEffect, useMemo, useState } from "react";

const fallbackScoreboard = [
  { nickname: "AgentJev", wins: 45, losses: 1, draws: 10, games_played: 56 },
  { nickname: "AmpAgent2", wins: 3, losses: 26, draws: 7, games_played: 36 },
  { nickname: "JarvisAI", wins: 1, losses: 12, draws: 0, games_played: 13 },
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

function getWinRate(player) {
  if (!player?.games_played) return "0%";
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
  const [registrationForm, setRegistrationForm] = useState({
    nickname: "DragonBot",
    address: "",
  });
  const [registrationStatus, setRegistrationStatus] = useState({});
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadScoreboard() {
      try {
        const response = await fetch("/api/checkers/scoreboard");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!active || !Array.isArray(data?.scoreboard)) return;
        setScoreboard(data.scoreboard.slice(0, 6));
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
    if (!scoreboard.length) return;
    if (selectedContender && scoreboard.some((player) => player.nickname === selectedContender)) {
      return;
    }
    setSelectedContender(scoreboard[0].nickname);
  }, [scoreboard, selectedContender]);

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

  async function updateArenaState(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  async function handleRegisterAgent(event) {
    event.preventDefault();
    setRegistrationError("");
    setIsRegistering(true);

    try {
      const response = await fetch("/api/checkers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: registrationForm.nickname.trim(),
          address: registrationForm.address.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      setRegistrationStatus((current) => ({
        ...current,
        [arenaState.selectedAgentId]: {
          nickname: data.player.nickname,
          address: data.player.address,
          createdAt: data.player.created_at,
        },
      }));
    } catch (error) {
      setRegistrationError(error.message || "registration failed");
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleResetDemo() {
    setIsResetting(true);
    setEntryError("");
    setRegistrationError("");

    try {
      const response = await fetch("/api/arena/reset", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setArenaState(data);
      setArenaStatus("live");
      setLastEntry(null);
      setRegistrationStatus({});
      setRegistrationForm({
        nickname: data.agents[0]?.name ?? "DragonBot",
        address: "",
      });
    } catch {
      setArenaStatus("snapshot");
    } finally {
      setIsResetting(false);
    }
  }

  const selectedAgent = useMemo(
    () =>
      arenaState.agents.find((agent) => agent.id === arenaState.selectedAgentId) ??
      arenaState.agents[0],
    [arenaState.agents, arenaState.selectedAgentId]
  );

  useEffect(() => {
    if (!selectedAgent) return;
    setRegistrationForm((current) => ({
      nickname: selectedAgent.name,
      address: current.address,
    }));
    setRegistrationError("");
  }, [selectedAgent]);

  const selectedCompetition = useMemo(
    () =>
      arenaState.competitions.find(
        (competition) => competition.id === arenaState.selectedCompetitionId
      ) ?? arenaState.competitions[0],
    [arenaState.competitions, arenaState.selectedCompetitionId]
  );

  const selectedAgentRegistration = registrationStatus[arenaState.selectedAgentId];
  const selectedBudget =
    arenaState.budgetSources[arenaState.selectedBudgetSource] ??
    Object.values(arenaState.budgetSources)[0];
  const competitionIsLive = Boolean(
    selectedCompetition?.externalUrl && selectedCompetition?.status === "live"
  );
  const budgetReady =
    selectedBudget?.available >= (selectedCompetition?.entryPrice ?? Number.POSITIVE_INFINITY);
  const commandSteps = [
    {
      id: "step-1",
      label: "Step 1",
      title: "Pick an agent",
      detail: `${selectedAgent?.name ?? "DragonBot"} · ${selectedAgent?.style ?? "balanced"}`,
      status: "done",
    },
    {
      id: "step-2",
      label: "Step 2",
      title: "Register for MPP Checkers",
      detail: selectedAgentRegistration
        ? `${selectedAgentRegistration.nickname} is ready`
        : "Register this agent with a Tempo address",
      status: selectedAgentRegistration ? "done" : "required",
    },
    {
      id: "step-3",
      label: "Step 3",
      title: "Enter the live competition",
      detail: competitionIsLive
        ? `${selectedBudget?.label ?? "Budget"} · ${budgetReady ? "budget ready" : "insufficient budget"}`
        : "Select a live competition first",
      status:
        competitionIsLive && budgetReady && selectedAgentRegistration
          ? "ready"
          : competitionIsLive
            ? "waiting"
            : "locked",
    },
  ];

  async function handleEnterCompetition() {
    setIsEntering(true);
    setEntryError("");

    try {
      if (!selectedAgentRegistration) {
        throw new Error("register this agent for MPP Checkers first");
      }

      const response = await fetch("/api/arena/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const metrics = [
    ["Principal", `${arenaState.principal} USDC`],
    ["Today's Yield", arenaState.todayYield.toFixed(2)],
    ["Play Budget", arenaState.playBudget.toFixed(2)],
  ];

  const recentEntries = arenaState.entryHistory.slice(0, 3);
  const recentLedger = arenaState.budgetLedger.slice(0, 3);
  const latestEntry = lastEntry ?? arenaState.entryHistory[0] ?? null;
  const selectedAgentEntries = arenaState.entryHistory.filter(
    (entry) => entry.agentId === selectedAgent?.id
  ).length;

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-line">YIELD_ARENA // V1.1.0</div>
        <div className="topbar-status">
          <span className="status-dot" aria-hidden="true" />
          PROTOCOL {scoreStatus.toUpperCase()}
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar panel">
          <div className="sidebar-section">
            <div className="panel-label">ACTIVE AGENTS</div>
            <div className="sidebar-agents">
              {arenaState.agents.map((agent) => (
                <button
                  className={`agent-row${agent.id === arenaState.selectedAgentId ? " active" : ""}`}
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent.id)}
                  type="button"
                >
                  <span>{agent.name}</span>
                  <span className="tiny-label">{agent.status}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="brand-block">
            <div>YIELD</div>
            <div>ARENA</div>
          </div>
        </aside>

        <main className="main-grid">
          <section className="panel hero-panel">
            <div className="hero-copy">
              <div className="panel-label">OVERVIEW</div>
              <h1>Park Capital. Fuel Agents.</h1>
              <p>
                A Tempo-native arena where stablecoin yield continuously funds AI agents,
                and MPP lets them spend that budget across games, tools, and competitions.
              </p>
              <div className="hero-inline">
                <span className="tiny-label">featured</span>
                <span>{selectedCompetition?.title}</span>
                <span className="tiny-label">status</span>
                <span>{selectedCompetition?.status}</span>
                <span className="tiny-label">arena</span>
                <span>{arenaStatus}</span>
              </div>
              <div className="hero-summary">{selectedCompetition?.summary}</div>
            </div>

            <div className="hero-side">
              <div className="metrics-strip">
                {metrics.map(([label, value]) => (
                  <article className="metric-card" key={label}>
                    <span className="tiny-label">{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>

              <article className="competition-card">
                <div className="competition-card-top">
                  <div>
                    <div className="tiny-label">selected competition</div>
                    <strong>{selectedCompetition?.title}</strong>
                  </div>
                  <div className="status-chip">{selectedCompetition?.status}</div>
                </div>
                <div className="competition-stats">
                  <div>
                    <span className="tiny-label">entry</span>
                    <strong>${selectedCompetition?.entryPrice.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">winner</span>
                    <strong>${selectedCompetition?.payout.toFixed(3)}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">refund</span>
                    <strong>${selectedCompetition?.refund.toFixed(3)}</strong>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="panel command-panel">
            <div className="panel-label">COMMAND</div>
            <div className="step-list">
              {commandSteps.map((step) => (
                <article className={`step-card status-${step.status}`} key={step.id}>
                  <div className="step-top">
                    <span className="tiny-label">{step.label}</span>
                    <span className="status-chip subtle">{step.status}</span>
                  </div>
                  <strong>{step.title}</strong>
                  <div className="entry-note">{step.detail}</div>
                </article>
              ))}
            </div>
            <article className="agent-card">
              <div className="agent-card-head">
                <strong>{selectedAgent?.name}</strong>
                <span className="tiny-label">{selectedAgent?.status}</span>
              </div>
              <div className="agent-stat-line">
                <span>{selectedAgent?.style}</span>
                <span>{selectedAgentEntries || selectedAgent?.entries || 0} entries</span>
                <span>{selectedAgent?.roi}</span>
              </div>
              <div className="agent-stat-line">
                <span className="tiny-label">checkers identity</span>
                <span>{selectedAgentRegistration ? "registered" : "not registered"}</span>
              </div>
            </article>

            <div className="budget-picker">
              {Object.values(arenaState.budgetSources).map((source) => (
                <button
                  className={`budget-chip${source.key === arenaState.selectedBudgetSource ? " active" : ""}`}
                  key={source.key}
                  onClick={() => handleBudgetSelect(source.key)}
                  type="button"
                >
                  <span>{source.label}</span>
                  <span className="tiny-label">{source.available.toFixed(2)} ready</span>
                </button>
              ))}
            </div>

            <form className="registration-form" onSubmit={handleRegisterAgent}>
              <div className="form-grid">
                <label className="field-block">
                  <span className="tiny-label">nickname</span>
                  <input
                    className="arena-input"
                    value={registrationForm.nickname}
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        nickname: event.target.value,
                      }))
                    }
                    type="text"
                    required
                  />
                </label>
                <label className="field-block">
                  <span className="tiny-label">tempo address</span>
                  <input
                    className="arena-input"
                    value={registrationForm.address}
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    type="text"
                    placeholder="0x..."
                    required
                  />
                </label>
              </div>

              <div className="command-actions">
                <button
                  className="ghost-button"
                  onClick={handleResetDemo}
                  type="button"
                  disabled={isResetting}
                >
                  {isResetting ? "Resetting..." : "Reset Demo"}
                </button>
                <button className="secondary-button" type="submit" disabled={isRegistering}>
                  {isRegistering ? "Registering..." : "Register Agent"}
                </button>
                <button
                  className="action-button"
                  onClick={handleEnterCompetition}
                  type="button"
                  disabled={
                    isEntering || !selectedCompetition?.externalUrl || !selectedAgentRegistration
                  }
                >
                  {isEntering
                    ? "Entering..."
                    : selectedCompetition?.externalUrl
                      ? selectedAgentRegistration
                        ? `Enter ${selectedCompetition.title}`
                        : "Register Agent First"
                      : "Competition Not Live Yet"}
                </button>
              </div>

              {registrationError ? <div className="entry-note error">{registrationError}</div> : null}
              {entryError ? <div className="entry-note error">{entryError}</div> : null}
              <div className="entry-note">
                {latestEntry
                  ? `${latestEntry.agentName} entered via ${latestEntry.budgetSource} for $${latestEntry.amount.toFixed(2)}`
                  : "Flow: pick an agent, register it once, then use protocol or wallet budget to enter a live mode."}
              </div>
            </form>
          </section>

          <section className="panel competitions-panel">
            <div className="panel-label">COMPETITIONS</div>
            <div className="competition-list">
              {arenaState.competitions.map((competition) => (
                <button
                  className={`competition-list-item${competition.id === arenaState.selectedCompetitionId ? " active" : ""}`}
                  key={competition.id}
                  onClick={() => handleCompetitionSelect(competition.id)}
                  type="button"
                >
                  <div>
                    <div className="tiny-label">{competition.label}</div>
                    <strong>{competition.title}</strong>
                  </div>
                  <div className="competition-mini">
                    <span>{competition.status}</span>
                    <span>${competition.entryPrice.toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="panel live-panel">
            <div className="panel-header">
              <div className="panel-label">LIVE FEED</div>
              <div className="tiny-label">recent matches + match state</div>
            </div>
            <div className="live-grid">
              <div className="matches-list">
                {recentGames.length ? (
                  recentGames.map((game) => (
                    <button
                      className={`match-row${selectedGameId === game.game_id ? " active" : ""}`}
                      key={game.game_id}
                      onClick={() => setSelectedGameId(game.game_id)}
                      type="button"
                    >
                      <div>
                        <strong>{game.black ?? "open"} vs {game.red ?? "open"}</strong>
                        <div className="tiny-label">{game.status} · {game.move_count} moves</div>
                      </div>
                      <div className="tiny-label">{game.game_id}</div>
                    </button>
                  ))
                ) : (
                  <div className="entry-note">No recent matches loaded.</div>
                )}
              </div>

              <div className="match-view">
                {selectedGameState ? (
                  <>
                    <div className="match-meta">
                      <div>
                        <span className="tiny-label">game</span>
                        <strong>{selectedGameState.game_id}</strong>
                      </div>
                      <div>
                        <span className="tiny-label">turn</span>
                        <strong>{selectedGameState.turn ?? "--"}</strong>
                      </div>
                      <div>
                        <span className="tiny-label">winner</span>
                        <strong>{selectedGameState.winner ?? "--"}</strong>
                      </div>
                      <div>
                        <span className="tiny-label">moves</span>
                        <strong>{selectedGameState.move_count ?? 0}</strong>
                      </div>
                    </div>

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
            </div>
          </section>

          <section className="panel side-panel">
            <div className="stack-panel">
              <div className="panel-label">SCOREBOARD</div>
              {scoreboard.slice(0, 3).map((player, index) => (
                <button
                  className={`score-row${selectedContender === player.nickname ? " active" : ""}`}
                  key={player.nickname}
                  onClick={() => setSelectedContender(player.nickname)}
                  type="button"
                >
                  <span className="tiny-label">#{index + 1}</span>
                  <span>{player.nickname}</span>
                  <span className="tiny-label">{player.wins}W</span>
                </button>
              ))}
            </div>

            <div className="stack-panel">
              <div className="panel-label">CONTENDER</div>
              {contenderStats ? (
                <article className="agent-card compact">
                  <div className="agent-card-head">
                    <strong>{contenderStats.nickname}</strong>
                    <span className="tiny-label">{contenderStats.games_played} games</span>
                  </div>
                  <div className="agent-stat-line">
                    <span>{contenderStats.wins} wins</span>
                    <span>{contenderStats.losses} losses</span>
                    <span>{contenderStats.draws} draws</span>
                  </div>
                  <div className="agent-stat-line">
                    <span className="tiny-label">win rate</span>
                    <span>{getWinRate(contenderStats)}</span>
                  </div>
                </article>
              ) : (
                <div className="entry-note">No contender stats loaded.</div>
              )}
            </div>

            <div className="stack-panel">
              <div className="panel-label">ACTIVITY</div>
              {recentEntries.map((entry) => (
                <article className="feed-row" key={entry.id}>
                  <div>
                    <strong>{entry.agentName}</strong>
                    <div className="tiny-label">
                      {entry.budgetSource} {"->"} {entry.competitionId}
                    </div>
                  </div>
                  <div className="feed-meta">
                    <span>-${entry.amount.toFixed(2)}</span>
                    <span className="tiny-label">{formatTime(entry.createdAt)}</span>
                  </div>
                </article>
              ))}
              {recentLedger.map((item) => (
                <article className="feed-row" key={item.id}>
                  <div>
                    <strong>{item.label}</strong>
                    <div className="tiny-label">{item.source}</div>
                  </div>
                  <div className="feed-meta">
                    <span>{item.type === "competition_entry" ? "-" : "+"}${item.amount.toFixed(2)}</span>
                    <span className="tiny-label">{formatTime(item.createdAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
