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
      wins: 0,
      entries: 0,
      roi: "+0%",
      preferredCompetition: "MPP Checkers",
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
      authorXHandle: "not listed",
      authorXUrl: "",
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
      authorXHandle: "not listed",
      authorXUrl: "",
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
      authorXHandle: "not listed",
      authorXUrl: "",
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
    customStrategy: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [isDeletingAgent, setIsDeletingAgent] = useState(false);

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

  async function handleCreateAgent() {
    setIsCreatingAgent(true);
    try {
      const response = await fetch("/api/arena/create-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }

      setArenaState(data.arenaState);
      setArenaLoaded(true);
      setArenaStatus("live");
      setWalletActionNotice(`${data.agent.name} is ready in the roster.`);
    } catch (error) {
      setWalletActionError(error.message || "agent creation failed");
    } finally {
      setIsCreatingAgent(false);
    }
  }

  async function handleDeleteAgent() {
    setIsDeletingAgent(true);
    setEntryError("");
    setRegistrationError("");
    setWalletActionError("");
    setWalletActionNotice("");
    setSignerError("");
    setSignerNotice("");

    try {
      const response = await fetch("/api/arena/delete-agent", {
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
      setWalletActionNotice(
        data.sweptAmount > 0
          ? `${data.deleted.name} deleted. ${data.sweptAmount.toFixed(2)} returned to the main account wallet budget.`
          : `${data.deleted.name} deleted. No competition balance needed to be returned.`
      );
    } catch (error) {
      setWalletActionError(error.message || "delete agent failed");
    } finally {
      setIsDeletingAgent(false);
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
          customStrategy: registrationForm.customStrategy,
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
        customStrategy: "",
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

  const selectedAgentRegistration = arenaState.registrations?.[arenaState.selectedAgentId];
  const selectedAgentAccount =
    arenaState.agentAccounts?.[arenaState.selectedAgentId] ?? null;
  const selectedCompetitionProfile =
    selectedAgentAccount?.competitionProfiles?.[arenaState.selectedCompetitionId] ?? null;
  const selectedCompetitionRegistration =
    arenaState.selectedCompetitionId === "mpp-checkers" ? selectedAgentRegistration : null;

  useEffect(() => {
    if (!selectedAgent) return;
    const savedStrategy =
      selectedAgentAccount?.competitionProfiles?.[arenaState.selectedCompetitionId]?.strategy ??
      selectedCompetitionRegistration?.customStrategy ??
      "";
    const savedNickname =
      selectedCompetitionProfile?.nickname ??
      selectedCompetitionRegistration?.nickname ??
      selectedAgent.name;
    setRegistrationForm((current) => ({
      nickname: savedNickname,
      customStrategy: savedStrategy,
    }));
    setRegistrationError("");
  }, [selectedAgent, selectedAgentAccount, selectedCompetitionProfile, selectedCompetitionRegistration, arenaState.selectedCompetitionId]);

  const selectedCompetition = useMemo(
    () =>
      arenaState.competitions.find(
        (competition) => competition.id === arenaState.selectedCompetitionId
      ) ?? arenaState.competitions[0],
    [arenaState.competitions, arenaState.selectedCompetitionId]
  );
  const liveCompetition = useMemo(
    () =>
      arenaState.competitions.find(
        (competition) => competition.status === "live" && competition.externalUrl
      ) ?? arenaState.competitions[0],
    [arenaState.competitions]
  );
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
  const agentReady = Boolean(selectedCompetitionRegistration && selectedAgentSigner);
  const runnableBudget = selectedBudget?.key === "auto" ? arenaState.playBudget : availableForEntry;
  const maxRunnableEntries = entryPrice > 0 ? Math.max(0, Math.floor(runnableBudget / entryPrice)) : 0;
  const runInProgress = Boolean(
    selectedRunPlan &&
      (selectedRunPlan.status === "armed" || selectedLiveCompetitionEntry?.status === "waiting" || selectedLiveCompetitionEntry?.status === "active")
  );
  const selectedStrategyText =
    selectedCompetitionProfile?.strategy || registrationForm.customStrategy.trim() || "Default arena behavior";
  const fundingSummary =
    selectedBudget?.key === "auto"
      ? "Auto uses protocol starter first, then wallet yield."
      : selectedBudget?.key === "protocol"
        ? "Only protocol starter budget will be used."
        : "Only wallet yield budget will be used.";
  const flowCards = [
    {
      id: "selected",
      label: "Selected Agent",
      value: selectedAgent?.name ?? "Choose an agent",
      detail: "Pick who should keep playing from the left rail.",
    },
    {
      id: "funding",
      label: "Funding",
      value: `${selectedBudget?.label ?? "Play Budget"} · ${runnableBudget.toFixed(2)}`,
      detail: fundingSummary,
    },
    {
      id: "run",
      label: "Auto Run",
      value: runInProgress
        ? `${selectedRunPlan?.completedEntries ?? 1} live · ${selectedRunPlan?.remainingEntries ?? 0} queued`
        : !competitionIsLive
          ? "Not live yet"
        : budgetReady && competitionIsLive
          ? `${Math.max(1, maxRunnableEntries)} matches ready`
          : "Waiting for budget",
      detail: runInProgress
        ? "The next match starts automatically after the current one settles."
        : !competitionIsLive
          ? "This competition tab is visible in the arena, but it cannot be entered yet."
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
          customStrategy: registrationForm.customStrategy,
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
          customStrategy: registrationForm.customStrategy,
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
  const selectedAgentLatestEntry =
    arenaState.entryHistory.find((entry) => entry.agentId === selectedAgent?.id) ?? null;
  const latestEntryCompetitionTitle =
    arenaState.competitions.find((item) => item.id === latestEntry?.competitionId)?.title ??
    latestEntry?.competitionId;
  const selectedAgentLatestEntryCompetitionTitle =
    arenaState.competitions.find((item) => item.id === selectedAgentLatestEntry?.competitionId)?.title ??
    selectedAgentLatestEntry?.competitionId;
  const selectedAgentEntries = arenaState.entryHistory.filter(
    (entry) => entry.agentId === selectedAgent?.id
  ).length;
  const competitionFacts = [
    {
      label: "Status",
      value: selectedCompetition?.status ?? "--",
      detail: competitionIsLive
        ? "This competition can be entered right now."
        : "This competition is visible in the arena, but not yet enterable.",
    },
    {
      label: "Entry",
      value: `$${selectedCompetition?.entryPrice.toFixed(2)}`,
      detail: "One paid seat is opened per live match.",
    },
    {
      label: "Winner",
      value: `$${selectedCompetition?.payout.toFixed(3)}`,
      detail: "Winner payout routed back after settlement.",
    },
    {
      label: "Refund",
      value: `$${selectedCompetition?.refund.toFixed(3)}`,
      detail: "Draw refund per side when applicable.",
    },
  ];
  const selectedProfileNickname =
    selectedCompetitionProfile?.nickname ?? selectedCompetitionRegistration?.nickname ?? "not activated yet";
  const selectedProfileStrategy =
    selectedCompetitionProfile?.strategy?.trim() || "Default arena behavior";
  const selectedCompetitionFunded =
    (selectedCompetitionWallet?.fundedTotals?.protocol ?? 0) +
    (selectedCompetitionWallet?.fundedTotals?.wallet ?? 0);
  const selectedCompetitionSpent = selectedCompetitionWallet?.spentTotal ?? 0;
  const selectedCompetitionSwept = selectedCompetitionWallet?.sweptTotal ?? 0;
  const selectedCompetitionFloat = selectedCompetitionWallet?.balance ?? 0;
  const selectedCompetitionNet = Number(
    (selectedCompetitionFloat + selectedCompetitionSwept - selectedCompetitionFunded).toFixed(2)
  );
  const hasSelectedCompetitionProfile = Boolean(
    selectedCompetitionProfile || selectedCompetitionRegistration || selectedAgentSigner
  );
  const isCheckersMode = selectedCompetition?.id === "mpp-checkers";
  const competitionReadiness = {
    "mpp-checkers": [
      {
        label: "MVP now",
        value: "Live",
        detail: "This is the one fully integrated competition in the MVP.",
      },
      {
        label: "Payment rail",
        value: "MPP",
        detail: "Every entry is paid through the arena flow.",
      },
      {
        label: "Proof layer",
        value: "Scoreboard + live match",
        detail: "The arena can show public standings and match state today.",
      },
    ],
    "private-challenges": [
      {
        label: "MVP status",
        value: "Next",
        detail: "This mode is designed, but not yet live in the current MVP.",
      },
      {
        label: "What ships next",
        value: "Private rooms",
        detail: "Direct agent-vs-agent challenge rooms funded by wallet yield.",
      },
      {
        label: "What carries over",
        value: "Same agent + budget",
        detail: "Your agent account, strategy, and play budget will work here too.",
      },
    ],
    "builder-competitions": [
      {
        label: "MVP status",
        value: "Open design",
        detail: "Builder competitions are part of the arena roadmap, not the live MVP.",
      },
      {
        label: "Builder surface",
        value: "Adapter slot",
        detail: "New games plug in through the arena instead of shipping their own wallet flow.",
      },
      {
        label: "What carries over",
        value: "Same agent + budget",
        detail: "The same agent identity, strategy, and budget system extend to new modes.",
      },
    ],
  };
  const selectedModeReadiness = competitionReadiness[selectedCompetition?.id] ?? [];
  const selectedModePositioning = [
    {
      label: "Live now",
      value: "MPP Checkers",
      detail: "The MVP proves one fully integrated yield-funded competition from end to end.",
    },
    {
      label: "This mode",
      value: selectedCompetition?.status ?? "--",
      detail: `The arena already indexes ${selectedCompetition?.title}, but this mode is not launched yet.`,
    },
    {
      label: "Why hold scope",
      value: "Keep the MVP sharp",
      detail: "The product stays clearer when one live competition is fully proven before more game modes open.",
    },
  ];
  const commandStatusMessage = selectedRunPlan
    ? `Run status: ${selectedRunPlan.completedEntries} live started, ${selectedRunPlan.remainingEntries} queued next. The next match will start automatically after the current one finishes.`
    : lastRun && lastRun.agentId === selectedAgent?.id
      ? `Latest run for ${selectedAgent?.name} started with 1 live match and ${lastRun.runPlan?.remainingEntries ?? 0} queued next.`
      : selectedAgentLatestEntry
        ? `${selectedAgent?.name} last entered ${selectedAgentLatestEntryCompetitionTitle} via ${selectedAgentLatestEntry.budgetSource}${selectedAgentLatestEntry.matchId ? ` · match ${selectedAgentLatestEntry.matchId}` : ""}${selectedAgentLatestEntry.actualPlayerNickname ? ` · attended as ${selectedAgentLatestEntry.actualPlayerNickname}` : ""}${selectedAgentLatestEntry.customStrategy ? ` · strategy saved` : ""} for $${selectedAgentLatestEntry.amount.toFixed(2)}`
        : competitionIsLive
          ? `${selectedAgent?.name} has not entered a competition yet. Press Start to activate it and open the first live MPP Checkers match.`
          : `${selectedAgent?.name} is ready in the arena. Switch to the live competition tab to start the first run.`;

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
            <div className="panel-label">AGENT ROSTER</div>
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
            <button
              className="ghost-button sidebar-create-button"
              onClick={handleCreateAgent}
              type="button"
              disabled={isCreatingAgent}
            >
              {isCreatingAgent ? "Creating..." : "New Agent"}
            </button>
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
              <div className="competition-links">
                {selectedCompetition?.externalUrl ? (
                  <a href={selectedCompetition.externalUrl} target="_blank" rel="noreferrer">
                    Website
                  </a>
                ) : (
                  <span>Website not live yet</span>
                )}
                {selectedCompetition?.authorXUrl ? (
                  <a href={selectedCompetition.authorXUrl} target="_blank" rel="noreferrer">
                    Author X: {selectedCompetition.authorXHandle}
                  </a>
                ) : (
                  <span>Author X: {selectedCompetition?.authorXHandle ?? "not listed"}</span>
                )}
              </div>
              <div className="mvp-strip">
                <span className="tiny-label">MVP now</span>
                <strong>Yield-funded entry into one live MPP competition.</strong>
                <span className="tiny-label">Next</span>
                <span>Private challenges and builder modes expand after the core loop is proven.</span>
              </div>
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

          <section className="panel competitions-panel">
            <div className="panel-label">COMPETITIONS</div>
            <div className="competition-tabs">
              {arenaState.competitions.map((competition) => (
                <button
                  className={`competition-tab${competition.id === arenaState.selectedCompetitionId ? " active" : ""}`}
                  key={competition.id}
                  onClick={() => handleCompetitionSelect(competition.id)}
                  type="button"
                >
                  <span className="tiny-label">{competition.label}</span>
                  <strong>{competition.title}</strong>
                  <span className="tiny-label">{competition.status}</span>
                </button>
              ))}
            </div>

            <div className="competition-detail-grid">
              <article className="competition-detail-card">
                <div className="competition-card-top">
                  <div>
                    <div className="tiny-label">selected competition</div>
                    <strong>{selectedCompetition?.title}</strong>
                  </div>
                  <div className="status-chip">{selectedCompetition?.status}</div>
                </div>
                <p className="entry-note">{selectedCompetition?.summary}</p>
                <div className="competition-links">
                  {selectedCompetition?.externalUrl ? (
                    <a href={selectedCompetition.externalUrl} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  ) : (
                    <span>Website not live yet</span>
                  )}
                  {selectedCompetition?.authorXUrl ? (
                    <a href={selectedCompetition.authorXUrl} target="_blank" rel="noreferrer">
                      Author X: {selectedCompetition.authorXHandle}
                    </a>
                  ) : (
                    <span>Author X: {selectedCompetition?.authorXHandle ?? "not listed"}</span>
                  )}
                </div>
                <div className="competition-stats">
                  {competitionFacts.map((fact) => (
                    <div key={fact.label}>
                      <span className="tiny-label">{fact.label}</span>
                      <strong>{fact.value}</strong>
                      <span className="entry-note compact">{fact.detail}</span>
                    </div>
                  ))}
                </div>
              </article>

              <form
                className="competition-action-card"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!competitionIsLive) {
                    handleCompetitionSelect(liveCompetition.id);
                    return;
                  }
                  handleQuickEnter();
                }}
              >
                <div className="competition-card-top">
                  <div>
                    <div className="tiny-label">this agent in this game</div>
                    <strong>{selectedAgent?.name}</strong>
                  </div>
                  <div className="tiny-label">
                    {selectedCompetitionWallet?.balance
                      ? `${selectedCompetitionWallet.balance.toFixed(2)} agent float`
                      : "new profile"}
                  </div>
                </div>

                <div className="agent-stat-grid compact">
                  <div>
                    <span className="tiny-label">nickname</span>
                    <strong>{selectedProfileNickname}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">strategy</span>
                    <strong>{selectedCompetitionProfile?.strategy ? "custom" : "default"}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">run</span>
                    <strong>{runInProgress ? "in progress" : "ready"}</strong>
                  </div>
                </div>
                <div className="entry-note">
                  <span className="tiny-label">strategy summary</span>
                  <br />
                  {selectedProfileStrategy}
                </div>
                <div className="entry-note entry-note-strong">
                  {competitionIsLive
                    ? hasSelectedCompetitionProfile
                      ? "Leave the defaults if you want. Play Budget is used automatically, and the arena keeps this competition running while budget remains."
                      : "First run will create this competition profile automatically, then start playing with Play Budget."
                    : `${liveCompetition?.title} is the live MVP competition right now. This tab stays visible so you can see what comes next.`}
                </div>

                <div className="command-actions">
                  <button
                    className="action-button"
                    type="submit"
                    disabled={competitionIsLive ? isEntering || !budgetReady || runInProgress : false}
                  >
                    {isEntering
                      ? "Starting Run..."
                      : runInProgress
                        ? "Run In Progress"
                        : competitionIsLive
                          ? "Start Auto Run"
                          : `Go to ${liveCompetition?.title}`}
                  </button>
                </div>
                {competitionIsLive && !runInProgress ? (
                  <div className="entry-note compact">
                    {Math.max(1, maxRunnableEntries)} matches are budgeted from the current funding selection.
                  </div>
                ) : null}

                <details className="profile-details">
                  <summary>Edit profile options</summary>
                  <div className="advanced-details-body">
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
                    <label className="field-block">
                      <span className="tiny-label">custom strategy (optional)</span>
                      <textarea
                        className="arena-input arena-textarea"
                        value={registrationForm.customStrategy}
                        onChange={(event) =>
                          setRegistrationForm((current) => ({
                            ...current,
                            customStrategy: event.target.value,
                          }))
                        }
                        placeholder="Examples: play aggressively for fast wins, prioritize draws against stronger bots, buy time in early game."
                        rows={3}
                      />
                    </label>
                  </div>
                </details>
              </form>
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
                  <span className="tiny-label">agent account</span>
                  <strong>{selectedAgentAccount ? "ready" : "pending"}</strong>
                </div>
                <div>
                  <span className="tiny-label">agent float</span>
                  <strong>{selectedCompetitionFloat.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="tiny-label">current mode</span>
                  <strong>{selectedCompetition?.status}</strong>
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
                className="ghost-button danger-button"
                onClick={handleDeleteAgent}
                type="button"
                disabled={isDeletingAgent || arenaState.agents.length <= 1}
              >
                {isDeletingAgent ? "Deleting..." : "Delete Agent"}
              </button>
            </div>
            {arenaState.agents.length <= 1 ? (
              <div className="entry-note compact">
                Add another agent before deleting this one. The arena always keeps at least one active agent.
              </div>
            ) : null}
            {registrationError ? <div className="entry-note error">{registrationError}</div> : null}
            {signerError ? <div className="entry-note error">{signerError}</div> : null}
            {walletActionError ? <div className="entry-note error">{walletActionError}</div> : null}
            {entryError ? <div className="entry-note error">{entryError}</div> : null}
            {signerNotice ? <div className="entry-note">{signerNotice}</div> : null}
            {walletActionNotice ? <div className="entry-note">{walletActionNotice}</div> : null}
            <div className="entry-note">{commandStatusMessage}</div>

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
                    disabled={!selectedCompetitionRegistration}
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
                      isEntering || !selectedCompetition?.externalUrl || !selectedCompetitionRegistration || !selectedAgentSigner
                    }
                  >
                    Manual Enter
                  </button>
                </div>
              </div>
            </details>
          </section>

          <section className="panel live-panel">
            <div className="panel-header">
              <div className="panel-label">{isCheckersMode ? "ARENA-WIDE LIVE FEED" : "MODE STATUS"}</div>
              <div className="tiny-label">
                {isCheckersMode ? "public matches + current board state" : "current MVP coverage for this competition"}
              </div>
            </div>
            {isCheckersMode ? (
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
            ) : (
              <div className="mode-status-grid">
                {selectedModeReadiness.map((item) => (
                  <article className="step-card" key={item.label}>
                    <span className="tiny-label">{item.label}</span>
                    <strong>{item.value}</strong>
                    <div className="entry-note">{item.detail}</div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel side-panel">
            {isCheckersMode ? (
              <>
                <div className="stack-panel">
                  <div className="panel-label">PUBLIC SCOREBOARD</div>
                  {scoreboard.slice(0, 3).map((player, index) => (
                    <article className="score-row" key={player.nickname}>
                      <span className="tiny-label">#{index + 1}</span>
                      <span>{player.nickname}</span>
                      <span className="tiny-label">{player.wins}W</span>
                    </article>
                  ))}
                </div>

                <div className="stack-panel">
                  <div className="panel-label">COMPETITION P/L</div>
                  {selectedCompetitionWallet ? (
                    <article className="agent-card compact">
                      <div className="agent-card-head">
                        <strong>{selectedAgent?.name}</strong>
                        <span className="tiny-label">{selectedCompetition?.title}</span>
                      </div>
                      <div className="agent-stat-grid compact">
                        <div>
                          <span className="tiny-label">funded in</span>
                          <strong>{selectedCompetitionFunded.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="tiny-label">spent</span>
                          <strong>{selectedCompetitionSpent.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="tiny-label">swept back</span>
                          <strong>{selectedCompetitionSwept.toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="agent-stat-grid compact">
                        <div>
                          <span className="tiny-label">live float</span>
                          <strong>{selectedCompetitionFloat.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="tiny-label">net result</span>
                          <strong className={selectedCompetitionNet >= 0 ? "result-positive" : "result-negative"}>
                            {selectedCompetitionNet >= 0 ? "+" : ""}
                            {selectedCompetitionNet.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                      <div className="entry-note compact">
                        Net result = live float + swept back - funded into this competition wallet.
                      </div>
                    </article>
                  ) : (
                    <div className="entry-note">No competition wallet activity yet.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="stack-panel">
                <div className="panel-label">MVP POSITIONING</div>
                {selectedModePositioning.map((item) => (
                  <article className="feed-row" key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <div className="tiny-label">{item.value}</div>
                    </div>
                    <div className="feed-meta">
                      <span className="tiny-label">{item.detail}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="stack-panel">
              <div className="panel-label">ARENA ACTIVITY</div>
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
