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
      todayYield: 0.02,
      availableAllowance: 0.02,
      lifetimeFunded: 0,
      withdrawablePrincipal: 100,
    },
  },
  principal: 100,
  todayYield: 0.02,
  playBudget: 0.03,
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
    auto: { key: "auto", label: "Play Budget", available: 0.03 },
    protocol: { key: "protocol", label: "Protocol Budget", available: 0.01 },
    wallet: { key: "wallet", label: "Wallet Budget", available: 0.02 },
  },
  fundingLedger: [
    {
      id: "ledger-yield-refresh",
      type: "yield_refresh",
      label: "Daily yield refreshed",
      source: "wallet",
      amount: 0.02,
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
      amount: 0.02,
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

function formatFeedbackFailure(reason, nextStep) {
  return `Why failed: ${reason}. What to do next: ${nextStep}`;
}

function formatFeedbackSuccess(summary, { amount = 0, source = "none", remaining = 0, nextStep = "" } = {}) {
  const parts = [
    `Success: ${summary}.`,
    `Amount: $${amount.toFixed(2)}.`,
    `Source: ${source}.`,
    `Remaining play budget: $${remaining.toFixed(2)}.`,
  ];

  if (nextStep) {
    parts.push(`Next: ${nextStep}`);
  }

  return parts.join(" ");
}

function resolveFundingSource(sourceKey) {
  if (sourceKey === "auto") {
    return "protocol/wallet";
  }

  return sourceKey || "wallet";
}

function getFailureNextStep(reason, fallback) {
  const normalized = String(reason ?? "").toLowerCase();

  if (normalized.includes("insufficient budget")) {
    return "Switch to a funded source or wait for more yield.";
  }

  if (normalized.includes("not live")) {
    return "Switch back to the live competition tab.";
  }

  if (normalized.includes("nickname")) {
    return "Edit the nickname and try again.";
  }

  if (normalized.includes("run already in progress")) {
    return "Wait for the current live match to settle before starting another run.";
  }

  if (normalized.includes("real agent account sweep is not available yet")) {
    return "Leave the float in place for now. Real agent entry works, but real agent sweep still needs a dedicated transfer path.";
  }

  if (normalized.includes("register")) {
    return "Use Start Auto Run so the arena can prepare the profile automatically.";
  }

  if (normalized.includes("signer")) {
    return "Use Start Auto Run so the arena can prepare the signer automatically.";
  }

  return fallback;
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
  const [queryView, setQueryView] = useState("live-agents");

  const clearFeedback = () => {
    setEntryError("");
    setRegistrationError("");
    setWalletActionError("");
    setWalletActionNotice("");
    setSignerError("");
    setSignerNotice("");
  };

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
    clearFeedback();
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
      setWalletActionNotice(
        formatFeedbackSuccess(`${data.agent.name} is ready in the roster`, {
          amount: 0,
          source: resolveFundingSource(arenaState.selectedBudgetSource),
          remaining: data.arenaState.playBudget,
          nextStep: "Select a live competition and press Start Auto Run.",
        }),
      );
    } catch (error) {
      setWalletActionError(
        formatFeedbackFailure(
          error.message || "agent creation failed",
          getFailureNextStep(error.message, "Try creating the agent again."),
        ),
      );
    } finally {
      setIsCreatingAgent(false);
    }
  }

  async function handleDeleteAgent() {
    setIsDeletingAgent(true);
    clearFeedback();

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
        formatFeedbackSuccess(
          data.sweptAmount > 0
            ? `${data.deleted.name} deleted and remaining balance returned to the main account`
            : `${data.deleted.name} deleted with no remaining balance to return`,
          {
            amount: data.sweptAmount ?? 0,
            source: "wallet",
            remaining: data.arenaState.playBudget,
            nextStep: "Choose the next agent and continue from Start Auto Run.",
          },
        ),
      );
    } catch (error) {
      setWalletActionError(
        formatFeedbackFailure(
          error.message || "delete agent failed",
          getFailureNextStep(error.message, "Keep at least one agent in the roster, then try again."),
        ),
      );
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
    clearFeedback();
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
      setWalletActionNotice(
        formatFeedbackSuccess(`Registered ${data.registration?.nickname ?? registrationForm.nickname.trim()} for ${selectedCompetition?.title}`, {
          amount: 0,
          source: resolveFundingSource(arenaState.selectedBudgetSource),
          remaining: data.arenaState.playBudget,
          nextStep: "Use Start Auto Run to let the arena fund entry automatically.",
        }),
      );
    } catch (error) {
      setRegistrationError(
        formatFeedbackFailure(
          error.message || "registration failed",
          getFailureNextStep(error.message, "Edit the nickname and try again."),
        ),
      );
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleResetDemo() {
    setIsResetting(true);
    clearFeedback();

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
  const competitionById = useMemo(
    () =>
      Object.fromEntries(
        (arenaState.competitions ?? []).map((competition) => [competition.id, competition]),
      ),
    [arenaState.competitions]
  );
  const liveCompetition = useMemo(
    () =>
      arenaState.competitions.find(
        (competition) => competition.status === "live" && competition.externalUrl
      ) ?? arenaState.competitions[0],
    [arenaState.competitions]
  );
  useEffect(() => {
    if (!arenaLoaded || !liveCompetition?.id) return;
    if (arenaState.selectedCompetitionId === liveCompetition.id) return;
    handleCompetitionSelect(liveCompetition.id);
  }, [arenaLoaded, arenaState.selectedCompetitionId, liveCompetition?.id]);
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
  const liveMatchActive = selectedLiveCompetitionEntry?.status === "active";
  const selectedStrategyText =
    selectedCompetitionProfile?.strategy || registrationForm.customStrategy.trim() || "Default arena behavior";
  const budgetSourceLabel = selectedBudget?.key === "auto" ? "protocol/wallet" : selectedBudget?.key ?? "none";
  const primaryActionLabel = isEntering
    ? "Starting Run..."
    : runInProgress
      ? "Run In Progress"
      : "Start Auto Run";
  const feedbackError = registrationError || signerError || walletActionError || entryError;
  const feedbackSuccess = feedbackError ? "" : signerNotice || walletActionNotice;
  const flowCards = [
    {
      id: "activate",
      label: "1. Activate",
      value: agentReady ? "Ready" : "Needed",
      detail: "Arena provisions the agent account, nickname, and signer automatically.",
    },
    {
      id: "fund",
      label: "2. Fund",
      value: budgetReady ? `$${runnableBudget.toFixed(2)} ready` : "Need yield",
      detail: "Principal stays withdrawable. Only Playable Yield is routed into spendable budget.",
    },
    {
      id: "enter",
      label: "3. Enter",
      value: selectedLiveCompetitionEntry?.gameId
        ? `Match ${selectedLiveCompetitionEntry.gameId}`
        : "Ready",
      detail: "The arena routes wallet, signer, budget, and competition entry in one step.",
    },
    {
      id: "auto-run",
      label: "4. Auto-Run",
      value: runInProgress
        ? liveMatchActive
          ? "Live"
          : "Continuing"
        : budgetReady
          ? "Ready"
          : "Waiting",
      detail: runInProgress
        ? "The arena keeps the agent playing while Playable Yield remains."
        : "After entry, the arena keeps the agent playing while Playable Yield remains.",
    },
  ];

  async function handleActivateAgent() {
    setIsActivating(true);
    clearFeedback();

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
        formatFeedbackSuccess(
          data.activation?.registrationCreated || data.activation?.signerCreated
            ? `Activated ${selectedAgent?.name}${resolvedNickname !== requestedNickname ? ` as ${resolvedNickname}` : ""}`
            : `${selectedAgent?.name} is already ready for ${selectedCompetition?.title}`,
          {
            amount: 0,
            source: resolveFundingSource(arenaState.selectedBudgetSource),
            remaining: data.arenaState.playBudget,
            nextStep: "Press Start Auto Run to fund and enter the live competition.",
          },
        ),
      );
    } catch (error) {
      setRegistrationError(
        formatFeedbackFailure(
          error.message || "activation failed",
          getFailureNextStep(error.message, "Edit the profile options and try again."),
        ),
      );
    } finally {
      setIsActivating(false);
    }
  }

  async function handleQuickEnter() {
    setIsEntering(true);
    clearFeedback();

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
        : "the live competition";
      setWalletActionNotice(
        formatFeedbackSuccess(
          data.activation?.registrationCreated || data.activation?.signerCreated
            ? `Activated ${selectedAgent?.name}${resolvedNickname !== requestedNickname ? ` as ${resolvedNickname}` : ""} and queued ${runSummary}`
            : `Queued ${runSummary}`,
          {
            amount: data.entry?.amount ?? 0,
            source: data.entry?.budgetSource ?? budgetSourceLabel,
            remaining: data.arenaState.playBudget,
            nextStep: "Watch the live feed while the arena continues the run automatically.",
          },
        ),
      );
    } catch (error) {
      setEntryError(
        formatFeedbackFailure(
          error.message || "quick enter failed",
          getFailureNextStep(error.message, "Stay on the live competition and try Start Auto Run again."),
        ),
      );
    } finally {
      setIsEntering(false);
    }
  }

  async function handleEnterCompetition() {
    setIsEntering(true);
    clearFeedback();

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
        formatFeedbackSuccess("Entered the live competition", {
          amount: data.entry?.amount ?? 0,
          source: data.entry?.budgetSource ?? budgetSourceLabel,
          remaining: data.arenaState.playBudget,
          nextStep: "Wait for the auto-run loop to continue the match.",
        }),
      );
    } catch (error) {
      setEntryError(
        formatFeedbackFailure(
          error.message || "entry failed",
          getFailureNextStep(error.message, "Use Start Auto Run so the arena can handle activation and entry together."),
        ),
      );
    } finally {
      setIsEntering(false);
    }
  }

  async function handleTopUpCompetitionWallet() {
    clearFeedback();

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
        formatFeedbackSuccess("Funded the competition wallet", {
          amount: data.topUp.amount,
          source: data.topUp.source,
          remaining: data.arenaState.playBudget,
          nextStep: "Return to the main Start Auto Run flow when you are ready.",
        }),
      );
    } catch (error) {
      setWalletActionError(
        formatFeedbackFailure(
          error.message || "top-up failed",
          getFailureNextStep(error.message, "Switch to a funded source or wait for more yield."),
        ),
      );
    }
  }

  async function handleSweepCompetitionWallet() {
    clearFeedback();

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
      setWalletActionNotice(
        formatFeedbackSuccess("Swept competition float back into the wallet budget", {
          amount: data.sweep.amount,
          source: "wallet",
          remaining: data.arenaState.playBudget,
          nextStep: "Return to Start Auto Run if you want to continue playing.",
        }),
      );
    } catch (error) {
      setWalletActionError(
        formatFeedbackFailure(
          error.message || "sweep failed",
          getFailureNextStep(error.message, "Only sweep after the competition wallet has a remaining balance."),
        ),
      );
    }
  }

  async function handleProvisionSigner() {
    clearFeedback();

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
      setWalletActionNotice(
        formatFeedbackSuccess("Provisioned the agent signer", {
          amount: 0,
          source: resolveFundingSource(arenaState.selectedBudgetSource),
          remaining: data.arenaState.playBudget,
          nextStep: "Use Start Auto Run so the arena can enter the live competition.",
        }),
      );
    } catch (error) {
      setSignerError(
        formatFeedbackFailure(
          error.message || "signer provisioning failed",
          getFailureNextStep(error.message, "Use Start Auto Run so the arena can provision the signer automatically."),
        ),
      );
    }
  }

  const metrics = [
    ["Principal (withdrawable)", `${arenaState.vaults.wallet.withdrawablePrincipal} fxSAVE`],
    ["Playable Yield", `$${arenaState.playBudget.toFixed(2)}`],
    ["Agent Auto-Run", runInProgress ? "live" : "arena-managed"],
  ];

  const latestEntry = lastEntry ?? arenaState.entryHistory[0] ?? null;
  const selectedAgentLatestEntry =
    arenaState.entryHistory.find((entry) => entry.agentId === selectedAgent?.id) ?? null;
  const selectedAgentEntries = arenaState.entryHistory.filter(
    (entry) => entry.agentId === selectedAgent?.id
  ).length;
  const latestRunResultMessage = feedbackError
    ? feedbackError
    : feedbackSuccess
      ? feedbackSuccess
      : selectedAgentLatestEntry
        ? formatFeedbackSuccess("Latest completed entry", {
            amount: selectedAgentLatestEntry.amount ?? 0,
            source: selectedAgentLatestEntry.budgetSource ?? "wallet",
            remaining: arenaState.playBudget,
            nextStep: "Press Start Auto Run again to open the next match.",
          })
        : "No run yet. Press Start Auto Run to activate the agent, fund the entry, and start the first live match.";
  const competitionFacts = [
    {
      label: "Status",
      value: selectedCompetition?.status ?? "--",
      detail: "This is the one live competition in the current MVP.",
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
  const liveAgentResults = useMemo(() => {
    const liveEntries = Object.values(arenaState.liveCompetitionEntries ?? {});

    return arenaState.agents
      .map((agent) => {
        const account = arenaState.agentAccounts?.[agent.id] ?? null;
        const liveEntry =
          liveEntries.find(
            (entry) =>
              entry.agentId === agent.id && (entry.status === "waiting" || entry.status === "active"),
          ) ?? null;
        const entries = arenaState.entryHistory.filter((entry) => entry.agentId === agent.id);
        const lastEntry = entries[0] ?? null;
        const balance = Number(account?.balance ?? 0);
        const totalEntries = entries.length;

        if (!liveEntry && balance <= 0 && totalEntries === 0) {
          return null;
        }

        return {
          id: agent.id,
          name: agent.name,
          competition: liveEntry?.competitionId ?? lastEntry?.competitionId ?? "arena",
          status: liveEntry ? liveEntry.status : balance > 0 ? "funded" : "played",
          balance,
          totalEntries,
          lastSeenAt: liveEntry?.joinedAt ?? lastEntry?.createdAt ?? null,
          isLive: Boolean(liveEntry),
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (left.isLive !== right.isLive) return Number(right.isLive) - Number(left.isLive);
        if (left.balance !== right.balance) return right.balance - left.balance;
        if (left.totalEntries !== right.totalEntries) return right.totalEntries - left.totalEntries;
        return left.name.localeCompare(right.name);
      });
  }, [arenaState.agentAccounts, arenaState.agents, arenaState.entryHistory, arenaState.liveCompetitionEntries]);
  const historyResults = useMemo(
    () =>
      arenaState.entryHistory.slice(0, 8).map((entry) => ({
        id: entry.id,
        name: entry.agentName,
        competition: entry.competitionId,
        source: entry.budgetSource,
        amount: entry.amount,
        createdAt: entry.createdAt,
        matchId: entry.matchId,
      })),
    [arenaState.entryHistory],
  );
  const hasSelectedCompetitionProfile = Boolean(
    selectedCompetitionProfile || selectedCompetitionRegistration || selectedAgentSigner
  );
  const agentRosterItems = useMemo(() => {
    const liveEntries = Object.values(arenaState.liveCompetitionEntries ?? {});

    return arenaState.agents
      .map((agent) => {
        const agentAccount = arenaState.agentAccounts?.[agent.id] ?? null;
        const entryCount = arenaState.entryHistory.filter((entry) => entry.agentId === agent.id).length;
        const liveEntry =
          liveEntries.find(
            (entry) =>
              entry.agentId === agent.id && (entry.status === "waiting" || entry.status === "active"),
          ) ?? null;
        const balance = Number(agentAccount?.balance ?? 0);
        const activeCompetitionTitle =
          competitionById[liveEntry?.competitionId ?? ""]?.title ?? "Arena";

        let badge = "new";
        if (liveEntry) {
          badge = "live";
        } else if (balance > 0) {
          badge = "funded";
        } else if (entryCount > 0) {
          badge = "played";
        } else if (agentAccount) {
          badge = "ready";
        }

        return {
          agent,
          badge,
          isLive: Boolean(liveEntry),
          entryCount,
          balance,
          activityLabel: liveEntry
            ? `${activeCompetitionTitle} · ${liveEntry.status}`
            : entryCount > 0
              ? "played in arena"
              : "new to arena",
          summaryLabel:
            entryCount > 0 || balance > 0
              ? [
                  entryCount > 0 ? `${entryCount} ${entryCount === 1 ? "entry" : "entries"}` : null,
                  balance > 0 ? `$${balance.toFixed(2)} float` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "no float yet",
        };
      })
      .sort((left, right) => {
        if (left.isLive !== right.isLive) return Number(right.isLive) - Number(left.isLive);
        if ((left.balance > 0) !== (right.balance > 0)) return Number(right.balance > 0) - Number(left.balance > 0);
        if (left.entryCount !== right.entryCount) return right.entryCount - left.entryCount;
        return left.agent.name.localeCompare(right.agent.name);
      });
  }, [
    arenaState.agents,
    arenaState.agentAccounts,
    arenaState.entryHistory,
    arenaState.liveCompetitionEntries,
    competitionById,
  ]);
  const commandStatusMessage = selectedLiveCompetitionEntry && liveMatchActive
    ? `Live now in match ${selectedLiveCompetitionEntry.gameId}. The arena will keep playing while Playable Yield remains.${selectedLiveCompetitionEntry.lastMove ? ` Last move: ${selectedLiveCompetitionEntry.lastMove.from} → ${selectedLiveCompetitionEntry.lastMove.to}.` : ""}`
    : selectedRunPlan
      ? "Run is active. The arena will keep opening the next match while Playable Yield remains."
      : lastRun && lastRun.agentId === selectedAgent?.id
        ? "Run completed. Start Auto Run again whenever you want the arena to open the next set of matches."
        : selectedAgentLatestEntry
          ? `Ready for another run. The last entry spent $${selectedAgentLatestEntry.amount.toFixed(2)} from ${selectedAgentLatestEntry.budgetSource} budget.`
          : "Press Start Auto Run. The arena will activate the agent, route Playable Yield, enter the live competition, and keep running automatically.";

  function handlePrimaryAction() {
    handleQuickEnter();
  }

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
              {agentRosterItems.map(({ agent, badge, activityLabel, summaryLabel, isLive }) => (
                <button
                  className={`agent-row${agent.id === arenaState.selectedAgentId ? " active" : ""}`}
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent.id)}
                  type="button"
                >
                  <div className="agent-row-copy">
                    <div className="agent-row-head">
                      <strong>{agent.name}</strong>
                      <span className={`agent-row-badge${isLive ? " is-live" : ""}`}>{badge}</span>
                    </div>
                    <div className="agent-row-sub">
                      <span>{activityLabel}</span>
                      <span>{summaryLabel}</span>
                    </div>
                  </div>
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
              <div className="hero-kicker">
                <span>Principal Safe</span>
                <span>Yield Spend</span>
                <span>Arena Auto-Run</span>
              </div>
              <h1>
                <span>Park Principal.</span>
                <span>Run Agents on Yield.</span>
              </h1>
              <p className="hero-subheadline">
                fxSAVE principal stays withdrawable. Yield Arena converts only yield into playable
                budget, then handles agent activation, entry, and repeat auto-runs across live competitions.
              </p>
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

              <article className="competition-card hero-route-card">
                <div className="competition-card-top">
                  <div>
                    <div className="tiny-label">Funding Route</div>
                    <strong>fxSAVE principal stays parked. Agents spend yield.</strong>
                  </div>
                  <div className="status-chip">{arenaStatus}</div>
                </div>
                <div className="hero-route-steps">
                  <div className="route-step">
                    <span className="tiny-label">1</span>
                    <strong>Park Principal</strong>
                  </div>
                  <div className="route-step">
                    <span className="tiny-label">2</span>
                    <strong>Mint Yield</strong>
                  </div>
                  <div className="route-step">
                    <span className="tiny-label">3</span>
                    <strong>Fund Agent</strong>
                  </div>
                  <div className="route-step">
                    <span className="tiny-label">4</span>
                    <strong>Run Competition</strong>
                  </div>
                </div>
                <div className="entry-note compact">
                  Principal remains withdrawable. Only yield becomes spendable competition budget.
                </div>
              </article>
            </div>
          </section>

          <section className="panel competitions-panel">
            <div className="panel-header">
              <div className="panel-label">LIVE COMPETITION</div>
              <div className="tiny-label">one live competition for the current MVP</div>
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

              <article className="competition-action-card">
                <div className="competition-card-top">
                  <div>
                    <div className="tiny-label">current setup</div>
                    <strong>{selectedAgent?.name} in {selectedCompetition?.title}</strong>
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
                    <strong>{runInProgress ? (liveMatchActive ? "live" : "continuing") : "ready"}</strong>
                  </div>
                </div>
                <div className="entry-note">
                  <span className="tiny-label">strategy summary</span>
                  <br />
                  {selectedProfileStrategy}
                </div>
                <div className="entry-note entry-note-strong">
                  {hasSelectedCompetitionProfile
                    ? "This competition is ready. The arena will handle activation, funding, entry, and auto-run."
                    : "First run will create the competition profile automatically, then continue with Playable Yield."}
                </div>

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
              </article>
            </div>
          </section>

          <section className="panel command-panel">
            <div className="panel-header">
              <div className="panel-label">COMMAND</div>
              <div className="tiny-label">one flow: activate, fund, enter, auto-run</div>
            </div>
            <div className="command-grid">
              <div className="step-list">
                {flowCards.map((card) => (
                  <article className="step-card" key={card.id}>
                    <div className="step-top">
                      <span className="tiny-label">{card.label}</span>
                      <span
                        className={`status-chip subtle ${["Ready", "Live", "Continuing"].includes(card.value) ? "status-ready" : ""}`}
                      >
                        {card.value}
                      </span>
                    </div>
                    <strong>{card.value}</strong>
                    <div className="entry-note">{card.detail}</div>
                  </article>
                ))}
              </div>

              <article className="agent-card command-card">
                <div className="agent-card-head">
                  <strong>{selectedAgent?.name}</strong>
                  <span className="tiny-label">{selectedAgent?.status}</span>
                </div>
                <div className="agent-stat-line">
                  <span>{selectedAgent?.style}</span>
                  <span>Live competition</span>
                  <span>{selectedAgentEntries || selectedAgent?.entries || 0} entries</span>
                </div>
                <div className="command-summary-grid">
                  <div>
                    <span className="tiny-label">Agent account</span>
                    <strong>{selectedAgentAccount ? "ready" : "pending"}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">Playable Yield</span>
                    <strong>{arenaState.playBudget.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">Agent float</span>
                    <strong>{selectedCompetitionFloat.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="tiny-label">Budget source</span>
                    <strong>{selectedBudget?.label ?? "Play Budget"}</strong>
                  </div>
                </div>
                {selectedLiveCompetitionEntry ? (
                  <div className="command-summary-grid compact">
                    <div>
                      <span className="tiny-label">Live match</span>
                      <strong>{selectedLiveCompetitionEntry.gameId}</strong>
                    </div>
                    <div>
                      <span className="tiny-label">Attends as</span>
                      <strong>{selectedLiveCompetitionEntry.payerNickname ?? "pending"}</strong>
                    </div>
                    <div>
                      <span className="tiny-label">Match status</span>
                      <strong>{selectedLiveCompetitionEntry.status ?? "pending"}</strong>
                    </div>
                    <div>
                      <span className="tiny-label">Entry mode</span>
                      <strong>{selectedLiveCompetitionEntry.participantMode ?? "pending"}</strong>
                    </div>
                  </div>
                ) : null}

                <div className="primary-action-wrap">
                  <button
                    className="action-button primary-action-button"
                    onClick={handlePrimaryAction}
                    type="button"
                    disabled={isEntering || !budgetReady || runInProgress}
                  >
                    {primaryActionLabel}
                  </button>
                <div className="entry-note compact">
                  {runInProgress
                      ? "A live run is already underway. The arena will keep advancing as turns settle."
                      : `The arena will Activate → Fund → Enter → Auto-Run using ${selectedBudget?.label ?? "Playable Yield"}.`}
                  </div>
                </div>
                <article className={`feedback-card${feedbackError ? " feedback-card-error" : ""}`}>
                  <span className="tiny-label">Latest run result</span>
                  <p>{latestRunResultMessage}</p>
                </article>

                <div className="entry-note">{commandStatusMessage}</div>
                {selectedLiveCompetitionEntry?.lastMove ? (
                  <div className="entry-note compact">
                    Last auto move: {selectedLiveCompetitionEntry.lastMove.from} → {selectedLiveCompetitionEntry.lastMove.to}
                    {" · "}
                    {selectedLiveCompetitionEntry.lastMove.isJump ? "jump" : "standard"}
                  </div>
                ) : null}
                {selectedLiveCompetitionEntry?.lastMoveError ? (
                  <div className="entry-note error">{selectedLiveCompetitionEntry.lastMoveError}</div>
                ) : null}
              </article>
            </div>
            <div className="command-actions command-footer">
              <button
                className="ghost-button"
                onClick={handleResetDemo}
                type="button"
                disabled={isResetting}
              >
                {isResetting ? "Resetting..." : "Reset Demo"}
              </button>
            </div>
          </section>

          <section className="panel live-panel">
            <div className="panel-header">
              <div className="panel-label">ARENA-WIDE LIVE FEED</div>
              <div className="tiny-label">public matches + current board state</div>
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
                  {selectedCompetitionFloat > 0 ? (
                    <div className="command-actions">
                      <button
                        className="ghost-button"
                        onClick={handleSweepCompetitionWallet}
                        type="button"
                      >
                        Sweep Unused Float
                      </button>
                    </div>
                  ) : null}
                </article>
              ) : (
                <div className="entry-note">No competition wallet activity yet.</div>
              )}
            </div>

            <div className="stack-panel">
              <div className="panel-header">
                <div className="panel-label">QUERY VIEW</div>
                <div className="tiny-label">sqlite-backed arena state</div>
              </div>
              <div className="query-tab-row">
                <button
                  className={`query-tab${queryView === "live-agents" ? " active" : ""}`}
                  onClick={() => setQueryView("live-agents")}
                  type="button"
                >
                  Live Agents
                </button>
                <button
                  className={`query-tab${queryView === "history" ? " active" : ""}`}
                  onClick={() => setQueryView("history")}
                  type="button"
                >
                  History
                </button>
              </div>
              {queryView === "live-agents" ? (
                liveAgentResults.length ? (
                  liveAgentResults.map((agent) => (
                    <article className="query-row" key={agent.id}>
                      <div>
                        <strong>{agent.name}</strong>
                        <div className="tiny-label">
                          {agent.competition} · {agent.status}
                        </div>
                      </div>
                      <div className="query-meta">
                        <span>{agent.balance > 0 ? `$${agent.balance.toFixed(2)} float` : `${agent.totalEntries} entries`}</span>
                        <span className="tiny-label">
                          {agent.lastSeenAt ? formatTime(agent.lastSeenAt) : "saved"}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="entry-note">No live or funded agents in the arena yet.</div>
                )
              ) : historyResults.length ? (
                historyResults.map((entry) => (
                  <article className="query-row" key={entry.id}>
                    <div>
                      <strong>{entry.name}</strong>
                      <div className="tiny-label">
                        {entry.source} {"->"} {entry.competition}
                        {entry.matchId ? ` · ${entry.matchId}` : ""}
                      </div>
                    </div>
                    <div className="query-meta">
                      <span>-${entry.amount.toFixed(2)}</span>
                      <span className="tiny-label">{formatTime(entry.createdAt)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="entry-note">No competition history yet.</div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
