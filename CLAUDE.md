# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

P-Documents: a document-sharing + AI study platform (upload/search PDFs, RAG chat over document content, real-time quiz leaderboard, forum, admin moderation). Three independently deployable Node/TypeScript apps (`server`, `worker`, `client`) plus Postgres/Redis/RabbitMQ/MinIO/nginx, all wired together by `docker-compose.yml`. No test suite exists anywhere in the repo — `tsc --noEmit` and manual smoke testing through the running stack are the only verification available.

## Commands

Run everything via Docker (each service installs deps and runs its dev script on container start; source dirs are bind-mounted so edits take effect without rebuilding):

```bash
docker compose up -d --build   # build + start full stack
docker compose logs -f api worker   # tail backend/worker logs
docker compose down             # stop (DB/MinIO data persists via volumes)
```

Local app entry points (each `package.json` has `dev`/`build`/`start`; `server` and `worker` use `nodemon` + `ts-node`, no separate build step needed for dev):
- `server/`: `npm run dev` → `nodemon --exec ts-node src/index.ts` on port 3000
- `client/`: `npm run dev` → `next dev -p 3001`
- `worker/`: `npm run dev` → same nodemon/ts-node pattern, no HTTP port (consumes RabbitMQ only)

Type-check a single app without running it: `npx tsc --noEmit -p <app>/tsconfig.json`.

Everything is reached through nginx at **http://localhost:8888** (`/` → client, `/api/*` → server with the `/api` prefix stripped, `/socket.io/*` → server, `/minio/*` → MinIO via `minio_proxy`). Direct ports also exposed: Postgres `5433`, Redis `6379`, RabbitMQ UI `15672`, MinIO console `9001`.

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

One file per module per layer, named `<module>.{routes,controller,service,model}.ts` (e.g. `documents.controller.ts`). There is **no ORM** — `models/*.model.ts` is the only place raw SQL should appear; if you find `pool.query` outside `models/`, that's a layering violation to fix, not a pattern to copy. Search functions in `models/document.model.ts` build parameterized queries with manually-tracked `$N` placeholder indices (see `searchDocumentsVector`/`searchDocumentsKeyword`) — never string-interpolate a value into SQL text, even values that originate from a verified JWT.

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

### Worker: async PDF pipeline, decoupled from the API request lifecycle

`worker/src/index.ts` consumes `document_uploaded` from RabbitMQ: hashes the object (SHA-256) to reject content-duplicates (status → `rejected`, no row/file cleanup currently happens), otherwise sets status → `approved` immediately, then asynchronously parses the PDF (`pdf-parse`), chunks the text, and calls FPT Cloud's embeddings API to populate `doc_chunks.embedding` (pgvector). Chunking/embedding failures are caught and logged but never change `documents.status` — a document can be `approved` with zero usable chunks if that background step fails.

### Search and chat both implement the same hybrid-retrieval pattern independently

`services/documents.service.ts` (full-text document search) and `services/chat.service.ts` (RAG retrieval for `doc_chunks`) each: try FPT Cloud embeddings → pgvector cosine search (`<=>` operator) first, fall back to `ILIKE` keyword search if no embedding or no API key. These are two separate implementations by design (different tables/ranking — search blends vector score with stars/downloads; chat has a further first-N-chunks fallback) — don't assume changing one affects the other.

### Auth

JWT access + refresh tokens (`services/auth.service.ts`), access token TTL short-lived; logout blacklists the token's `jti` in Redis (`config/redis.ts`) so `middlewares/auth.middleware.ts`'s `requireAuth` rejects it immediately even before natural expiry. `requireAdmin` wraps `requireAuth` and additionally checks `users.role` via `models/user.model.ts`. There's a hardcoded system-admin account (`system@pdocs.local`) that `services/admin.service.ts` refuses to delete or demote — preserve that guard if touching user-deletion/role-change logic.
