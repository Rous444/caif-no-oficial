# CAIF / MediCare — Agent Instructions

**Stack**: TanStack Start (React 19, SSR) + TypeScript + Vite + Tailwind CSS v4 + Drizzle ORM + PostgreSQL 16 + better-auth + Radix UI
**Package Manager**: Bun (`bun.lock`, `bunfig.toml`)

## Commands

```bash
bun dev               # docker compose up -d (PostgreSQL) then vite dev (port 8080)
bun build             # Production build (outputs dist/client + dist/server)
bun build:dev         # Development build (Vite)
bun preview           # Preview production build (static client only — use start.js for SSR)
bun lint              # ESLint (run before commit)
bun format            # Prettier format
bun test              # vitest run
bun test:watch        # vitest
bun docker:up         # docker compose up -d (PostgreSQL 16, port 5432)
bun docker:down       # docker compose down
bun db:push           # drizzle-kit push (CREATE/ALTER tables)
bun db:generate       # drizzle-kit generate (SQL migrations)
bun db:migrate        # drizzle-kit migrate
bun db:studio         # Drizzle Studio GUI
bun db:seed           # bun run src/db/seed.ts (8 specialties + admin user)
```

CI order (`.github/workflows/ci.yml`): `bun run lint` → `bunx tsc --noEmit` → `bun run test` → `bun run build`. All steps `continue-on-error: true`. There is no `typecheck` npm script — CI invokes `tsc` directly.

## Production (Render)

- **Dockerfile**: Multi-stage build. Stage 1: install Bun + deps + build. Stage 2: Node 20 + Chromium (for whatsapp-web.js Puppeteer), runs `start.js`.
- **start.js**: Custom Node HTTP server (ESM). Serves static assets from `dist/client/` and forwards all other requests to the TanStack Start SSR handler (`dist/server/server.js`).
- **render.yaml**: Blueprint — web service (Professional plan) + PostgreSQL (Starter plan). Persistent disk at `/app/whatsapp-session` for WhatsApp session persistence.
- **Env vars**: `BETTER_AUTH_URL`, `DATABASE_URL`, `CHROMIUM_PATH`, `TZ=America/Argentina/Buenos_Aires`.
- **Deploy**: Connect repo to Render, use Blueprint (render.yaml). Run `bun db:push && bun db:seed` as a one-off job after first deploy.
- **`.dockerignore`**: Must stay in sync with `.gitignore`. Without it the Docker build context balloons to >500MB and Render builds time out.

## Key Conventions

- **Path alias**: `@/*` → `src/*` (tsconfig.json, vitest.config.ts, vite config)
- **Vite config**: `vite.config.ts` uses `@lovable.dev/vite-tanstack-config` which bundles tanstackStart, viteReact, tailwindcss v4, tsConfigPaths, and nitro build. Do NOT add these plugins manually.
- **Dev server port**: 8080 everywhere (`auth-client.ts` baseURL, `auth.server.ts` baseURL, `.env` `BETTER_AUTH_URL`).
- **Server entry**: `src/server.ts` wraps TanStack Start SSR entry with error capture and h3 error normalization.
- **Auth API**: Handled via middleware in `src/start.ts:19-28` — intercepts `/api/auth/*` and calls `auth.handler(request)`. NOT a TanStack route.
- **Routing**: File-based in `src/routes/`. `routeTree.gen.ts` is auto-generated — do NOT edit by hand.
- **Server-only code**: Use `*.server.ts` suffix or `@tanstack/react-start/server-only` (NOT `server-only` pkg — enforced by ESLint `no-restricted-imports`).
- **Database**: Drizzle ORM with `postgres-js` driver. Module `src/db/index.ts` creates the db client. 13 tables in `src/db/schema.ts`: better-auth tables (`user`, `session`, `account`, `verification`) + app tables (`patients`, `specialties`, `doctors`, `doctorSpecialties` (junction), `doctorSchedules`, `appointments`, `galleryImages`, `medicalRecords`, `notifications`).
- **Auth**: Use `useAuth()` hook from `@/lib/auth` (not `useSession` from better-auth/react). `AuthProvider` wraps the app in `__root.tsx`. Roles: `paciente`, `medico`, `recepcionista`, `admin`.
- **Password change guard**: `src/components/PasswordChangeGuard.tsx` wraps the app in `__root.tsx` and redirects users with `mustChangePassword=true` to `/change-password`.
- **Server functions**: `createServerFn` from `@tanstack/react-start` with `.inputValidator()` (not `.validator()`). GET functions cannot use `.inputValidator()` — use POST. Pattern in `src/lib/api/example.functions.ts`.
- **Server function files**: `src/lib/api/` — 9 files: `admin-doctors`, `admin-users`, `appointments`, `db-helpers.ts` (NOT a server fn — direct db queries), `doctor-schedule`, `example`, `gallery`, `medical-records`, `specialties`. Importing `db-helpers.ts` from a route file leaks `postgres` into the client bundle — always call server fns from routes, not query helpers directly.
- **UI**: shadcn-style Radix primitives in `src/components/ui/` via `components.json`. `cn()` from `clsx` + `tailwind-merge` in `src/lib/utils.ts`.
- **Tailwind v4**: CSS-first via `@tailwindcss/vite` plugin (no `tailwind.config.*`). Global styles in `src/styles.css` imported via `?url` in `__root.tsx`.
- **Shared layout**: All authed routes wrap content in `DashboardLayout` from `src/components/layout/DashboardLayout.tsx`.
- **Seed defaults**: `bun db:seed` creates 8 specialties and admin `admin@medicare.com` / `AdminMediCare2026!` (`mustChangePassword: true`). Default doctor password: `MediCare2026!`. Both overridable via `DEFAULT_DOCTOR_PASSWORD` / `DEFAULT_ADMIN_PASSWORD` env vars.
- **Admin panel**: `/admin` has 4 tabs — Usuarios, Especialidades, Médicos, Galería. Gallery tab is a separate component at `src/components/admin/GalleryTab.tsx`.

## Routes

| Route              | Role                | File                                 |
| ------------------ | ------------------- | ------------------------------------ |
| `/`                | Public              | `src/routes/index.tsx`               |
| `/login`           | Public              | `src/routes/login.tsx`               |
| `/register`        | Public              | `src/routes/register.tsx`            |
| `/dashboard`       | paciente            | `src/routes/dashboard.tsx`           |
| `/doctor`          | medico              | `src/routes/doctor.tsx`              |
| `/staff`           | recepcionista/admin | `src/routes/staff.tsx`               |
| `/recepcionista`   | recepcionista/admin | `src/routes/recepcionista.tsx`       |
| `/admin`           | admin               | `src/routes/admin.tsx`               |
| `/change-password` | any authed          | `src/routes/change-password.tsx`     |

## Known Issues

- **Lint**: pre-existing `no-explicit-any` errors in animation components and legacy routes.
- **TypeScript**: `tsc --noEmit` passes (0 errors).
- **Build**: passes.
- **No test files yet** — vitest infra is ready (`src/test/setup.ts`).

## Gotchas

- Requires Docker Desktop for PostgreSQL. First setup: `bun docker:up` then `bun db:push`.
- `bun dev` runs `docker compose up -d` BEFORE `vite dev`. This starts PostgreSQL. Make sure Docker is running.
- `bunfig.toml` has 24h supply-chain guard (`minimumReleaseAge = 86400`); `@lovable.dev/vite-tanstack-config` excluded.
- `BETTER_AUTH_SECRET` in `.env` is a dev-only dummy value committed to the repo (`.env` is NOT gitignored, only `*.local` is). Never commit real secrets — use `.env.local` for production values.
- `package-lock.json` exists alongside `bun.lock` — use `bun`, never `npm`/`pnpm`/`yarn`.
- Nested route param: `$id` (bare `$`). Splat: `$.tsx` → `_splat` param.
- `src/integrations/supabase/` and `src/integrations/lovable/` deleted — do not recreate.
- `@typescript-eslint/no-unused-vars` disabled; `no-explicit-any` errors exist in legacy code.
- `verbatimModuleSyntax: false` in tsconfig — allows non-verbatim imports.
- `authClient` (`@/lib/auth-client`) has `baseURL: "http://localhost:8080"` — do NOT use it directly in components; use `useAuth()` hook instead.
