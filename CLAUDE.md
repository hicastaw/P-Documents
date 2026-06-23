# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

P-Documents: a document-sharing + AI study platform (upload/search PDFs, RAG chat over document content, real-time quiz leaderboard, forum, admin moderation). Three independently deployable Node/TypeScript apps (`server`, `worker`, `client`) plus Postgres/Redis/RabbitMQ/MinIO/nginx, all wired together by `docker-compose.yml`. No test suite exists anywhere in the repo — `tsc --noEmit` and manual smoke testing through the running stack are the only verification available.

## Commands

Run everything via Docker (each service installs deps and runs its dev script on container start; source dirs are bind-mounted so edits take effect without rebuilding):

```bash
docker compose up -d --build   # build + start full stack (1 api instance, 1 worker instance)
docker compose up -d --build --scale api=3      # 3 api replicas behind nginx (real load balancing, see below)
docker compose up -d --build --scale worker=2   # 2 worker replicas competing for the same RabbitMQ queue, no code changes needed
docker compose logs -f api worker   # tail backend/worker logs
docker compose down             # stop (DB/MinIO data persists via volumes)
```

`api` has no host port mapping (only reachable through nginx) specifically so it can be scaled to N replicas without host-port conflicts — `nginx/nginx.conf` resolves the `api` upstream dynamically (`resolver 127.0.0.11 valid=5s` + variable-based `proxy_pass`), which round-robins across however many `api` containers Docker's embedded DNS returns. Each response carries an `X-Instance-Id` header (`server/src/app.ts`, set from `process.env.HOSTNAME`) so you can verify the distribution: `for i in $(seq 1 10); do curl -s -D - -o /dev/null http://localhost:8888/api/healthz | grep -i x-instance-id; done`.

`GET /documents` (search) is cached in Redis for 30s per `(userId, q, category, page, limit)` key (`services/documents.service.ts`) — response includes `cache: "hit"|"miss"`. No active invalidation on upload/star; the short TTL is the only consistency mechanism, by design.

Quantitative retrieval eval (Precision@K/Recall@K/MRR, baseline waterfall vs current RRF): `docker compose exec api npx ts-node src/scripts/eval-retrieval.ts --k=5 --limit=20` (run from inside the `api` container so `POSTGRES_HOST=postgres` resolves; the script needs documents that already have chunks, i.e. have been processed by the worker).

Metrics: Prometheus at **http://localhost:9091** (`/targets` to check scrape health), Grafana at **http://localhost:3002** (login `admin`/`admin` by default, override via `GRAFANA_ADMIN_PASSWORD`) with a "P-Documents Overview" dashboard auto-provisioned (`infra/grafana/`) showing HTTP request rate, search cache hit ratio, worker processed/failed counts, Postgres active connections. `api` exposes `/metrics` itself (`server/src/config/metrics.ts`); `worker` runs a tiny dedicated HTTP server just for `/metrics` on `METRICS_PORT` (default 9100) since it otherwise has no HTTP listener (`worker/src/metrics.ts`). Known limitation: if `api`/`worker` are scaled to N>1 replicas, Prometheus's static target (`api:3000`/`worker:9100`) only reaches whichever IP Docker's DNS resolves at scrape time, not all replicas — fine for demo-level observability, not a per-replica breakdown.

Local app entry points (each `package.json` has `dev`/`build`/`start`; `server` and `worker` use `nodemon` + `ts-node`, no separate build step needed for dev):
- `server/`: `npm run dev` → `nodemon --exec ts-node src/index.ts` on port 3000
- `client/`: `npm run dev` → `next dev -p 3001`
- `worker/`: `npm run dev` → same nodemon/ts-node pattern, no app HTTP port (consumes RabbitMQ only) besides the `/metrics` listener above

Type-check a single app without running it: `npx tsc --noEmit -p <app>/tsconfig.json`.

Everything is reached through nginx at **http://localhost:8888** (`/` → client, `/api/*` → server with the `/api` prefix stripped, `/socket.io/*` → server, `/minio/*` → MinIO via `minio_proxy`). Direct ports also exposed: Postgres `5433`, Redis `6379`, RabbitMQ UI `15672`, MinIO console `9001`, Prometheus `9091`, Grafana `3002`.

## Architecture

### Server: strict 4-layer, type-first (not feature-first)

`server/src/` is organized by *type* — one flat folder per concern, not one folder per feature:

```
routes/        Router wiring only (method + path → controller fn). No logic, no SQL.
controllers/   HTTP shaping: zod validation, calls service fn(s), maps result/error → res.json/status.
services/      Business rules + orchestration. No req/res, no raw SQL, no express import.
models/        Raw parameterized SQL via the shared pg.Pool (config/db.ts). No business logic.
sockets/       Socket.io emit helpers (e.g. sockets/quiz.socket.ts, sockets/notification.socket.ts),
               invoked from services, not from controllers directly.
middlewares/   requireAuth / requireAdmin (JWT verify + Redis blacklist check + role lookup).
config/        Connection/client bootstrapping only (db, redis, queue, env) — thin, no business logic.
utils/         Stateless helpers with no DB/HTTP dependency (filename sanitizing, prompt templates).
```

One file per module per layer, named `<module>.{routes,controller,service,model}.ts` (e.g. `documents.controller.ts`). There is **no ORM** — `models/*.model.ts` is the only place raw SQL should appear; if you find `pool.query` outside `models/`, that's a layering violation to fix, not a pattern to copy (the one deliberate exception is `scripts/eval-retrieval.ts`, a standalone eval script, not an app code path). Search functions in `models/document.model.ts` build parameterized queries with manually-tracked `$N` placeholder indices (see `searchDocumentsVectorRanked`/`searchDocumentsKeywordRanked`) — never string-interpolate a value into SQL text, even values that originate from a verified JWT.

This structure mirrors a sibling reference project at `evodraw/` (gitignored, not part of this app — kept only for architectural reference). It deliberately does not match a feature-first ("module-per-folder") layout; don't reintroduce one.

### Why this matters for the thesis chapters in `docs/`

`docs/Chuong3_ok.md` documents the system using the Entity-Control-Boundary (ECB) analysis pattern, with UML class/sequence diagrams for each feature module. The mapping to the actual code (stated explicitly in that file, section 3.1.3) is: `controllers/*.controller.ts` ↔ Control stereotype (function names match the documented control-class method names 1:1), `services/*.service.ts` + `models/*.model.ts` jointly ↔ Entity stereotype (split only because there's no ORM to merge business rules with persistence). If you rename a controller function or restructure a module, check whether the thesis diagrams need the same update to stay consistent — that consistency was a deliberate, hard-won design constraint, not an accident.

### Client: Next.js pages router + services/hooks split

`client/pages/` is fixed by Next.js routing (file-based, including dynamic routes like `quiz/[id].tsx`, `forum/[id].tsx`). Supporting code is split by *what it does*, mirroring evodraw's convention:
- `client/services/*.ts` — functions that call the backend (`fetch`/`apiJsonAuth` wrappers), no React. One file per feature (`documentsApi.ts`, `quizApi.ts`, `chatApi.ts`) plus the generic `api.ts` (base URL, auth header, fetch-and-throw helpers) they all build on.
- `client/hooks/*.ts(x)` — React state/context (`auth-context.tsx` exports `AuthProvider` + `useAuth`; `use-require-auth.ts` redirects to `/login` if unauthenticated).
- `client/components/<feature>/` — presentational components grouped by feature (e.g. `components/documents/{DocCard,UploadModal,DocDetailModal,ReportModal,icons}.tsx`), consuming the services/hooks above via props/callbacks rather than fetching directly.

Rule of thumb when adding code: touches `fetch`/the API but no React state → `services/`; touches `useState`/`useContext`/`useEffect` → `hooks/`.

### Document upload bypasses the API server for the file bytes

Upload is presigned-URL based: client calls `POST /documents/presign` (server only generates a MinIO presigned PUT URL), then the browser `PUT`s the file directly to MinIO (via the `minio_proxy` nginx, same-origin under `/minio/`), then calls `POST /documents/complete` to register the row and publish a `document_uploaded` RabbitMQ message. The API server's body size limit never sees the file content — don't add server-side file handling that assumes otherwise.

### Worker: async PDF pipeline, decoupled from the API request lifecycle, with retry + DLQ

`worker/src/index.ts` consumes `document_uploaded` from RabbitMQ: hashes the object (SHA-256) to reject content-duplicates (`status` → `rejected`, no row/file cleanup currently happens), otherwise sets `status` → `approved` immediately, then asynchronously parses the PDF (`pdf-parse`), chunks the text, and calls FPT Cloud's embeddings API to populate `doc_chunks.embedding` (pgvector). `documents.chunk_status` (`pending`/`completed`/`failed`, separate column from `status` — see `infra/postgres/init/004_chunk_retry.sql`) tracks this pipeline specifically. A failure in extract/chunk/embed is **re-thrown** (not swallowed) — the `ch.consume` handler reads a `x-retry-count` message header and retries with exponential backoff (2s/4s/8s, re-publishing the same message via `ch.sendToQueue`) up to `MAX_RETRIES=3`; after that it's pushed to the `document_uploaded.dlq` queue and `chunk_status` is set to `failed`. `worker` has no host port mapping, so it can be scaled (`--scale worker=N`) the same way `api` can — RabbitMQ dispatches competing consumers across replicas with no code changes.

### Search and chat both implement hybrid retrieval via Reciprocal Rank Fusion (RRF), independently

`services/documents.service.ts` (`searchDocuments`) and `services/chat.service.ts` (`retrieveChunks`) each run vector search (pgvector cosine `<=>`) and keyword search **concurrently** (`Promise.all`), then merge the two ranked lists with RRF (`utils/rrf.util.ts`: `score(id) = Σ 1/(k+rank)`, `k=60`) instead of a vector-first/keyword-fallback waterfall. These are two separate implementations by design (different units — documents vs. chunks — and different final ranking: search additionally blends in normalized stars/downloads; chat falls back to first-N-chunks only when *both* sources are empty) — don't assume changing one affects the other. Keyword search covers the **full document content** (`doc_chunks`), not just title/description — that used to be a real gap (AI-unavailable fallback was blind to content, see git history before this was fixed).

Full-text search uses a dedicated `vi_unaccent` text-search configuration (`COPY = simple` + `unaccent` mapping — see `infra/postgres/init/003_fulltext_search.sql`) so queries typed without Vietnamese diacritics still match, backed by GIN indexes (`idx_documents_fulltext`, `idx_doc_chunks_fulltext`) instead of computing `to_tsvector` on the fly — verify with `EXPLAIN ANALYZE`, look for `Bitmap Index Scan` on those index names, not `Seq Scan`.

`scripts/eval-retrieval.ts` measures Precision@K/Recall@K/MRR for the current RRF implementation against a reconstructed copy of the old waterfall baseline (the real baseline code no longer exists in `models`/`services` — see the script's own comments for why re-implementing it inline there is the deliberate exception to "no `pool.query` outside `models/`"). Treat its corpus (document title used as the test query, expected = that same document) as a weak-supervision proxy, not ground truth, when citing numbers.

### Observability: metrics only (deliberately no centralized logs, no distributed tracing)

`api` (`config/metrics.ts` + middleware in `app.ts`) and `worker` (`metrics.ts`, its own tiny `http` server since the worker has no app HTTP listener otherwise) each expose Prometheus-format `/metrics` via `prom-client`: request count/duration histograms, the search cache hit/miss counter, and worker `documents_processed_total`/`documents_failed_total{stage}` (mirrors the retry/DLQ outcomes above). Postgres/Redis/RabbitMQ are scraped via their own official exporters (`postgres_exporter`, `redis_exporter`, and RabbitMQ's built-in `rabbitmq_prometheus` plugin enabled via the `rabbitmq` service's `command` override) rather than anything custom. Prometheus (`infra/prometheus/prometheus.yml`) scrapes all of the above; Grafana auto-provisions the Prometheus datasource and the "P-Documents Overview" dashboard from `infra/grafana/`. Log aggregation (Loki/ELK) and distributed tracing (OpenTelemetry/Jaeger) were deliberately skipped — `docker compose logs` is sufficient at this service count, and correctly propagating trace context across the RabbitMQ publish/consume boundary is a disproportionate amount of risk/effort for the payoff at this scale.

### Auth

JWT access + refresh tokens (`services/auth.service.ts`), access token TTL short-lived; logout blacklists the token's `jti` in Redis (`config/redis.ts`) so `middlewares/auth.middleware.ts`'s `requireAuth` rejects it immediately even before natural expiry. `requireAdmin` wraps `requireAuth` and additionally checks `users.role` via `models/user.model.ts`. There's a hardcoded system-admin account (`system@pdocs.local`) that `services/admin.service.ts` refuses to delete or demote — preserve that guard if touching user-deletion/role-change logic.
