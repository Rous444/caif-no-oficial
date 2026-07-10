# CAIF / MediCare — Agent Instructions

**Stack**: TanStack Start (React 19, SSR) + TypeScript + Vite + Tailwind CSS v4 + Drizzle ORM + PostgreSQL 16 + better-auth + Radix UI
**Package Manager**: Bun (`bun.lock`, `bunfig.toml`)

## Commands

```bash
bun dev               # docker compose up -d (PostgreSQL) then vite dev (port 8080)
bun build             # Production build (outputs dist/client + dist/server)
bun build:dev         # Vite build --mode development
bun preview           # vite preview (static client only — use start.js for SSR)
bun lint              # eslint . (run before commit)
bun format            # prettier --write .
bun test              # vitest run
bun test:watch        # vitest
bun docker:up         # docker compose up -d (PostgreSQL 16, port 5432)
bun docker:down       # docker compose down
bun db:push           # drizzle-kit push (CREATE/ALTER tables)
bun db:generate       # drizzle-kit generate (migrations to src/db/migrations/)
bun db:migrate        # drizzle-kit migrate
bun db:studio         # Drizzle Studio GUI
bun db:seed           # bun run src/db/seed.ts (8 specialties + admin user)
```

CI (`.github/workflows/ci.yml`): `bun run lint` → `bunx tsc --noEmit` → `bun run test` → `bun run build`. All steps `continue-on-error: true`. No `typecheck` npm script — CI runs `tsc` directly.

## Architecture

- **Vite config**: `vite.config.ts` uses `@lovable.dev/vite-tanstack-config` which bundles tanstackStart, viteReact, tailwindcss, tsConfigPaths, and nitro build. Do NOT add these plugins manually.
- **Server entry**: `src/server.ts` launches the daily scheduler + wraps SSR with error capture. Exports `{ fetch() }` for the runtime.
- **App entry**: `src/start.ts` creates `startInstance` with middlewares for auth (`/api/auth/*`) and WhatsApp (`/api/whatsapp/*`). NOT TanStack routes.
- **Routing**: File-based in `src/routes/`. `routeTree.gen.ts` is auto-generated — do NOT edit.
- **Server-only code**: Use `*.server.ts` suffix or `@tanstack/react-start/server-only` (NOT `server-only` package — enforced by ESLint `no-restricted-imports`).
- **Dev port**: 8080 everywhere (`auth-client.ts`, `.env` `BETTER_AUTH_URL`).
- **CSS**: Tailwind v4 CSS-first via `@tailwindcss/vite` plugin (no `tailwind.config.*`). Styles in `src/styles.css` imported via `?url` in `__root.tsx` as a link rel=stylesheet.

## Auth

- Use `useAuth()` hook from `@/lib/auth` (`.tsx`, not `.ts`). Never use `useSession` from `better-auth/react` or `authClient` directly in components.
- `AuthProvider` + `PasswordChangeGuard` wrap the app in `__root.tsx`. Users with `mustChangePassword=true` are redirected to `/change-password`.
- Roles: `paciente`, `medico`, `recepcionista`, `admin`.

## Server Functions

- `createServerFn` from `@tanstack/react-start` with `.inputValidator()` (NOT `.validator()`).
- GET functions cannot use `.inputValidator()` — use POST.
- All server function files in `src/lib/api/` (10 files): `admin-doctors`, `admin-users`, `appointments`, `doctor-schedule`, `example`, `gallery`, `medical-records`, `profile`, `specialties` — plus `db-helpers.ts` (NOT a server fn, direct db queries). Importing `db-helpers.ts` from a route file leaks `postgres` into the client bundle — always call server fns from routes.

## Database

- Drizzle ORM with `postgres-js` driver. `src/db/index.ts` creates `db` client. Config in `drizzle.config.ts` (schema: `src/db/schema.ts`, dialect: postgresql, migrations dir: `src/db/migrations/`).
- 13 tables: `user`, `session`, `account`, `verification` (better-auth) + `patients`, `specialties`, `doctors`, `doctorSpecialties` (junction, unique `doctorId+specialtyId`), `doctorSchedules`, `appointments`, `galleryImages`, `medicalRecords`, `notifications`.

## Business Rules

- **Softlock**: System unavailable outside 08:00–21:00 ARG time. `SoftlockBanner` in `DashboardLayout` shows banner; `throwIfSoftlocked()` blocks server operations.
- **Daily scheduler**: `src/lib/scheduler.ts` runs at 21:00 ARG via `node-cron`. Generates next-day turnero PDF via `pdf-turnero.ts` and sends via WhatsApp (`whatsapp.ts`). WhatsApp client starts on server boot.
- **WhatsApp endpoints** (middleware in `start.ts`): `/api/whatsapp/status`, `/api/whatsapp/restart`, `/api/whatsapp/qr-image`.

## Production (Render)

- **Dockerfile**: Multi-stage. Stage 1: Bun install + build. Stage 2: Node 20 + Chromium (for whatsapp-web.js Puppeteer). Bun kept in runtime image for `bunx drizzle-kit push` + seed in CMD, then `node start.js` for HTTP.
- **start.js**: Custom Node HTTP server (ESM). Serves `dist/client/` static assets; proxies everything else to `dist/server/server.js` SSR handler. Port from `$PORT` env (default 8080).
- **render.yaml**: Blueprint — web service (Starter) + PostgreSQL (Starter, 256 MB). Env: `BETTER_AUTH_URL`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `TZ=America/Argentina/Buenos_Aires`, `DEFAULT_DOCTOR_PASSWORD`, `DEFAULT_ADMIN_PASSWORD`.
- **`.dockerignore`**: Must stay in sync with `.gitignore`. Without it build context balloons and Render builds time out.

### Deployment caution

- **Live on Render**: Web service (Starter plan) + PostgreSQL (256 MB). Treat production as fragile.
- **DB schema changes**: Always verify with `bun db:push` locally against a full copy before pushing. Avoid destructive migrations — prefer additive changes. The Render PostgreSQL plan has limited storage and no point-in-time recovery.
- **Deploy window**: Only deploy between 21:00–08:00 ARG (the maintenance/softlock window). Outside hours the system is serving patients — a broken deploy means downtime during active hours.

## Seed Defaults

- Admin: `admin@medicare.com` / `AdminMediCare2026!` (`mustChangePassword: true`)
- Doctor default password: `MediCare2026!`
- Both overridable via `DEFAULT_DOCTOR_PASSWORD` / `DEFAULT_ADMIN_PASSWORD` env vars.

## Gotchas

- Requires Docker Desktop for PostgreSQL. First setup: `bun docker:up` then `bun db:push`.
- `bun dev` starts Docker PostgreSQL before Vite. Make sure Docker is running.
- `bunfig.toml` has 24h supply-chain guard (`minimumReleaseAge = 86400`); `@lovable.dev/vite-tanstack-config` excluded.
- `.env` is committed (only `*.local` is gitignored). `BETTER_AUTH_SECRET` in `.env` is a dev dummy. Never commit real secrets — use `.env.local`.
- `package-lock.json` exists alongside `bun.lock` — use `bun`, never `npm`/`pnpm`/`yarn`.
- Nested route param: `$id` (bare `$`). Splat: `$.tsx` → `_splat` param.
- `verbatimModuleSyntax: false` — allows non-verbatim imports.
- `@typescript-eslint/no-unused-vars` is off. Most lint errors are `prettier/prettier` CRLF line-ending issues.
- `components.json` has `@react-bits` registry configured.
- Admin gallery tab: separate component at `src/components/admin/GalleryTab.tsx`.
- Path alias: `@/*` → `src/*` (tsconfig, vitest, vite config).
- Test suite is currently empty — no `*.test.ts` files exist. `bun test` passes vacuously. Tests live in `src/test/` (vitest + jsdom + `@testing-library`).

## Mobile Responsive Conventions

- Tab bars with many items: wrap `<TabsList>` in `<div className="overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0">` with icon-only labels (`<span className="hidden sm:inline">`). Used in doctor, staff, admin panels.
- Data tables → card lists on mobile: `hidden md:block` wrapper for `<table>` + `md:hidden space-y-3` for cards. Used in admin UsersTab, DoctorsTab.
- Touch targets: icon-only action buttons get `min-h-[44px] min-w-[44px]`.
- Hover-only overlays (admin gallery): add `opacity-100 md:opacity-0` so touch users always see controls.
