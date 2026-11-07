# SignHearing frontend deployment

## Architecture and scope

The public app is Next.js 16.4.3 / React 19.3.1 in `frontend/`, using the existing
Node 22 lockfile, local brand assets, Motion and VI/EN dictionaries. FastAPI in
`backend/` serves the legacy learning modules and static learning media. SQLAlchemy,
psycopg and Alembic provide a PostgreSQL foundation; production persistence and
real account authentication are not implemented. There is no active AI inference
endpoint or deployed model.

This branch keeps the public UI intact. When `BACKEND_URL` is absent, homepage and
Features still run; `/app`, its nested routes and `/login` show a localized,
accessible availability page. API requests return uncached HTTP 503 with
`BACKEND_NOT_CONFIGURED`. With a configured backend, the existing before-files
rewrites take priority and restore the learning routes without frontend changes.

## Vercel project settings

- Team: `SignHearing` / `sign-hearing`, Hobby.
- Project: `signhearing-vsl400`.
- Framework: Next.js; Root Directory: `frontend`.
- Node: `22.x`; install: `npm ci`; build: `npm run build`.
- Output: framework default.
- Include source files outside Root Directory: enabled. The content-sync build
  reads the root `locales/`, `app_shell/locales/`, `modules/*/locales/` and
  `static/assets/`. These source files must remain available to the build.
- Preview is authorized. Production requires the user's separate confirmation.
- `.vercel/`, `.env*`, dependencies and generated output stay out of Git or CLI
  uploads. Credentials are never placed in source or frontend public variables.

## Environment variables

| Variable | Preview now | Production / later |
| --- | --- | --- |
| `BACKEND_URL` | Unset | Unset until a real HTTPS FastAPI origin is available |
| `SITE_URL` | Unset; use Vercel's actual `VERCEL_URL` | Optional real public HTTPS origin |
| `VERCEL_URL` | Supplied by Vercel | Supplied by Vercel |
| `DATABASE_URL` | Not a frontend variable | Backend only, secret PostgreSQL URL |

No production backend URL is fabricated. Local backend testing requires explicitly
setting `BACKEND_URL=http://127.0.0.1:8001` outside Vercel. On Vercel, HTTP and
loopback backend targets are rejected. Changing `BACKEND_URL` requires a rebuild
because Next.js compiles the rewrite manifest during the build.

## Checks

From `frontend/`, with Node 22:

```text
npm ci
npm run sync:content
npm test
npm run lint
npm run typecheck
npm run build
```

For a frontend-only server, run `npm run test:standalone` with `TEST_URL` set to
the server origin. Existing backend-connected HTTP and browser suites remain
available for an environment built with a real or explicitly local backend.

## GitHub collaboration

Configuration is isolated on `deploy/vercel-20261107`; no branch is force-pushed
and no default branch is reset. At inspection the repository has
`feature/homepage`, but no `main` branch. The deployment PR therefore targets
`feature/homepage`; creating/selecting `main` as the reviewed production branch
must be coordinated with the team before automatic Production deployments.

Once the user approves Production, connect the existing GitHub repository in
Vercel, set the agreed `main` branch as Production Branch, and keep branch Preview
deployments enabled. Team members then open feature PRs, review their Preview URL
and merge into `main` to update Production. Until that approval, deployments must
explicitly target Preview; do not run `vercel --prod` or promote a deployment.

## Backend and database follow-up

A suitable free trial setup is FastAPI on Render Free and PostgreSQL on Neon Free.
Keep the repository root available to FastAPI, since it reads sibling module and
asset directories. A possible service build command is `pip install ./backend`;
start with `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`.
Configure the actual database URL only in the backend, with the required
`postgresql+psycopg` scheme and TLS. Review models and migrations before applying
them; the current foundation does not implement account/progress synchronization.

After backend health and learning routes work over HTTPS, set that actual origin
as `BACKEND_URL` on Preview, redeploy, and run the backend-connected test suites.
Only then consider applying the same configuration to Production. AI needs a
separate implementation and resource plan when real inference is added.

Render Free sleeps after idle periods and has ephemeral local storage, so media
uploads and persistent data must not depend on that local filesystem. Neon has a
free PostgreSQL tier; check current limits before use:

- [Vercel monorepo source files](https://vercel.com/docs/monorepos/monorepo-faq)
- [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Render Free limits](https://render.com/docs/free)
- [Neon Free plan](https://neon.com/blog/neon-free-plan-1-gb-per-project)

Preview URL, verification and PR status are recorded after Vercel confirms the
deployment is ready. No Production deployment has been authorized.
