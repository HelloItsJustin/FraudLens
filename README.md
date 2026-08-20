# FraudLens

> Explainable, live fraud-ring detection for inclusive finance.

FraudLens is Team XCalibur’s AGENTRIX 2026 FinGuard submission. It turns a UPI-style transaction stream into an interactive account-relationship graph, detects coordinated mule-ring activity, and produces a decision record that an analyst can understand, inspect, and act on.

Four agents operate over a server-side stream, the dashboard receives live state over Server-Sent Events (SSE), every rendered graph node is inspectable, and the Counterfactual Agent always produces a usable explanation, even when external LLM providers are unavailable.

> **Demo safety note:** FraudLens is a decision-support demonstration, not a production fraud-blocking service. Its risk scores, 1930 complaint drafts, and simulated institutional submissions require human and institutional review before any real action.

## What it demonstrates

- **Explainable fraud-ring detection**: detects the deterministic five-account mule ring embedded in the demo stream using transaction risk signals and relationship analysis.
- **Four real agents plus an orchestrator**: Ingest, Graph, Monitor, and Counterfactual agents have strict TypeScript contracts and a traceable server-side handoff pipeline.
- **Live, inspectable graph**: pan, zoom, and drag graph nodes; click any rendered node to inspect its transactions, agent conclusions, timing, risk signals, and network position.
- **Per-entity explanations**: the Risk Signal Fingerprint radar chart, Explain Like I’m 70 copy, node modal, and trace context all update from one shared selected-entity state.
- **Operationally complete dashboard**: populated Investigations, Entities, Alerts, Casebook, Reports, and Settings views rather than placeholder routes.
- **Graceful LLM reliability**: Gemini → Groq → deterministic static continuity data. A provider failure never produces a blank dashboard or failed demo.
- **Time-bounded flow**: the server finalizes continuity data by 28 seconds and the client transitions from agent processing to the dashboard within 40 seconds of starting the live run.
- **Evidence handoff**: generate a styled evidence dossier, download a PDF, open a 1930 complaint draft, and record a non-blocking institutional alert.

## Quick start

### Prerequisites

- Node.js **20.9 or newer**
- npm **10 or newer**
- Optional: Gemini and/or Groq API credentials for generated Counterfactual Agent content

### Install and run

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The first visit displays the four-second FraudLens boot loader, then the opening screen. Select **ENTER LIVE FEED** to start the seeded transaction run. The deterministic mule ring appears near the beginning of the feed so the entire judging flow is repeatable.

### Environment configuration

Create a local `.env.local` file in the repository root. It is ignored by Git and is read on the server only.

```dotenv
# Optional. FraudLens works without either key by using continuity data.
GEMINI_API_KEY=
GROQ_API_KEY=

# Optional. Used only when an institutional webhook is configured.
SLACK_WEBHOOK_URL=

# Optional. Defaults to Groq's supported openai/gpt-oss-120b model.
GROQ_MODEL=openai/gpt-oss-120b
```

Never prefix these values with `NEXT_PUBLIC_`, and never commit `.env.local`.

## Demo flow

```text
Boot loader (4.1s)
  -> Opening screen
  -> ENTER LIVE FEED
  -> Real agent processing (hard dashboard handoff < 40s)
  -> Interactive Intelligence dashboard
```

During the run, the orchestrator streams state to the browser. The graph, agent status rows, live reasoning feed, alerts, and trace strip update from the same in-memory run state.

If a user uploads a CSV, the same server-side pipeline is used. The client still has the same hard dashboard handoff guarantee; unresolved work is completed with representative continuity data rather than allowing the UI to hang.

## Architecture

FraudLens is a single Next.js App Router application. Keeping the UI, API routes, streaming state, agent contracts, and LLM fallback logic in one TypeScript codebase makes the demo straightforward to run and review.

```text
Browser
  ├─ Framer Motion UI / entity selection context
  ├─ SSE subscription: GET /api/stream
  └─ Route calls: demo start, upload, agent console

Next.js Node runtime
  └─ FraudLensOrchestrator
       ├─ IngestAgent         -> weighted transaction risk
       ├─ GraphAgent          -> Graphology relationship graph + ring analysis
       ├─ MonitorAgent        -> independent re-evaluation loop
       ├─ CounterfactualAgent -> leave-one-out explanation + evidence draft
       ├─ LLM provider chain  -> Gemini -> Groq -> static continuity data
       └─ SSE fan-out         -> dashboard state, traces, alerts
```

### Agent responsibilities

| Agent | Input | Responsibility | Output |
| --- | --- | --- | --- |
| **Ingest** | `Transaction` | Scores velocity, high-value/new-beneficiary pairing, and round-number structure. | `IngestRisk` with a score, sub-scores, reasons, and escalation decision. |
| **Graph** | `IngestRisk` | Adds directed account relationships to Graphology, calculates degree/centrality, and identifies compact suspicious clusters. | `GraphAnalysis` and per-node `NodeProfile` data. |
| **Monitor** | Entity + fresh evidence | Runs in an independent loop and rechecks watching or inconclusive entities. | `MonitorAssessment` with status, explanation, and next review time. |
| **Counterfactual** | Confirmed `GraphAnalysis` | Removes one signal at a time, ranks causal impact, writes analyst/ELI70 explanations, and drafts a complaint. | `CounterfactualResult` plus a 1930-ready complaint draft. |
| **Orchestrator** | All handoffs | Owns sequencing, timeouts, tracing, caching, SSE publication, and alert delivery. | `DashboardState`, `TraceEntry`, and `AlertState` events. |

The canonical interfaces are defined in [`lib/contracts.ts`](lib/contracts.ts). The complete AI-continuation record, including contract shapes and implementation decisions, lives in [`context.md`](context.md).

## Reliability and bounded execution

### LLM fallback chain

Every Counterfactual request uses one function: `callLLMWithFallback()`.

1. **Gemini**: `gemini-3-flash-preview`, using `GEMINI_API_KEY`.
2. **Groq**: `openai/gpt-oss-120b` by default, using `GROQ_API_KEY`.
3. **Static continuity**: varied, typed local content from [`lib/fallback-data.ts`](lib/fallback-data.ts), with the seeded-ring-specific record in [`lib/seeded-fallback.ts`](lib/seeded-fallback.ts).

The server queues simultaneous LLM work, applies sliding-window request/token limits, validates the expected JSON schema, and uses hard timeouts. Provider switches are logged server-side for debugging but are never surfaced as a failure to the user.

### Timing guarantees

- Each visible agent has a bounded execution guard.
- The orchestrator completes outstanding work from continuity data after **28 seconds**.
- The browser has an independent hard transition at **38.5 seconds**, leaving room for the dashboard cross-fade.
- The dashboard therefore appears within **40 seconds** of a live run starting, even if the SSE connection, LLM, or a provider response stalls.

## Data and seed scenarios

| Asset | Purpose |
| --- | --- |
| [`data/upi_transactions.csv`](data/upi_transactions.csv) | Deterministic 500-row UPI-style stream with one deliberate five-account mule ring. |
| [`lib/seeded-fallback.ts`](lib/seeded-fallback.ts) | Scenario-specific, precomputed continuity result for the deliberate mule ring. |
| [`lib/fallback-data.ts`](lib/fallback-data.ts) | Varied typed static explanations for non-ring or unavailable-provider paths. |
| [`lib/workspace-seed.ts`](lib/workspace-seed.ts) | Historical operations data: 10 investigations, 46 entities, 20 alerts, analyst notes, report trend data, fraud-pattern breakdowns, and leaderboards. |

The demo data is synthetic. It must not be represented as real customer, case, or authority data.

## Entity selection and inspection

[`components/node-selection-context.tsx`](components/node-selection-context.tsx) provides the shared `selectedNodeId` state. This is deliberately a context, not isolated component state, so the following always agree:

- the graph’s selected-node halo;
- the node inspection popup;
- the animated Risk Signal Fingerprint polygon;
- the Explain Like I’m 70 card;
- per-agent trace filtering; and
- console commands that operate on the selected entity.

The modal includes first-seen time, classification, transaction totals, counterparties, exact Ingest sub-scores, Graph in/out degree and centrality, Monitor scheduling, Counterfactual state, and retained transactions. It supports close-button, backdrop-click, and Escape-key dismissal with the same Framer Motion reverse transition.

## Dashboard sections

| Section | Contents |
| --- | --- |
| **Intelligence** | Interactive entity graph, animated radar chart, ELI70/analyst explanation toggle, trace strip, live reasoning, node inspection, comparison, evidence and complaint actions. |
| **Investigations** | Ten historical/live cases with varied statuses, risk values, AI summaries, mini network views, full agent traces, and linked evidence documents. |
| **Entities** | A 46+ account directory with search plus risk, active-investigation, and activity-date filters. Every row opens the same inspection modal as the graph. |
| **Alerts** | A chronological 20+ item feed covering rings, high-risk transactions, watch-list changes, case updates, system activity, and institutional records. |
| **Casebook** | Generated evidence material, editable session notes, and seeded analyst annotations. |
| **Reports** | Six operational metrics, 21-day trend, fraud-pattern donut and bar charts, and a high-value case leaderboard. |
| **Settings** | Display controls, review threshold, provider health, queue label, and seeded-demo restart. |

## Agent console

Open the **Console** control in the dashboard to use the forensic command interface.

| Command | Action |
| --- | --- |
| `/help` | List supported commands. |
| `/status` | Show provider status, rate-limit headroom, and transaction progress. |
| `/ingest`, `/graph`, `/monitor`, `/counterfactual` | Invoke the named agent for the selected/current node and open its reasoning document. Dotted aliases such as `.graph` are supported. |
| `/expand <agent>` | Open the detailed explanation view for an agent. |
| `/focus <entity>` | Select and inspect a matching entity. |
| `/ring <ring-id>` | Focus the active mule ring. |
| `/replay` | Replay the choreographed graph reveal. |
| `/alerts` | Open the alert archive. |
| `/report [ring-id]` | Open the formal evidence dossier and generate a downloadable PDF. |

## CSV upload contract

The dashboard upload control sends CSV text to `POST /api/upload`. The first row must contain every required column:

```csv
transaction_id,timestamp,sender_vpa,receiver_vpa,amount,is_new_beneficiary
UPI-001,2026-08-20T09:00:00.000Z,alice@upi,bob@upi,25000,true
```

`amount` must be numeric. `is_new_beneficiary` accepts the parser’s boolean-compatible values. Uploaded data uses the same agent contracts, SSE event stream, node inspection, and continuity safeguards as the seeded demo.

## HTTP API surface

The browser uses these route handlers; they are also useful for local integration testing.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/demo/start` | `POST` | Reset and start the deterministic seeded stream; returns the current `DashboardState`. |
| `/api/upload` | `POST` | Start a custom CSV stream. Body: `{ "csv": "..." }`. |
| `/api/state` | `GET` | Return the current in-memory `DashboardState` with no-cache headers. |
| `/api/stream` | `GET` | SSE stream containing `state`, `trace`, and `alert` events. |
| `/api/agents` | `POST` | Invoke a console agent. Body: `{ "agent": "Graph", "entityId": "optional@upi" }`. |

All API routes run in the Node.js runtime. They are intentionally stateful within one process for a reliable local/judging demo.

## Repository layout

```text
app/
  api/                  Route handlers for stream, demo, upload, state, agents
  page.tsx              Boot -> opening -> processing -> dashboard route state
  globals.css           Design tokens, layouts, animation and workspace styles
components/
  dashboard.tsx         Main operational dashboard and sidebar sections
  entity-graph.tsx      SVG graph reveal, interaction, drag/pan/zoom
  node-selection-context.tsx
  processing-screen.tsx
  chase-loader.tsx
lib/
  agents.ts             Ingest, Graph, and Monitor agent implementations
  orchestrator.ts       Pipeline execution, timeouts, tracing, SSE fan-out
  llm.ts                Provider queue, rate limiting, fallback chain
  contracts.ts          Canonical TypeScript contracts
  workspace-seed.ts     Structured historical operations data
data/
  upi_transactions.csv  Synthetic seeded stream
```

## Quality checks

Run these before a demo handoff or deployment:

```powershell
npm run typecheck
npm run lint
npm run build
```

The production build verifies TypeScript, ESLint, route compilation, React rendering, and Next.js output generation.

## Troubleshooting

### Next.js build fails with `EINVAL ... .next/types/package.json`

On some OneDrive-backed Windows workspaces, a generated `.next` item can become a problematic reparse point. Close development servers, then remove only the generated build cache and rebuild:

```powershell
Remove-Item -LiteralPath .next -Recurse -Force
npm run build
```

Do not remove source directories, `data/`, or `.env.local` as part of this recovery.

### Gemini or Groq is unavailable

This is expected to be non-fatal. FraudLens moves to the next provider and finally to local continuity data. The dashboard should still complete normally. Provider diagnostics remain in the server terminal only.

### The first build cannot fetch fonts

`next/font/google` downloads the declared open-source fonts during production compilation. Ensure the build environment can reach Google Fonts, then rerun `npm run build`.

## Deployment

### Recommended: Render Node Web Service

Render is the recommended production-demo target because the current design uses in-memory orchestrator state and long-lived SSE connections.

- **Build command:** `npm run build`
- **Start command:** `npm run start`
- **Environment:** Node 20+
- Configure `GEMINI_API_KEY`, `GROQ_API_KEY`, optional `GROQ_MODEL`, and optional `SLACK_WEBHOOK_URL` in Render’s environment dashboard.

### Netlify

The Next.js application can be deployed with Netlify’s Next runtime. However, serverless invocation boundaries are not a durable home for the current in-memory stream state or long-lived SSE connections. For a judged live-stream demo, use Render; for a fully serverless deployment, move orchestration state and fan-out to durable services such as Redis/PostgreSQL and use a managed realtime transport.

## Production hardening roadmap

FraudLens intentionally optimizes for deterministic judging reliability. Before handling real financial data, add:

- authenticated users, role-based access, audit logs, and tenant isolation;
- encrypted durable storage for evidence and reports;
- Redis-backed rate limits, queueing, and stream fan-out;
- persistent graph storage (for example Neo4j) and case storage (for example PostgreSQL);
- provider observability, prompt/version tracking, and model evaluation;
- data retention, privacy, consent, and jurisdictional compliance controls; and
- human-in-the-loop approval before alerts, holds, or authority submissions.

## Team

Built by **Team XCalibur** for **AGENTRIX 2026, FinGuard: AI Fraud Detection for Inclusive Finance**.

For implementation continuity, read [`context.md`](context.md) before modifying agents, contracts, data flow, or the visual system.
