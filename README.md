# 🧠 cerebro

**English** · [한국어](./README.ko.md)

> An intelligence web service that collects and refines scattered public information about companies, brands, and public figures, then presents it as an **interactive 3D mind map** with a center-and-branch structure.
> Inspired by 'Cerebro' from the *X-Men* films.

Enter a search term and cerebro gathers information from multiple public sources, refines it, and visualizes it as a 3D graph where the most important information is emphasized at the center.
Click a node to open a detail panel with its **summary, usage-perspective report, and sources**.

---

## ✅ Current Status (M1 — Hybrid Search Live)

The core loop runs **end to end**: `search → Cerebro loading → 3D mind map → node detail (summary · usage report · sources)`.

- **Hybrid collection**: `POST /api/search` collects real public information from **Wikipedia + Naver (+ Kakao)** in parallel (partial failures tolerated), refines it, and returns a center-and-branch graph. External responses are validated at runtime with zod; results are cached (30 min) with a mock fallback when sparse.
- **LLM usage-perspective report** (ADR-0008): when `ANTHROPIC_API_KEY` is set, one Claude (Sonnet 4.6) call per search produces a center node = key summary and child `usage` nodes = per-perspective guidance (investing / job-seeking / economy / society / health, etc. — only the relevant ones). **Without a key it falls back automatically to a heuristic (category/topic) graph (zero spend).**
- **Source transparency**: an "N sources analyzed" footer under the graph with per-type badges (Naver · Wikipedia · Kakao), and source attribution in the detail panel.
- **Cinematic 3D mind map** (PR #22): R3F + postprocessing (Bloom), glass icon tiles, labels, and click-to-focus.
- **Shareable deep links**: the search term's source of truth is the URL (`?q=`) — result pages can be shared and reloaded directly.
- **Green quality gate**: 23 test files · 229 cases (API 206 + Web 23); lint · typecheck · build all pass.

> 📋 For what's done and what's next, see **[`docs/STATUS.md`](./docs/STATUS.md)** (read this first when resuming work) · backlog in **[`docs/BACKLOG.md`](./docs/BACKLOG.md)**.

## 🔌 Data Source Status

| Source | Status | Notes |
|---|---|---|
| Wikipedia | ✅ Working | No key required (ko.wikipedia REST) |
| Naver Search | ✅ Working | webkr · news · blog · cafe · kin (single key, 25k calls/day shared) |
| Kakao (Daum) Search | ⏸️ Awaiting key | web · blog · cafe — domestic community coverage. Auto-enabled when `KAKAO_REST_API_KEY` is set (ADR-0007) |
| Broad web search | ⏸️ Deferred | Google = permanently blocked for new customers; Brave = free tier removed 2026-02. First choice for re-introduction is Tavily (ADR-0005) |
| Social (X · Instagram · Facebook) | ⏸️ Deferred | Paid · corporate review · no public-search API (ADR-0007) |

## 🧱 Tech Stack (pnpm monorepo)

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces (Node ≥22, pnpm ≥10) |
| Frontend | Vite 6 · React 18 · TypeScript · React Three Fiber + drei + postprocessing (Three.js) |
| Data fetching | TanStack Query (query-factory pattern) · MSW for test mocking |
| Backend | Node.js · Fastify 5 · TypeScript · zod |
| LLM analysis | `@anthropic-ai/sdk` (Claude Sonnet 4.6, key-gated with fallback) |
| Shared | `packages/shared` — zod contract SSOT (Graph/Source/Search schemas) |
| Infra (MVP) | Frontend = static hosting / API = free tier / DB · Auth = Supabase (planned for M2) |

## 📁 Directory Structure

```
cerebro/
├─ apps/
│  ├─ web/                    # Vite + React + R3F frontend (responsive = web + mobile)
│  │  └─ src/
│  │     ├─ components/       # SearchBar · CerebroLoader · MindMapView · MindMapCanvas · DetailPanel · SourceSummary …
│  │     ├─ hooks/            # useCerebroSearch · useUrlSearchParam (URL = search-term source of truth)
│  │     ├─ queries/          # TanStack Query query-factory (search)
│  │     ├─ api/client.ts     # /api/search client
│  │     └─ lib/              # layout · colors · sources · queryClient
│  └─ api/                    # Node.js + Fastify backend
│     └─ src/
│        ├─ server.ts         # POST /api/search · GET /health (transport only; logic delegated)
│        ├─ search/           # search-orchestrator (validation · cache · fallback · contract guarantee)
│        ├─ sources/          # SourceAdapter: wikipedia · naver · kakao · registry · example
│        ├─ collect/          # normalize · dedup · score(topics) · pii(sensitive-data masking) · orchestrator
│        ├─ analyze/report.ts # LLM usage-perspective analysis (Claude, key-gated · PIPA guard)
│        ├─ graph/build.ts    # collection → GraphSnapshot (strategy dispatcher: analysis/category/topic)
│        ├─ lib/              # http(SSRF-safe) · cache(TTL+LRU) · rate-limit · text
│        └─ env.ts            # zod env validation (optional keys = empty → disabled)
├─ packages/
│  └─ shared/                 # shared zod contracts · constants (change contracts here first)
├─ docs/                      # STATUS · BACKLOG · PRD · ARCHITECTURE · ADR …
├─ .claude/
│  ├─ agents/                 # 8 collaborating agent definitions
│  ├─ rules/                  # dev rules (security · coding-standards · git-workflow)
│  └─ skills/                 # reusable skills (pre-pr-check · start-task)
└─ .github/                   # CI/CD, PR template
```

> **Adding a new source**: implement a `SourceAdapter` in `sources/` and register it in `registry.ts` → SSRF, caching, and fallback are inherited automatically. Gate with `isEnabled()` when a key is required.

## 🚀 Local Development

```bash
pnpm install
pnpm dev                # web :5173 + api :8787 (parallel)

# or run individually
pnpm --filter web dev
pnpm --filter api dev

# full quality gate (currently green)
pnpm typecheck && pnpm test && pnpm lint && pnpm build
```

Check the API on its own:

```bash
curl -s localhost:8787/api/search -X POST \
  -H 'content-type: application/json' \
  -d '{"query":"토스"}'
```

### Environment Variables

Copy `.env.example` to `apps/api/.env` (server-only) / `apps/web/.env` (only `VITE_` is exposed to the client).

| Key | Required | Purpose |
|---|---|---|
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | Recommended | Naver Search API (works with Wikipedia alone if unset) |
| `KAKAO_REST_API_KEY` | Optional | Kakao search (domestic community coverage; disabled if unset) |
| `ANTHROPIC_API_KEY` | Optional | LLM usage report (heuristic fallback if unset, zero spend) |
| `ANALYSIS_MODEL` | Optional | Analysis model override (default `claude-sonnet-4-6`) |

> 🔑 Never expose keys/tokens/passwords in code, docs, commits, or logs. `.env` is gitignored; rotate immediately if a leak is suspected.
> 💸 LLM report cost: one call per search (~$0.03–0.05); cached re-requests cost nothing. To stop spending, remove `ANTHROPIC_API_KEY` from `.env` and it falls back to the heuristic graph automatically (zero cost).

## 🤝 How We Build (Claude Agent Collaboration)

Frontend / Backend / Project Owner / UI·UX Designer / Orchestrator / Cyber Security / Marketer / QA
— eight agents collaborate, review each other, and refactor continuously. Contracts (types/schemas) are agreed in `packages/shared` first, then implemented on both sides; trade-off decisions are recorded as short ADRs (`docs/adr/`).
Principles: **clean code · avoid anti-patterns · guard against over-engineering · state trade-offs explicitly.**

## 🔐 Security / Privacy (PIPA)

- Never commit or share personal data, private keys, or secrets (`.gitignore` + secret scanning).
- Personal information is **limited to public info / public figures**, following Korea's PIPA guardrails. Sensitive data such as national IDs and phone numbers is masked at the collection boundary (`collect/pii.ts`).
- SSRF protection during collection (URL scheme/host allowlist, private-network blocking); robots.txt and ToS are respected.
- Destructive commands (`git reset`, `git push --force`, `eval`, unconditional DROP, etc.) are prohibited.

Details: [`.claude/rules/security.md`](./.claude/rules/security.md) · [`docs/SECURITY.md`](./docs/SECURITY.md)

## 🌿 Branch / PR Workflow

Per-task branch (`<type>/<description>`) → atomic commits/push → PR (template checklist) → CI (lint · typecheck · test · build · secret scan) green → review → **squash merge + delete branch**.
Details: [`.claude/rules/git-workflow.md`](./.claude/rules/git-workflow.md)

## 🌐 Internationalization

The MVP is **Korean-only**. Later it expands to English, Japanese, and more (the i18n structure is considered from the start).

---

📚 More: [`docs/STATUS.md`](./docs/STATUS.md) (current status & resume guide) · [`docs/`](./docs) (PRD · architecture · data · security · UX · GTM · QA) · [`docs/foundation/FOUNDATION-SPEC.md`](./docs/foundation/FOUNDATION-SPEC.md) (SSOT) · [`docs/adr/`](./docs/adr) (decision records)
