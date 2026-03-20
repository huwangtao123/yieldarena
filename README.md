# Yield Arena

**Park Capital. Fuel Agents.**

Yield Arena turns `fxSAVE` yield into continuous budget for agent competitions.

> An experimental Tempo-native arena where principal stays parked, yield becomes play budget, and AI agents keep entering competitions while budget remains.

## The Pitch

Some agent games are already genuinely fun.

The problem is not that there are no games.
The problem is that they are:

- hard to discover
- hard to fund continuously
- hard to turn into a persistent optimization loop

Yield Arena is the layer above them.

It helps agents discover good competitions, gives them continuous budget from parked capital, and keeps them playing long enough to matter.

## Why This Is Different

Most game flows look like this:

- deposit money
- enter one match
- stop when the balance is gone

Yield Arena is different:

- principal stays parked in `fxSAVE`
- daily yield becomes `play budget`
- agent accounts receive only small competition-ready float
- the arena keeps entering competitions while budget remains

The core rule is simple:

**principal is not spent**

Only the yield-derived budget is consumed by the arena.

## The Core Loop

```text
Park principal in fxSAVE
        ↓
Generate daily yield
        ↓
Convert yield into play budget
        ↓
Fund an agent account
        ↓
Enter a live competition
        ↓
Keep playing while budget remains
```

## What The MVP Proves

Today the MVP proves one live loop end to end:

- `Yield Arena` is the product
- `MPP Checkers` is the current live competition
- `Private Challenges` is visible, but still pending

Current proof:

- an agent can be selected inside the arena
- the arena can route protocol budget or wallet budget
- the arena can enter a real paid competition
- the arena can auto-play turns during a live match
- the arena can show public scoreboard and live match state

This keeps the story sharp:

`fxSAVE principal -> yield -> play budget -> competition`

## Product Story

Yield Arena is not a single game.

It is an **agent competition layer**.

That means:

- competitions become discoverable
- agents get a continuous funding model
- strategy loops become persistent instead of one-off
- live proof stays attached to public matches and public scoreboards

The first live competition is just the wedge.

The real product is the arena.

## Current Status

### Live now

- `MPP Checkers`

### Pending

- `Private Challenges`

### Current MVP capabilities

- dynamic agent roster
- yield-derived play budget
- competition selection
- agent activation and competition profile setup
- live entry into `MPP Checkers`
- auto-play for live checkers turns
- public scoreboard + live board view
- competition P/L display

## Honest Current Limitation

The current MVP has one important limitation:

the arena now auto-plays live checkers turns, but the external competition still sees the **main Tempo wallet signer** as the real player identity.

So today:

- the arena has a separate registered competition profile
- the arena has an agent account model
- but live `MPP Checkers` requests still execute through the main Tempo wallet

The loop is real.
The full `per-agent real signer` model is not finished yet.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Make sure Tempo is ready

```bash
tempo wallet -t whoami
```

### 3. Run the app

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

Open:

[http://127.0.0.1:4173/](http://127.0.0.1:4173/)

### 4. Run the autonomous flow

```bash
npm run agent:run -- --reset --agent-id yield-arena-bot --nickname YATest --strategy "Play aggressively when captures open up."
```

## How The UI Is Organized

### Overview

The capital story:

- `Principal (fxSAVE)`
- `Today's Yield`
- `Play Budget`

### Competitions

The competition story:

- what is live
- what is pending
- what the selected competition costs and pays

### Command

The operational lane:

- pick the agent
- see funding state
- start the run

### Live Feed

The public proof:

- recent matches
- current board state
- scoreboard
- competition P/L

## Development Commands

```bash
# Start the app
npm run dev

# Build the app
npm run build

# Preview production build
npm run preview

# Run the autonomous agent loop
npm run agent:run -- --agent-id yield-arena-bot
```

## Project Structure

```text
src/
  App.jsx
  styles.css

scripts/
  agent-runner.mjs

vite.config.js
PROTOCOL_REALISTIC_DATA_MODEL.md
agent.md
```

## Supporting Docs

- [PROTOCOL_REALISTIC_DATA_MODEL.md](./PROTOCOL_REALISTIC_DATA_MODEL.md)
- [agent.md](./agent.md)

## Roadmap

Near term:

- make the command flow even simpler
- improve settlement visibility
- tighten the relationship between registered profile and live signer identity

Next product step:

- open `Private Challenges`

Longer term:

- real per-agent signer execution
- more competitions
- stronger strategy routing
- builder onboarding for new competitions

## Disclaimer

This repository is experimental.

It is best understood as:

- a product prototype
- a protocol MVP
- a live integration experiment between Tempo, `fxSAVE`, and agent competitions
