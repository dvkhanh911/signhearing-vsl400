# Modern development — SignHearing

Working directory: `D:\SignHearing`, development branch `local`, deployment branch `vercal`.
The app runs directly from this repository; duplicate checkouts were removed.
For the current single-project Vercel configuration and build packaging, see
[Vercel deployment](VERCEL-DEPLOYMENT.md). Cloud routing is handled by the root
service route table; the Next.js backend rewrites below apply to local runs.

## Architecture

```text
Browser :3000
  /, unknown public paths → Next App Router (React, strict TypeScript, Tailwind v4)
  /app/*, /static/*       → same-origin rewrite → FastAPI :8001
                             → original team modules + modern shared UI
  /api/health            → same-origin rewrite → FastAPI liveness
FastAPI database layer   → PostgreSQL (lazy; unused by landing and current modules)
```

This is a progressive migration, not a claim that all 8 learning modules have
been rewritten as React components. Existing JS interactions, browser-only
progress, sample curriculum and video sources stay intact. This avoids a
parallel replacement of working team functionality while creating an API/DB
boundary for future approved work. No authentication, payment, CMS, AI grading,
user/course/progress table or fabricated record was added.

## Prerequisites and installation

Node.js 22 LTS, Python 3.12+, uv. Docker Compose is optional for PostgreSQL.
Exact frontend versions are locked by `package-lock.json`; backend versions by
`uv.lock`. Use `npm ci` and `uv sync --locked` on another machine.

```powershell
cd D:\SignHearing\frontend
npm ci
npm run dev
```

In another terminal:

```powershell
cd D:\SignHearing\backend
uv sync --locked --python 3.12
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Public: `http://127.0.0.1:3000/?lang=vi` or `?lang=en`.
Learning: `http://127.0.0.1:3000/app`. Health: `http://127.0.0.1:8001/api/health`.
The public landing renders while the API/database is offline; learning needs
the API process. Keep Next and API on loopback during local development.

Optional examples: copy `frontend/.env.example` to `frontend/.env.local`, and
`backend/.env.example` to `backend/.env`. API liveness and modules need no DB
URL. `LOCAL_BACKEND_URL` is server-only and local Next rewrites are fixed at build time;
rebuild production after changing the target. Never expose database credentials
using `NEXT_PUBLIC_*`. A shared HTTPS deployment needs an explicit reverse-proxy
trust configuration and tested secure-cookie behavior; it is not deployed here.

This workspace has portable Node at `D:\SignHearing\.tools\node-v22.23.4-win-x64`
and Python 3.12 under `.tools/python`; they are not project dependencies or
Git content. Temporarily add Node to PATH if needed:

```powershell
$env:PATH = 'D:\SignHearing\.tools\node-v22.23.4-win-x64;' + $env:PATH
```

`scripts/start-modern.ps1` starts both processes with hidden windows and logs
under ignored `.runtime/`. For a production preview, first run `npm run build`
in frontend, then invoke `powershell -NoProfile -File scripts/start-modern.ps1 -Production`.
It reuses this project's recorded servers, starts missing services, and checks
homepage/API readiness. Ports owned by unrelated applications are rejected.
`.runtime/processes.json` records the spawned PIDs.
For ordinary foreground development, stop each server with Ctrl+C.

## PostgreSQL

No database connection is made at import, startup, health, or landing render.
`get_engine` is lazy; `get_session` closes each request-owned session and rolls
back failures. Future approved writes must explicitly commit. Do not use schema
creation at startup. `0001_foundation` establishes only Alembic history.

1. Copy root `.env.example` to `.env`, choose a local password.
2. Copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL` to match
   the root password (URL-encode special characters).
3. From the repository root: `docker compose up -d postgres`.
4. From backend: `uv run alembic upgrade head`.
5. From backend: `uv run python -m scripts.check_db` and `uv run alembic current`.
6. Run `uv run pytest -m database` with `DATABASE_URL` exported in the test shell.

Offline setup validation: `uv run alembic upgrade head --sql` with an example
PostgreSQL URL in the shell. This generates SQL; it does not prove connectivity.
Database lives in the named Compose volume. No teardown command deletes it.

## Verification

Frontend: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`,
`npm run build`; start both production processes then `npm run test:http`.
`TEST_URL` can select a separate preview port. Generated content comes from
original locale files, not a second hand-maintained translation source.

Backend: `uv run pytest`, `uv run ruff check app tests alembic scripts`,
`uv run ruff format --check app tests alembic scripts`.

Legacy regression: run `python serve.py --port 8000` separately and execute
`python verify.py`. Module render suites live in `modules/*/tests/check_render.py`;
dashboard has Python unittest and a dependency-free Node state test. Browser
suites in those folders require a connected disposable browser and are not
equivalent to HTTP tests. See `docs/MODERNIZATION-RESULTS.md` for actual results.

## Compatibility and limitations

- `global-not-found.tsx` uses Next's documented experimental `globalNotFound`
  flag to provide a complete localized document with status 404 before hydration.
  Keep the HTTP regression on dependency upgrades. This is the sole framework
  experimental opt-in.
- ESLint 9 is deliberately pinned because the current Next lint plugins declare
  compatibility through 9. ESLint 10 was rejected after checking peer resolution.
  Dev-tool dependency advisories remain; production dependency audit is separate.
- Browser-local progress is origin-scoped. `:8000` and `:3000` have different
  storage; existing state was neither cleared nor migrated. Continue using the
  same origin to retain it. User data has not been uploaded into PostgreSQL.
- Auth, persistent accounts, real learning APIs and AI features require a
  separately approved product phase. The sample/unreviewed status is retained.

## Primary references used

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Next.js not-found conventions](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
- [Tailwind v4 + Next](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [shadcn/ui Next setup](https://ui.shadcn.com/docs/installation/next)
- [Motion accessibility](https://motion.dev/docs/react-accessibility)
- [SQLAlchemy sessions](https://docs.sqlalchemy.org/en/20/orm/session_basics.html)
