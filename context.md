# FraudLens — Continuation Context

## Purpose

FraudLens is Team XCalibur's AGENTRIX 2026 FinGuard submission: an explainable, live fraud-ring detector for UPI-style transactions. It detects a seeded five-account mule ring that a single-transaction baseline misses, explains the decision in analyst and elderly-accessible language, produces a 1930 Cybercrime Complaint draft, and attempts an institutional Slack alert without allowing an unavailable integration to interrupt the demo.

## Source-of-Truth Scope

- Binding product scope: `XCalibur-CAIAS.pdf` supplied by the user (read on 2026-08-20).
- Binding visual references: Opening, Loading, Thinking, and Dashboard screenshots supplied by the user (all 1536 px wide).
- The application is desktop-first for 1280–1920 px widths. The four supplied screenshots are a literal layout/content target; extensions use the same visual grammar.

## Design System

### Visual extraction

The references use a near-black, lightly mottled archival-paper canvas with thin antique-gold rules; warm ivory/parchment content; a restrained burnt-ochre alert colour; and a dusty olive safety colour. The opening view is a centered editorial composition inside a double-line ornamental frame. The dashboard uses a 16.5% left navigation rail, a roughly 46.5% graph area, a 37% right analysis column, and a bottom trace strip overlapping the work area. The thinking view is a parchment card centered on an ink/network field. Text hierarchy is strongly serif-led, with letter-spaced small caps for labels. Corners are mostly square/ornamental rather than modern rounded cards.

### Tokens (never inline component hex values)

```css
--color-ink: #12110f;           /* deep espresso/ink base */
--color-ink-raised: #1a1814;    /* panel/border depth */
--color-ink-soft: #242019;      /* muted dark surface */
--color-parchment: #eee2cd;     /* primary cream surface */
--color-parchment-dim: #d7c6ad; /* muted cream text */
--color-antique-gold: #c5a66f;  /* hairlines and ornaments */
--color-gold-muted: #8d7957;    /* understated labels */
--color-oxblood: #a9432a;       /* active ring / urgent alert */
--color-oxblood-bright: #d26845;
--color-sage: #6f7a5d;          /* complete / safe */
--color-sage-bright: #93a071;
--color-paper-shadow: #bca98b;
--ease-editorial: cubic-bezier(0.16, 1, 0.3, 1);
--duration-sm: 300ms;
--duration-md: 450ms;
--duration-lg: 600ms;
```

Tokens are approximated by visual sampling from the reference raster images; their palette is deliberately low-saturation and should not be replaced with generic pure black/white/red/green.

### Typography

- `Piazzolla`: wordmark, editorial headings, feature text, high-value numbers. This is the final premium display face: its high-contrast, slightly calligraphic terminals have a Canela-adjacent editorial character while keeping the compact geometry needed in dense dashboard headings.
- `Source Serif 4`: body copy, labels and descriptive data. Its 500/600 weights render more clearly than the former Newsreader body treatment at small dashboard sizes.
- `IBM Plex Mono`: timers, risk scores, identifiers, timestamps, trace readouts.
- All fonts load via `next/font/google`; component styling must reference these CSS variables, never browser default fonts. Body and data labels default to medium (500) or semibold (600), with increased line-height for readability.

### Texture, borders, and motion

- A low-opacity (about 5%) repeating inline SVG noise overlay gives all ink and parchment surfaces paper grain; it is not a bitmap asset.
- Use one-pixel gold rules at low opacity, decorative double-line frames, and modest radii only where screenshots imply a rounded pill/control.
- React/page state transitions use Framer Motion with `--ease-editorial`; normal UI changes are 300–450 ms and full-screen handoffs 450–600 ms. Scroll reveals are `opacity: 0, y: 12` to `opacity: 1, y: 0` through `whileInView`.
- Never hard cut: loader status copies, agent verbs, modal visibility, settings/toggles, CTA handoff, dashboard appearance, charts, cards, rows and alerts must be animated. Support `prefers-reduced-motion` without flicker.
- Desktop text uses `clamp()`, `overflow-wrap: anywhere`, and ellipsis only for fixed-width technical fields, avoiding overflow/clipping from 1280–1920+ px.

## Architecture Decisions

### Chosen stack

One deployable TypeScript application: Next.js App Router with route handlers. It keeps the live experience, agent code, API keys and deployment topology in one codebase, satisfies the TypeScript-only requirement, and is deployable to Netlify or Render without a client/server contract split. Data and in-memory state live on the server process for this demo. This deliberately differs from the proposal's FastAPI option because the user explicitly permits a Next.js API stack and requested TypeScript throughout.

- UI: React, Next.js, Framer Motion, Lucide React, Recharts, and custom SVG (wordmark and network).
- Graph: Graphology provides the persistent directed relationship graph. A small deterministic clustering/centrality routine reports ring evidence, keeping the hackathon build interpretable.
- Events: Server-Sent Events on `/api/stream` publish stream, graph, trace, ring and agent updates. The dashboard also reads a serialized current state endpoint on first paint.
- Data: `/data/upi_transactions.csv` has 500+ deterministic synthetic rows, including one deliberate five-account mule ring, and is parsed server-side.
- Persistence: intentionally lightweight in-memory process state with a documented production migration to PostgreSQL/Redis/Neo4j. No database service is necessary for a reliable local demo.
- API key boundary: only server route modules read `process.env`. Client components receive only rendered state/SSE payloads.

### Agent pipeline

The Orchestrator is the single owner of ordering, bounded invocation, trace logging, cache lookup, provider handling, webhook notification and fan-out. It has exactly four agents:

1. **Ingest** scores velocity, new-beneficiary/high-value pairing, and round-number behaviour.
2. **Graph** adds sender/receiver nodes and edges, measures degree/reciprocal/ring signals, and confirms the seeded compact five-account ring only once enough evidence is present.
3. **Monitor** runs on an independent timed loop to re-evaluate previously inconclusive entities as the stream advances; it can send a case back to Graph. This is a genuine background loop, not UI-only state.
4. **Counterfactual** performs leave-one-signal-out scoring, requests grounded analyst/ELI70/complaint content through the provider fallback chain, and enriches the final ring result.

The Naive Comparator and notifier are stateless consumers of pipeline outputs, not agents.

## Agent Contracts

All contracts are strict exported TypeScript interfaces in `lib/contracts.ts` and are validated at agent boundaries. Canonical JSON shapes:

```ts
type Transaction = {
  transactionId: string; timestamp: string; senderVpa: string; receiverVpa: string;
  amount: number; isNewBeneficiary: boolean;
};

type IngestRisk = {
  transaction: Transaction;
  score: number; threshold: number; escalated: boolean;
  signals: { velocity: number; newBeneficiaryHighValue: number; roundNumber: number };
  reasons: string[]; assessedAt: string;
};

type GraphAnalysis = {
  risk: IngestRisk; graph: { nodes: GraphNode[]; edges: GraphEdge[]; nodeTransactions: Record<string, Transaction[]> };
  entityId: string; centrality: number; clusterAccounts: string[];
  ringConfirmed: boolean; confidence: number; evidence: string[]; analyzedAt: string;
};

type NodeProfile = {
  entityId: string;
  ingest: { score: number; signals: RiskSignals; reasons: string[]; assessedAt: string };
  graph: { degree: number; centrality: number; position: string; ringMember: boolean };
  monitor: { status: "watching" | "recheck" | "confirmed" | "not_yet_evaluated"; summary: string; checkedAt?: string };
  counterfactual: { status: "ready" | "not_yet_evaluated"; explanation?: string; fingerprint: FingerprintPoint[] };
};

type MonitorAssessment = {
  entityId: string; priorStatus: "inconclusive" | "confirmed";
  status: "inconclusive" | "recheck" | "confirmed";
  reason: string; nextCheckAt: string; checkedAt: string;
};

type CounterfactualResult = {
  entityId: string; baselineScore: number; dominantSignal: string;
  leaveOneOut: { signal: string; scoreWithout: number; impact: number }[];
  fingerprint: FingerprintPoint[]; analystExplanation: string;
  eli70Explanation: string; complaintDraft: ComplaintDraft;
  provider: "gemini" | "groq" | "static"; createdAt: string;
};

type TraceEntry = {
  id: string; sequence: number; timestamp: string; agent: AgentName | "Orchestrator";
  status: "started" | "completed" | "escalated" | "rechecked" | "alerted" | "fallback";
  summary: string; entityId?: string;
};
```

`GraphNode`, `GraphEdge`, `FingerprintPoint`, `ComplaintDraft`, event payloads, dashboard state and LLM response schema are also exported from the same contract file; these canonical shapes must be updated here if implementation changes.

`GraphSnapshot` additionally carries `nodeProfiles: Record<string, NodeProfile>` and `nodeTransactions`, so one selected entity ID can drive its transaction view, agent interpretation, fingerprint, ELI70 explanation and trace context without divergent client copies. `DashboardState` now carries `runSource`, `processingLimitSeconds` (40 seeded / 60 upload), `liveThoughts`, chronological `alerts`, `investigations` and `providerHealth`.

## LLM Fallback and Reliability

Every Counterfactual LLM request goes through one `callLLMWithFallback()` function:

1. Gemini `gemini-3-flash-preview`, using server-only `GEMINI_API_KEY`.
2. Groq `llama-3.3-70b-versatile`, using server-only `GROQ_API_KEY`. This model is selected for stronger structured explanatory output; it remains fast enough because calls occur only on confirmed rings.
3. Static fallback from `lib/fallback-data.ts`, with four realistic dominant-risk variants.

Both external calls have proactive in-memory sliding-window/token bucket checks, queued work, schema validation and a 15-second provider window. Gemini is skipped if unavailable/rate limited; Groq limits are 30 requests/minute, ~6,000 tokens/minute and 14,400/day. The Counterfactual Agent has a 30-second hard ceiling and returns that entity's last successful cache entry if available; otherwise static continuity data. Provider selection is console/trace logged but never revealed as a failure in the UI. The entire thinking experience is capped at 40 seconds; a server-side 32-second continuity guard completes a non-confirming/custom stream with safe hardcoded output before that visual deadline.

## Deployment Topology

One Next.js service, deployable on Netlify (recommended for judging frontend-plus-functions) or Render as a Node Web Service. The only supplied data asset is bundled; environment variables are configured in the host dashboard. In-memory streaming state resets on cold starts, which is acceptable for the deterministic demo. Production migration: persist trace/cache to PostgreSQL, use Redis for queues/rate limiter/SSE fanout, and move graph persistence to Neo4j or a graph store.

## Planned File Structure

```text
app/                 Next App Router screens and API routes
components/          Screen, dashboard, graph, chart and modal UI
data/                deterministic UPI stream CSV
lib/                 contracts, agents, orchestrator, LLM, data and utilities
public/              lightweight static assets only
```

## Implementation Log

- 2026-08-20 (follow-up pass): Read this file before edits. Fixed the Intelligence Dashboard trace-log clipping root cause: the strip no longer uses a negative margin or touches the sidebar/graph boundary. The dashboard grid now reserves a 20 px exterior gap, 20 px sibling gap and 20â€“24 px interior padding; trace items use min-width safeguards and wrapping so none can render outside their container at 1280â€“1920 px.
- 2026-08-20 (follow-up pass): Replaced the display/body pairing with Piazzolla + Source Serif 4 (IBM Plex Mono retained) and raised baseline body/label weight to 500-600. Added `app/icon.tsx`, which serves a generated 64 px PNG FL crest icon through Next metadata, replacing the framework/default browser tab icon.
- 2026-08-20 (follow-up pass): Rebuilt the dashboard around one selected-entity source of truth. `components/entity-graph.tsx` now delivers the terminal-to-node choreography, drawn SVG edges, camera focus/reset, interactive panning/zooming, and clean ring callout. `components/dashboard.tsx` connects selection to the animated radar, dual-register explanation, trace context and an animated inspection modal with per-agent findings and transactions. It also implements populated Investigations, Entities, Alerts, Casebook, Reports and Settings workspaces, sidebar collapse, live reasoning feed, console, authority report/PDF view, and CSV restart handoff.
- 2026-08-20 (follow-up pass): `lib/orchestrator.ts` now completes all visible agent statuses from a verified continuity record whenever a bounded run needs the static result. Seeded-ring continuity always uses `lib/seeded-fallback.ts`; non-ring/upload continuity uses the pre-existing varied static content. This prevents a partial agent state from persisting at the 30-second per-agent or 40/60-second whole-flow boundaries.
- 2026-08-20 (follow-up pass): Replaced the static preparation loader entry with `components/chase-loader.tsx`. It is a dependency-free SVG/CSS pursuit scene: sage investigator/magnifying-glass closes on an oxblood thief across the full viewport, capture outline/flash occurs at 3.9 s, and the route cross-fades to real agent processing at exactly 4.5 s. The API pipeline starts in parallel, so the loader never depends on backend readiness. CSV uploads use the exact same handoff.
- 2026-08-20 (follow-up pass): Extended server contracts for per-node inspection and operational history. Graph snapshots now preserve per-node latest rule score, signal profile, centrality/position, monitor status, recent transaction metadata and node-level counterfactual placeholders. The Orchestrator has one selected-data-compatible source of truth for live thought events, alerts, investigations, provider health, and source-specific 40 s/60 s ceilings. It records a real high-risk/ring/webhook alert history and creates an escalated case record on confirmation.
- 2026-08-20 (follow-up pass): Added `lib/seeded-fallback.ts`: frozen scenario-specific JSON based on the verified five-account seeded graph/rule values and the successful dual-register explanation shape from the prior real provider run. Ring timeout uses this exact representative case data; non-ring/custom continuity uses the existing varied `fallback-data.ts`. This guarantees an end-user-ready result instead of an error at the configured deadline.
- 2026-08-20 (follow-up pass): Processing UI now subscribes only to agent state from the Orchestrator: first transaction/cluster events complete Ingest and Graph rather than decorative delays, Monitor activates on its true re-check loop, and Counterfactual begins only on a confirmed ring. Each agent gets an independent 30 s execution guard that routes to continuity data; the screen shows the fixed user-facing ceiling (`Estimated time: 40s` seeded or `60s` upload) plus a live elapsed clock. The visual screen itself still caps at 40 s seeded and 60 s upload.
- 2026-08-20: Read the attached XCalibur proposal and all four visual references. Established the binding scope, TypeScript single-service architecture, pipeline contracts, fallback policy and reference-derived design system in this document before implementation.
- 2026-08-20: Created the deterministic 500-row UPI stream, including the compact five-account mule ring at the front of the feed so it reliably appears during a live judging run. Implemented the typed Ingest, Graphology-backed Graph, independent timed Monitor, and Counterfactual agents plus the Orchestrator, trace log, SSE broadcaster, rolling completion-time estimate, entity cache, timeout guard and custom CSV source.
- 2026-08-20: Implemented `callLLMWithFallback()` with queued sliding-window provider checks, Gemini → Groq → static continuity data, schema validation and server-only keys. A local no-key smoke test intentionally exercised the static provider; the full explanation, complaint, alert fallback and counterfactual result still completed. Provider selection is console/trace logged at runtime and never displayed as a failure in the UI.
- 2026-08-20: Built the opening, preparation, agent-processing and dashboard experiences with Fraunces/Newsreader/IBM Plex Mono loaded through `next/font`, shared CSS tokens, noise texture, custom SVG wordmark/network, Framer Motion handoffs, graph, animated radar, ELI70 explanation, Blind-Spot modal, complaint view, alert toast and upload control. Verified primary HTML, custom upload, SSE event delivery and an end-to-end seeded-ring run locally.
- 2026-08-20: Verified real credentials without reading or emitting their values. Gemini served the Counterfactual result successfully; Slack was deliberately absent and the non-blocking in-app institutional-alert record appeared. Tightened each remote-provider window to 15 seconds, preserving room inside the mandatory 40-second Counterfactual guard; if that guard trips before a cache exists, it now creates the static continuity result rather than leaving an empty case.
- 2026-08-20: Added a four-second reference-matched loading stage before every seeded or custom-data run. A custom CSV now returns through the preparation and live agent-processing screens instead of silently updating the dashboard. Added node-to-transaction mapping to the graph contract, curved directed graph edges, maintained five-ring-node visibility as the graph grows, node inspection details, a refined inline editorial portrait, functional Investigations/Entities/Alerts/Casebook/Reports/Settings workspaces, report/download actions, display settings and a seeded-demo restart control. Verified the uploaded-CSV 32-second continuity path: all active agents finish on static continuity data before the 40-second thinking-screen limit.

## Follow-up Pass: Current System Notes (2026-08-20)

This section supersedes earlier implementation-log wording where it differs.

### Interface and layout

- The current editorial pairing is **Piazzolla** for headings/wordmark, **Source Serif 4** for readable body text and **IBM Plex Mono** for technical readouts. They are loaded with `next/font/google` in `app/layout.tsx`; CSS keeps the original variable names (`--font-fraunces`, `--font-newsreader`, `--font-mono`) for component compatibility. Default body and label weight is 500-600.
- `app/icon.tsx` serves a 64 px FL crest PNG through App Router metadata; there is no default Next favicon.
- `components/chase-loader.tsx` is the only opening loader. It is a hand-built SVG/CSS animation using the design-system colors: a sage investigator closes on an oxblood thief, capture flashes at 3.9 seconds and it transitions at 4.5 seconds. No third-party animation asset is used.
- `app/page.tsx` begins the server run alongside the loader. Its whole-flow limit is measured from `DashboardState.startedAt`, not from the later visual Thinking Screen mount: seeded data can never remain in the agent flow beyond 40 seconds and CSV upload beyond 60 seconds.
- The Intelligence stage is a nested padded CSS grid (`.section-stage--intelligence`) with a 20 px sibling gap and at least 20-26 px card padding. This removes the historical negative-margin trace strip that clipped the Ingest step near the sidebar. The layout is designed for 1280, 1440 and 1920 px desktop widths; the sidebar also animates to a 86 px icon-only state.

### Graph, selection, and live evidence

- `components/entity-graph.tsx` owns the graph reveal: terminal overlay for 3 seconds, soft node-by-node reveal, SVG path drawing, focus camera transforms, final overview reset, and then pan/zoom controls. It redraws on `replayToken` from the `/replay` console command.
- Ring highlighting is an animated clean SVG ellipse with oxblood glow plus a parchment-backed leader-line label. Every node calls the dashboard `select()` handler.
- Selected node ID is the dashboard's single source of truth. `GraphSnapshot.nodeProfiles` contains the latest per-node `ingest`, `graph`, `monitor` and `counterfactual` interpretations. The node inspection modal, radar polygon, ELI70/analyst copy and filtered trace all read this same selection.
- `DashboardState.liveThoughts` is a bounded (60-entry) sequence of timestamped `TraceEntry` records. The live feed renders the last six with Framer Motion entry/exit animation. `alerts` and `investigations` are also first-class state collections, not display-only values.

### Bounded execution and canned continuity data

- `lib/orchestrator.ts` schedules a 30-second guard for every named agent. Its overall continuity guard is 32 seconds for the seeded flow and 55 seconds for uploads, keeping the visible page ceilings below 40 and 60 seconds. If a guard fires, all incomplete visible statuses are finalized from a verified continuity record, so the dashboard never receives a partial agent state.
- `lib/seeded-fallback.ts` is the canonical canned result for the five exact seeded mule accounts. Its 94/100 baseline, leave-one-out table, fingerprint and dual-register explanation were frozen from the seeded scenario's real graph/rule evidence and the successful provider response schema, then checked against a complete `/api/state` run. The fallback is deliberately scenario-specific, not generic filler.
- For non-ring or uploaded data continuity, `lib/fallback-data.ts` supplies varied static explanation content using the same typed `LlmGeneratedContent` contract. Neither path shows a provider or timeout failure to the end user.

### Dashboard sections and console

- Functional sections: Investigations has a clickable case register and trace detail; Entities is searchable/filterable and opens node inspection; Alerts is chronological and links back to entities; Casebook stores an editable session note and documents; Reports includes populated stat cards/trend and report creation; Settings exposes label/reduced-motion behavior plus provider/webhook status.
- The slide-up Agent Console supports `/help`, `/status`, `/expand <agent>`, `/ring <ring-id>`, and `/report [ring-id]` as required. Additional commands are `/focus <entity>` (direct entity inspection), `/replay` (replays the graph choreography), and `/alerts` (opens the alert archive). They were added to make live judging navigation fast without adding hidden UI controls.
- `/report` opens a formal evidence dossier with graph evidence, counterfactual finding, timestamps, submission confirmation and disclaimer. `lib/pdf.ts` emits a compact dependency-free one-page PDF Blob; its download buttons produce a real PDF rather than a text-file substitute. The authority submission is explicitly simulated and makes no external call.

### Validation at handoff

- `npm.cmd run typecheck` and `npm.cmd run lint` pass after this follow-up.
- The production build passes after its normal Google-font fetch. The build emits only an existing Autoprefixer advisory for `align-items: end` in the report trend bar; it does not affect rendering or correctness.
- A live API run was checked through `/api/demo/start` and `/api/state`: it produced graph nodes, node profiles, ring evidence, investigation, alert history, live trace entries and a complete counterfactual fallback result with no Slack key configured.
- 2026-08-20 recovery note: On OneDrive-backed Windows workspaces, a generated `.next` child can occasionally become a reparse point and make Next's `readlink` fail with `EINVAL` (for example `.next/types/package.json`). The safe repair is to close any dev server, remove **only** the project-root `.next` directory, then run `npm run build` again. A clean rebuild was verified after this recovery; source files and `.env.local` are not involved.

## Follow-up Reliability and Interaction Completion (2026-08-20)

### Provider recovery

- `lib/llm.ts` now makes exactly one bounded Gemini primary attempt using `gemini-3-flash-preview`. A 503, malformed reply, timeout, or proactive rate-limit decision immediately advances to Groq instead of repeatedly consuming the Counterfactual Agent's bounded window.
- The former Groq model ID `llama-3.3-70b-versatile` was retired by Groq on 2026-08-16 and was the cause of the observed HTTP 404. The server fallback now defaults to Groq's documented replacement `openai/gpt-oss-120b`; `GROQ_MODEL` remains an optional server-only override for future migrations. The ordering remains Gemini -> Groq -> typed static continuity data.
- A live server test with the configured keys was performed without reading or exposing either key. Gemini timed out within its short provider window and Groq successfully returned structured Counterfactual content. The provider result was `groq`, not a blank/error state. Provider messages are `console.info` diagnostics on the server only, never browser errors or user-facing failures.

### Bounded flows and loader

- `components/chase-loader.tsx` was repurposed into the reference-style **pre-opening boot loader**. It starts on the initial URL visit, uses the full ink/parchment constellation scene, displays the FraudLens wordmark, animated sage progress bar and live 0-100% number, then cross-fades into the opening screen after 4.1 seconds. It does not wait for server readiness.
- Clicking `ENTER LIVE FEED` now starts the real agent flow directly. The Thinking screen’s fallback display is 60 seconds before server state arrives; it immediately changes to the actual run ceiling (40 seconds for seeded data, 60 seconds for uploaded data). `app/page.tsx` measures the hard end from the server run's `startedAt`, with an absolute 60-second client ceiling. It can never leave the user in the Thinking screen past the stated maximum.

### Live reasoning, graph, and console contracts

- `THOUGHTS` in `lib/orchestrator.ts` holds rotating phrases for **all four agents**. Every run starts with one trace for every agent, ongoing Ingest/Graph/Monitor/Counterfactual handoffs rotate their phrasing, and `staticContentFor()` rotates the opening paragraph of all hard-coded analyst, ELI70 and complaint results. Therefore repeated runs and fallback runs do not show the same canned reasoning sequence.
- The graph now uses deterministic concentric-band seed positions for clean visual spacing. `components/entity-graph.tsx` maintains client-only position offsets, allowing the user to drag any visible node after the reveal. Node click continues to select and opens the detailed inspection modal; the selected node ID remains the dashboard single source of truth for the fingerprint radar, explanation, per-agent findings and filtered traces.
- `POST /api/agents` accepts `{ agent: "Ingest" | "Graph" | "Monitor" | "Counterfactual", entityId?: string }` and invokes `orchestrator.evaluateConsoleAgent()`. The popup console treats `/monitor`, `/graph`, `/ingest`, `/counterfactual` and dotted forms such as `.graph` as real agent calls, then opens the rich agent reasoning document. Each command was endpoint-tested against a live graph state.
- The console is a centered, framed modal-style popup (not a bottom drawer). The live feed intentionally retains the most recent entry per agent plus the current event window, so all four agents remain visible while work continues.

### UI recovery and verification

- `next.config.ts` has `devIndicators: false`, removing Next.js's development indicator from the lower left. `app/icon.tsx` remains the FL crest metadata icon, so the default Next favicon is not used.
- The ELI70 illustration is now a clean monospace older-investigator ASCII portrait, styled inside the parchment card. The dashboard/sidebar rules have explicit `min-width: 0`, clipping safeguards, ellipsis/wrapping, 20 px layout gaps, and bounded collapsed-sidebar rules to prevent the historic trace/sidebar collision.
- Institutional-alert toast state is locally throttled: only a new alert outside the 45-second suppression interval is shown, and it automatically dismisses after 3 seconds.
- Removed the project-root `.next` build cache as the targeted fix for the Windows/OneDrive `EINVAL readlink` error, then verified `npm.cmd run typecheck`, `npm.cmd run lint`, and a clean network-enabled `npm.cmd run build`. All passed with zero compiler, lint, type, or CSS warnings. No source, data, `.env.local`, or Git remote state was changed by the cache cleanup.

## Loader Repair (2026-08-20)

- Fixed a real boot-loader lifecycle bug in `app/page.tsx` and `components/chase-loader.tsx`. The global 100 ms clock re-rendered the page while it was on the boot screen; because the loader previously received an inline `onComplete` function, that function identity changed on every tick and restarted the loader effect before its 4.1-second timeout could complete.
- `Home` now passes a memoized `completeBoot` callback. The loader also keeps the latest callback in a ref and owns one mount-only 4.1-second interval/timeout lifecycle. Consequently the progress bar advances continuously from 0 to 100 once, holds its final state briefly, and then cross-fades to the opening screen; it cannot be reset by a parent render. `npm.cmd run typecheck` and `npm.cmd run lint` passed after this repair.

## Dashboard Deadline, Entity Selection, and Workspace Depth (2026-08-20)

### Guaranteed dashboard timing

- The dashboard handoff is now an independent client deadline in `app/page.tsx`: Thinking begins with a 38.5-second hard timer and transitions after the normal 0.55-second motion window, regardless of fetch completion, SSE state, LLM latency, or render-clock updates. This keeps the visible agent sequence below 40 seconds.
- `lib/orchestrator.ts` uses the matching fixed 40-second product ceiling. Its server continuity result is finalized at 28 seconds (rather than the former source-specific 32/55 second windows), leaving a reliable margin for the dashboard animation. This applies to both seeded and uploaded data; unfinished live work is represented by the existing safe continuity data instead of holding the screen.

### Single shared node selection architecture

- `components/node-selection-context.tsx` is the canonical React Context for `selectedNodeId`, `selectNode`, and `clearSelection`. `Dashboard` wraps all dashboard children in this provider. The graph, Fingerprint chart, ELI70 copy, node-detail modal, console agent commands, and table-row inspection consume the same selected ID; there is no second local selection state that can drift out of sync.
- `components/entity-graph.tsx` subscribes directly to that context. Every rendered SVG node has keyboard and pointer inspection handlers; selection draws its distinct parchment/gold animated halo while the existing oxblood ring halo remains dedicated to mule-ring membership. Selecting a graph node opens the smooth Framer Motion inspection modal and updates the radar’s Recharts polygon data immediately. The chart retains its `isAnimationActive` transition, so selection A -> B -> C animates a new polygon rather than snapping or flickering.
- `GraphNode` now carries `firstSeen`; `NodeProfile.monitor` now includes `watchSince` and `nextCheckAt`. `lib/agents.ts` creates these from the same transaction/risk record used by the agents. The shared detail modal shows the exact per-node Ingest sub-scores, Graph in/out degree/centrality/cluster, Monitor review times/status, Counterfactual readiness/explanation, and transaction sent/received/counterparty totals. Escape, scrim click, and close button all use the modal’s reverse animation.

### Structured operations seed data

- `lib/workspace-seed.ts` is the sole structured mock-data source for non-live operational history. It contains ten varied historical investigations (Open, Escalated, Closed, Resolved, and False Positive), 46 realistic entities, 20 chronological alerts, four analyst annotations, 21-day report trend data, fraud-pattern distribution, and a case-value leaderboard. Components do not embed these records inline.
- Live `DashboardState` graph/case/alert data is merged over this static operational history, so the live seeded ring remains current while the sidebar is already populated on a fresh visit. Directory rows provide profile/transaction data for every historical entity and reuse the exact same inspection modal used by graph nodes.
- Investigations now shows summary-rich rows plus a detail view with a mini network graph, full four-agent trace, metadata and generated-document list. Entities supports text search plus risk, active-investigation, and activity-date filters. Alerts has a 20+ item chronological feed. Casebook adds a populated annotation archive. Reports has six metric cards, animated 21-day line trend, animated pattern donut/bar charts, and highest-value-case leaderboard. Settings now has populated provider, queue, threshold, motion and label controls.

### Validation

- Live production-server API verification after these contract changes returned a `processingLimitSeconds` value of 40, completed all four agents, and returned a graph node with `firstSeen`, all three Ingest signal values, and the expanded Monitor fields.
- `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` passed after the selection/context and workspace-depth pass.

## Documentation Refresh (2026-08-20)

- Rewrote `README.md` as the human-facing engineering guide. It now documents the product scope, real demo journey, architecture, agent responsibilities, provider fallback/reliability guarantees, 40-second dashboard deadline, seed-data locations, shared selection state, dashboard capabilities, console commands, CSV schema, API routes, repository map, verification commands, deployment guidance, troubleshooting, security boundaries, and production-hardening roadmap.
- `context.md` remains the AI-continuation source of truth; the README intentionally focuses on setup, operation, review, and deployment for human collaborators.

## Formal Project Documentation Deliverable (2026-08-20)

- Generated the root-level `FraudLens_Project_Documentation.docx` as the formal engineering-handoff deliverable for Team XCalibur. It was written from a full source audit rather than copied from earlier plans, README wording, or historical context notes.
- The document explicitly records current implementation divergences: the active startup component is the 4.1-second constellation/progress `ChaseLoader` (not the older CSS chase concept); `PreparationScreen` remains in the repository but is not rendered by `app/page.tsx`; the current orchestrator applies a single 40-second ceiling to seeded and upload paths; the Counterfactual numeric leave-one-out table is fixed scenario data; and workspace/report history is typed seed data rather than durable operational data.
- It also records source-audit constraints: there is no committed `.env.local.example` in the current worktree, no database or deployed-hosting configuration/URL, no automated test suite, and no independently auditable primary sources for the proposal's UPI and text-scam figures. These points are stated as limitations rather than represented as complete features.
- Validation for the documentation handoff: `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` succeeded from the inspected workspace. The final `.docx` package contains 20 native Word tables, a heading-generated table of contents, and a PAGE field in the footer. Microsoft Word updated the TOC and confirmed a 14-page final document.
