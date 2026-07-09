# CAIF / MediCare — Agent Instructions

**Stack**: TanStack Start (React 19, SSR) + TypeScript + Vite + Tailwind CSS v4 + Drizzle ORM + PostgreSQL 16 + better-auth + Radix UI
**Package Manager**: Bun (`bun.lock`, `bunfig.toml`)

## Commands

```bash
bun dev               # docker compose up -d (PostgreSQL) then vite dev
bun build             # Production build (Vite)
bun build:dev         # Development build
bun preview           # Preview production build
bun lint              # ESLint (run before commit)
bun format            # Prettier format
bun test              # Run vitest tests
bun test:watch        # Vitest watch mode
bun docker:up         # docker compose up -d (PostgreSQL 16)
bun docker:down       # docker compose down
bun db:push           # Push Drizzle schema to DB (CREATE/ALTER tables)
bun db:generate       # Generate SQL migration files
bun db:migrate        # Run pending migrations
bun db:studio         # Drizzle Studio (GUI DB browser)
bun db:seed           # Seed specialties table
```

## Key Conventions

- **Path alias**: `@/*` → `src/*` (configured in `tsconfig.json`, vitest.config.ts)
- **Server entry**: `src/server.ts` wraps TanStack Start server for SSR error handling
- **Auth API**: Handled via middleware in `src/start.ts:19-28` — intercepts `/api/auth/*` and calls `auth.handler(request)`. NOT a route file.
- **Routing**: File-based in `src/routes/`. `routeTree.gen.ts` is auto-generated — do NOT edit by hand.
- **Server-only code**: Use `*.server.ts` suffix or `@tanstack/react-start/server-only` (NOT `server-only` pkg — enforced by ESLint `no-restricted-imports`)
- **Database**: Drizzle ORM with `postgres-js` driver. 13 tables in `src/db/schema.ts`: better-auth tables (`user`, `session`, `account`, `verification`) + app tables (`patients`, `specialties`, `doctors`, `doctorSpecialties` (junction), `doctorSchedules`, `appointments`, `galleryImages`, `medicalRecords`, `notifications`)
- **Auth**: `AuthProvider` in `src/lib/auth.tsx` reads `user.role` from session. Roles: `paciente`, `medico`, `recepcionista`, `admin`. Use `useAuth()` hook (not `useSession` from better-auth/react directly).
- **Server functions**: `createServerFn` from `@tanstack/react-start` with `.inputValidator()` (not `.validator()`). See `src/lib/api/example.functions.ts` for pattern. GET functions cannot use `.inputValidator()` — use POST instead.
- **Server function files**: `src/lib/api/` — 9 files: `admin-doctors`, `admin-users`, `appointments`, `db-helpers`, `doctor-schedule`, `example`, `gallery`, `medical-records`, `specialties`. Importing `db-helpers` from a route file will leak `postgres` into the client bundle — always call server fns from routes, not query helpers.
- **UI**: shadcn-style Radix primitives in `src/components/ui/` via `components.json`. `cn()` from `clsx` + `tailwind-merge` in `src/lib/utils.ts`.
- **Tailwind v4**: CSS-first via `@tailwindcss/vite` plugin (no tailwind.config.\*). Global styles in `src/styles.css` imported via `?url` in `__root.tsx`.
- **Shared layout**: All authed routes (`/dashboard`, `/doctor`, `/staff`, `/admin`) wrap content in `DashboardLayout` from `src/components/layout/DashboardLayout.tsx`.
- **Password change guard**: `src/components/PasswordChangeGuard.tsx` wraps the entire app in `__root.tsx` and auto-redirects users with `mustChangePassword=true` to `/change-password`.
- **Seed defaults**: `bun db:seed` creates specialties and an admin user `admin@medicare.com` with password `AdminMediCare2026!` (`mustChangePassword: true`). Default doctor password: `MediCare2026!`.

## Routes

| Route              | Role                | File                             | Status                        |
| ------------------ | ------------------- | -------------------------------- | ----------------------------- |
| `/`                | Public              | `src/routes/index.tsx`           | OK                            |
| `/login`           | Public              | `src/routes/login.tsx`           | OK                            |
| `/register`        | Public              | `src/routes/register.tsx`        | OK                            |
| `/dashboard`       | paciente            | `src/routes/dashboard.tsx`       | Rewritten (no supabase)       |
| `/doctor`          | medico              | `src/routes/doctor.tsx`          | New — agenda + schedule mgmt  |
| `/staff`           | recepcionista/admin | `src/routes/staff.tsx`           | Cleaned up (no medico filter) |
| `/recepcionista`   | recepcionista/admin | `src/routes/recepcionista.tsx`   | New — redirects to `/staff`   |
| `/admin`           | admin               | `src/routes/admin.tsx`           | New — full panel with 4 tabs  |
| `/change-password` | any authed          | `src/routes/change-password.tsx` | OK                            |

## Known Issues

- **Lint**: pre-existing `no-explicit-any` errors in animation components and legacy routes.
- **TypeScript**: `tsc --noEmit` passes (0 errors).
- **Build**: passes.
- **No test files yet** — vitest infra is ready (`src/test/setup.ts`).

## Gotchas

- Requires Docker Desktop for PostgreSQL. First setup: `bun docker:up` then `bun db:push`.
- `bunfig.toml` has 24h supply-chain guard (`minimumReleaseAge = 86400`); `@lovable.dev/vite-tanstack-config` excluded.
- Nested route param: `$id` (bare `$`). Splat: `$.tsx` → `_splat` param.
- `src/integrations/supabase/` and `src/integrations/lovable/` have been **deleted** — do not recreate.
- `.env` is NOT in `.gitignore` (only `*.local` is). The committed `.env` has dev-only dummy values — never commit real secrets. Keep actual secrets in `.env.local` (gitignored).
- `package-lock.json` exists alongside `bun.lock` — use `bun`, never `npm`/`pnpm`/`yarn`.
- CI order (`.github/workflows/ci.yml`): `bun run lint` → `bunx tsc --noEmit` → `bun run test` → `bun run build`. All steps `continue-on-error: true`.
- `@typescript-eslint/no-unused-vars` disabled in ESLint; `no-explicit-any` errors exist in legacy code.
- `verbatimModuleSyntax: false` in tsconfig — allows non-verbatim imports.
