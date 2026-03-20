import { useEffect, useMemo, useState } from "react";

const fallbackScoreboard = [
  { nickname: "AgentJev", wins: 45, losses: 1, draws: 10, games_played: 56 },
  { nickname: "AmpAgent2", wins: 3, losses: 26, draws: 7, games_played: 36 },
  { nickname: "JarvisAI", wins: 1, losses: 12, draws: 0, games_played: 13 },
];

const fallbackArenaState = {
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
  selectedBudgetSource: "auto",
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
    auto: { key: "auto", label: "Play Budget", available: 0.08 },
    protocol: { key: "protocol", label: "Protocol Budget", available: 0.01 },
    wallet: { key: "wallet", label: "Wallet Budget", available: 0.07 },
  },
  fundingLedger: [
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
  competitionWallets: {},
  agentAccounts: {},
  runPlans: {},
  liveCompetitionEntries: {},
  registrations: {},
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
  const [arenaLoaded, setArenaLoaded] = useState(false);
  const [arenaStatus, setArenaStatus] = useState("snapshot");
  const [isEntering, setIsEntering] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [walletActionError, setWalletActionError] = useState("");
  const [walletActionNotice, setWalletActionNotice] = useState("");
  const [signerError, setSignerError] = useState("");
  const [signerNotice, setSignerNotice] = useState("");
  const [lastEntry, setLastEntry] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [registrationForm, setRegistrationForm] = useState({
    nickname: "yieldArenaBot",
  });
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
        setArenaLoaded(true);
        setArenaStatus("live");
      } catch {
        if (!active) return;
        setArenaLoaded(false);
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

  useEffect(() => {
    const hasQueuedRun = Object.values(arenaState.runPlans ?? {}).some(
      (plan) => plan?.status === "armed" && plan?.remainingEntries > 0,
    );

    if (!hasQueuedRun) {
      return undefined;
    }

    let active = true;

    async function advanceRun() {
      try {
        const response = await fetch("/api/arena/advance-run", {
          method: "POST",
        });
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!active) return;
        setArenaState(data.arenaState);
        setArenaLoaded(true);
        setArenaStatus("live");
      } catch {
        if (!active) return;
      }
    }

    const interval = window.setInterval(advanceRun, 8000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [arenaState.runPlans]);

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
    setArenaLoaded(true);
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
    event?.preventDefault?.();
    setRegistrationError("");
    setWalletActionError("");
    setWalletActionNotice("");
    setSignerError("");
    setSignerNotice("");
    setIsRegistering(true);

    try {
      const response = await fetch("/api/arena/register-checkers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: arenaState.selectedAgentId,
          nickname: registrationForm.nickname.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      setArenaState(data.arenaState);
      setArenaLoaded(true);
      setArenaStatus("live");
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
    setWalletActionError("");
    setWalletActionNotice("");
    setSignerError("");
    setSignerNotice("");

    try {
      const response = await fetch("/api/arena/reset", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setArenaState(data);
      setArenaLoaded(true);
      setArenaStatus("live");
      setLastEntry(null);
      setLastRun(null);
      setRegistrationForm({
        nickname: data.agents[0]?.name ?? "yieldArenaBot",
      });
    } catch {
      setArenaLoaded(false);
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

  const selectedAgentRegistration = arenaState.registrations?.[arenaState.selectedAgentId];
  const selectedAgentAccount =
    arenaState.agentAccounts?.[arenaState.selectedAgentId] ?? null;
  const selectedAgentSigner = selectedAgentAccount?.signer ?? null;
  const selectedCompetitionWallet =
    arenaState.competitionWallets?.[
      `${arenaState.selectedAgentId}:${arenaState.selectedCompetitionId}`
    ] ?? null;
  const selectedRunPlan =
    arenaState.runPlans?.[
      `${arenaState.selectedAgentId}:${arenaState.selectedCompetitionId}`
    ] ?? null;
  const selectedLiveCompetitionEntry =
    arenaState.liveCompetitionEntries?.[
      `${arenaState.selectedAgentId}:${arenaState.selectedCompetitionId}`
    ] ?? null;
  const selectedBudget =
    arenaState.budgetSources[arenaState.selectedBudgetSource] ??
    Object.values(arenaState.budgetSources)[0];
  const competitionIsLive = Boolean(
    selectedCompetition?.externalUrl && selectedCompetition?.status === "live"
  );
  const entryPrice = selectedCompetition?.entryPrice ?? 0;
  const availableForEntry = (selectedBudget?.available ?? 0) + (selectedCompetitionWallet?.balance ?? 0);
  const budgetReady = availableForEntry >= entryPrice;
  const agentReady = Boolean(selectedAgentRegistration && selectedAgentSigner);
  const runnableBudget = selectedBudget?.key === "auto" ? arenaState.playBudget : availableForEntry;
  const maxRunnableEntries = entryPrice > 0 ? Math.max(0, Math.floor(runnableBudget / entryPrice)) : 0;
  const runInProgress = Boolean(
    selectedRunPlan &&
      (selectedRunPlan.status === "armed" || selectedLiveCompetitionEntry?.status === "waiting" || selectedLiveCompetitionEntry?.status === "active")
  );
  const fundingSummary =
    selectedBudget?.key === "auto"
      ? "Auto uses protocol starter first, then wallet yield."
      : selectedBudget?.key === "protocol"
        ? "Only protocol starter budget will be used."
        : "Only wallet yield budget will be used.";
  const flowCards = [
    {
      id: "selected",
      label: "1. Selected Agent",
      value: selectedAgent?.name ?? "Choose an agent",
      detail: "Pick who should keep playing from the left rail.",
    },
    {
      id: "funding",
      label: "2. Funding",
      value: `${selectedBudget?.label ?? "Play Budget"} · ${runnableBudget.toFixed(2)}`,
      detail: fundingSummary,
    },
    {
      id: "run",
      label: "3. Auto Run",
      value: runInProgress
        ? `${selectedRunPlan?.completedEntries ?? 1} live · ${selectedRunPlan?.remainingEntries ?? 0} queued`
        : budgetReady && competitionIsLive
          ? `${Math.max(1, maxRunnableEntries)} matches ready`
          : "Waiting for budget",
      detail: runInProgress
        ? "The next match starts automatically after the current one settles."
        : competitionIsLive
          ? `Starts 1 live ${selectedCompetition?.title} match now, then keeps entering until the run budget is exhausted.`
          : "Choose a live competition before starting a run.",
    },
  ];

  async function handleActivateAgent() {
    setIsActivating(true);
    setEntryError("");
    setRegistrationError("");
    setWalletActionError("");
    setWalletActionNotice("");
    setSignerError("");
    setSignerNotice("");

    try {
      const response = await fetch("/api/arena/activate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: arenaState.selectedAgentId,
          nickname: registrationForm.nickname.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      setArenaState(data.arenaState);
      setArenaLoaded(true);
      setArenaStatus("live");
      const requestedNickname = registrationForm.nickname.trim();
      const resolvedNickname = data.registration?.nickname ?? requestedNickname;
      setWalletActionNotice(
        data.activation?.registrationCreated || data.activation?.signerCreated
          ? `Activated ${selectedAgent?.name}. Arena created the competition profile and signer behind the scenes${resolvedNickname !== requestedNickname ? ` as ${resolvedNickname}` : ""}.`
          : `${selectedAgent?.name} is already ready for ${selectedCompetition?.title}.`
      );
    } catch (error) {
      setRegistrationError(error.message || "activation failed");
    } finally {
      setIsActivating(false);
    }
  }

  async function handleQuickEnter() {
    setIsEntering(true);
    setEntryError("");
    setRegistrationError("");
    setWalletActionError("");
    setWalletActionNotice("");
    setSignerError("");
    setSignerNotice("");

    try {
      const response = await fetch("/api/arena/quick-enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: arenaState.selectedAgentId,
          competitionId: arenaState.selectedCompetitionId,
          budgetSource: arenaState.selectedBudgetSource,
          nickname: registrationForm.nickname.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      setArenaState(data.arenaState);
      setArenaLoaded(true);
      setArenaStatus("live");
      setLastEntry(data.entry);
      setLastRun(data.run ?? null);
      if (data.entry?.matchId) {
        setSelectedGameId(data.entry.matchId);
      }
      const requestedNickname = registrationForm.nickname.trim();
      const resolvedNickname = data.registration?.nickname ?? requestedNickname;
      const runSummary = data.run
        ? `1 live now, ${data.run.runPlan?.remainingEntries ?? 0} queued next`
        : `${selectedCompetition?.title}`;
      setWalletActionNotice(
        data.activation?.registrationCreated || data.activation?.signerCreated
          ? `Arena activated ${selectedAgent?.name}${resolvedNickname !== requestedNickname ? ` as ${resolvedNickname}` : ""} and queued ${runSummary}.`
          : `Arena queued ${runSummary}.`
      );
    } catch (error) {
      setEntryError(error.message || "quick enter failed");
    } finally {
      setIsEntering(false);
    }
  }

  async function handleEnterCompetition() {
    setIsEntering(true);
    setEntryError("");
    setWalletActionError("");
    setWalletActionNotice("");
    setSignerError("");
    setSignerNotice("");

    try {
      if (!selectedAgentRegistration) {
        throw new Error("register this agent for MPP Checkers first");
      }

      if (!selectedAgentSigner) {
        throw new Error("provision an agent signer first");
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
      setArenaLoaded(true);
      setArenaStatus("live");
      setLastEntry(data.entry);
      if (data.entry?.matchId) {
        setSelectedGameId(data.entry.matchId);
      }
      setWalletActionNotice(
        data.topUp
          ? `Auto topped up ${data.topUp.amount.toFixed(2)} from ${data.topUp.source} into the competition wallet.`
          : "Competition wallet had enough balance to enter directly."
      );
    } catch (error) {
      setEntryError(error.message || "entry failed");
    } finally {
      setIsEntering(false);
    }
  }

  async function handleTopUpCompetitionWallet() {
    setWalletActionError("");
    setWalletActionNotice("");
    setSignerError("");
    setSignerNotice("");

    try {
      if (!selectedAgentRegistration) {
        throw new Error("register this agent first");
      }

      const response = await fetch("/api/arena/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: arenaState.selectedAgentId,
          competitionId: arenaState.selectedCompetitionId,
          source: arenaState.selectedBudgetSource,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      setArenaState(data.arenaState);
      setArenaLoaded(true);
      setArenaStatus("live");
      setWalletActionNotice(
        `Funded ${data.topUp.amount.toFixed(2)} from ${data.topUp.source} into the competition wallet.`
      );
    } catch (error) {
      setWalletActionError(error.message || "top-up failed");
    }
  }

  async function handleSweepCompetitionWallet() {
    setWalletActionError("");
    setWalletActionNotice("");
    setSignerError("");
    setSignerNotice("");

    try {
      if (!selectedCompetitionWallet?.balance) {
        throw new Error("competition wallet has no balance to sweep");
      }

      const response = await fetch("/api/arena/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: arenaState.selectedAgentId,
          competitionId: arenaState.selectedCompetitionId,
          destination: "wallet",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      setArenaState(data.arenaState);
      setArenaLoaded(true);
      setArenaStatus("live");
      setWalletActionNotice(`Swept ${data.sweep.amount.toFixed(2)} back into wallet budget.`);
    } catch (error) {
      setWalletActionError(error.message || "sweep failed");
    }
  }

  async function handleProvisionSigner() {
    setSignerError("");
    setSignerNotice("");
    setWalletActionError("");
    setWalletActionNotice("");

    try {
      if (!selectedAgentAccount) {
        throw new Error("provision an agent account first");
      }

      const response = await fetch("/api/arena/provision-signer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: arenaState.selectedAgentId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      setArenaState(data.arenaState);
      setArenaLoaded(true);
      setArenaStatus("live");
      setSignerNotice(
        `Provisioned ${data.signer.signatureType} signer with ${data.signer.executionMode} execution mode.`
      );
    } catch (error) {
      setSignerError(error.message || "signer provisioning failed");
    }
  }

  const metrics = [
    ["Principal", `${arenaState.principal} USDC`],
    ["Today's Yield", arenaState.todayYield.toFixed(2)],
    ["Play Budget", arenaState.playBudget.toFixed(2)],
  ];

  const recentEntries = arenaState.entryHistory.slice(0, 3);
  const recentLedger = (arenaState.fundingLedger ?? arenaState.budgetLedger).slice(0, 3);
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
              {flowCards.map((card) => (
                <article className="step-card" key={card.id}>
                  <span className="tiny-label">{card.label}</span>
                  <strong>{card.value}</strong>
                  <div className="entry-note">{card.detail}</div>
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
              <div className="agent-stat-grid compact">
                <div>
                  <span className="tiny-label">competition profile</span>
                  <strong>{selectedAgentRegistration?.nickname ?? "not activated yet"}</strong>
                </div>
                <div>
                  <span className="tiny-label">agent account</span>
                  <strong>{selectedAgentAccount ? "ready" : "pending"}</strong>
                </div>
                <div>
                  <span className="tiny-label">agent float</span>
                  <strong>{(selectedCompetitionWallet?.balance ?? 0).toFixed(2)}</strong>
                </div>
              </div>
              {selectedRunPlan ? (
                <div className="agent-stat-grid compact">
                  <div>
                    <span className="tiny-label">run status</span>
                    <strong>{selectedRunPlan.status}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">live now</span>
                    <strong>{selectedRunPlan.completedEntries}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">queued next</span>
                    <strong>{selectedRunPlan.remainingEntries}</strong>
                  </div>
                </div>
              ) : null}
              {selectedLiveCompetitionEntry ? (
                <div className="agent-stat-grid">
                  <div>
                    <span className="tiny-label">live match</span>
                    <strong>{selectedLiveCompetitionEntry.gameId}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">color</span>
                    <strong>{selectedLiveCompetitionEntry.color}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">attends as</span>
                    <strong>{selectedLiveCompetitionEntry.payerNickname ?? "pending"}</strong>
                  </div>
                </div>
              ) : null}
            </article>

            <form
              className="registration-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleQuickEnter();
              }}
            >
              <label className="field-block">
                <span className="tiny-label">competition nickname (optional)</span>
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
              <div className="entry-note entry-note-strong">
                Leave the default nickname if you want. Play Budget is used automatically, and the arena keeps the run going while budget remains.
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
                <button
                  className="action-button"
                  type="submit"
                  disabled={isEntering || !competitionIsLive || !budgetReady || runInProgress}
                >
                  {isEntering
                    ? "Starting Run..."
                    : runInProgress
                      ? "Run In Progress"
                      : competitionIsLive
                        ? `Start ${Math.max(1, maxRunnableEntries)}-Match Auto Run`
                        : "Competition Not Live"}
                </button>
              </div>

              {registrationError ? <div className="entry-note error">{registrationError}</div> : null}
              {signerError ? <div className="entry-note error">{signerError}</div> : null}
              {walletActionError ? <div className="entry-note error">{walletActionError}</div> : null}
              {entryError ? <div className="entry-note error">{entryError}</div> : null}
              {signerNotice ? <div className="entry-note">{signerNotice}</div> : null}
              {walletActionNotice ? <div className="entry-note">{walletActionNotice}</div> : null}
              <div className="entry-note">
                {selectedRunPlan
                    ? `Run status: ${selectedRunPlan.completedEntries} live started, ${selectedRunPlan.remainingEntries} queued next. The next match will start automatically after the current one finishes.`
                  : lastRun
                    ? `Latest run started with 1 live match and ${lastRun.runPlan?.remainingEntries ?? 0} queued next.`
                    : latestEntry
                      ? `${latestEntry.agentName} entered via ${latestEntry.budgetSource}${latestEntry.matchId ? ` · match ${latestEntry.matchId}` : ""}${latestEntry.actualPlayerNickname ? ` · attended as ${latestEntry.actualPlayerNickname}` : ""} for $${latestEntry.amount.toFixed(2)}`
                    : "Pick an agent and press Start. Yield Arena handles activation, signer setup, and run funding automatically."}
              </div>

              <details className="advanced-details">
                <summary>Show protocol details and funding override</summary>
                <div className="advanced-details-body">
                  <div className="entry-note">
                    Target model: owner vaults fund the agent account, then the agent account spends into competitions. Today the live MPP join still executes through the owner signer.
                  </div>
                  <div className="field-block">
                    <span className="tiny-label">funding override</span>
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
                  </div>
                  <div className="agent-stat-line stacked">
                    <span className="tiny-label">owner account</span>
                    <span>{arenaState.mainLoginWallet.address}</span>
                  </div>
                  {selectedAgentAccount ? (
                    <div className="agent-stat-line stacked">
                      <span className="tiny-label">agent account address</span>
                      <span>{selectedAgentAccount.address}</span>
                    </div>
                  ) : null}
                  {selectedAgentAccount ? (
                    <div className="agent-stat-grid">
                      <div>
                        <span className="tiny-label">signer status</span>
                        <strong>{selectedAgentAccount.signerStatus}</strong>
                      </div>
                      <div>
                        <span className="tiny-label">execution mode</span>
                        <strong>{selectedAgentAccount.executionMode}</strong>
                      </div>
                      <div>
                        <span className="tiny-label">account type</span>
                        <strong>{selectedAgentAccount.accountType}</strong>
                      </div>
                    </div>
                  ) : null}
                  {selectedAgentSigner ? (
                    <div className="agent-stat-grid">
                      <div>
                        <span className="tiny-label">signer key</span>
                        <strong>{selectedAgentSigner.keyId}</strong>
                      </div>
                      <div>
                        <span className="tiny-label">expiry</span>
                        <strong>{selectedAgentSigner.expiry?.slice(0, 10) ?? "--"}</strong>
                      </div>
                      <div>
                        <span className="tiny-label">allowed</span>
                        <strong>{selectedAgentSigner.allowedCompetitions?.join(", ") ?? "--"}</strong>
                      </div>
                    </div>
                  ) : null}
                  {selectedCompetitionWallet ? (
                    <div className="agent-stat-grid">
                      <div>
                        <span className="tiny-label">funded by protocol</span>
                        <strong>{(selectedCompetitionWallet.fundedTotals?.protocol ?? 0).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="tiny-label">funded by wallet</span>
                        <strong>{(selectedCompetitionWallet.fundedTotals?.wallet ?? 0).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="tiny-label">spent total</span>
                        <strong>{(selectedCompetitionWallet.spentTotal ?? 0).toFixed(2)}</strong>
                      </div>
                    </div>
                  ) : null}
                  <div className="command-actions">
                    <button
                      className="secondary-button"
                      onClick={handleActivateAgent}
                      type="button"
                      disabled={isActivating}
                    >
                      {isActivating ? "Activating..." : `Prepare ${selectedAgent?.name ?? "Agent"}`}
                    </button>
                    <button className="secondary-button" onClick={handleRegisterAgent} type="button" disabled={isRegistering}>
                      {isRegistering ? "Creating..." : "Manual Register"}
                    </button>
                    <button
                      className="secondary-button"
                      onClick={handleProvisionSigner}
                      type="button"
                      disabled={!selectedAgentAccount}
                    >
                      Manual Signer
                    </button>
                    <button
                      className="secondary-button"
                      onClick={handleTopUpCompetitionWallet}
                      type="button"
                      disabled={!selectedAgentRegistration}
                    >
                      Top Up Wallet
                    </button>
                    <button
                      className="ghost-button"
                      onClick={handleSweepCompetitionWallet}
                      type="button"
                      disabled={!selectedCompetitionWallet?.balance}
                    >
                      Sweep Back
                    </button>
                    <button
                      className="ghost-button"
                      onClick={handleEnterCompetition}
                      type="button"
                      disabled={
                        isEntering || !selectedCompetition?.externalUrl || !selectedAgentRegistration || !selectedAgentSigner
                      }
                    >
                      Manual Enter
                    </button>
                  </div>
                </div>
              </details>
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
