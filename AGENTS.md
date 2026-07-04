# CAIF / MediCare — Agent Instructions

**Stack**: TanStack Start (React 19, SSR) + TypeScript + Vite + Tailwind CSS v4 + Drizzle ORM + PostgreSQL 16 + better-auth + Radix UI
**Package Manager**: Bun (`bun.lock`, `bunfig.toml`)

## Commands

```bash
bun dev               # Start dev server (Vite)
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

- **Path alias**: `@/*` → `src/*` (configured in `tsconfig.json`, `vite.config.ts`)
- **Server entry**: `src/server.ts` wraps TanStack Start server for SSR error handling
- **File-based routing**: Routes in `src/routes/`, auto-generated `routeTree.gen.ts` — do NOT edit by hand, exclude from linter/formatter
- **Server-only code**: Use `*.server.ts` suffix or `@tanstack/react-start/server-only` (NOT `server-only` pkg — enforced by ESLint `no-restricted-imports`)
- **Database**: Drizzle ORM with `postgres-js` driver. Schema in `src/db/schema.ts`, client in `src/db/index.ts`
- **Auth**: better-auth (server config in `src/lib/auth.server.ts`, client in `src/lib/auth-client.ts`, React context in `src/lib/auth.tsx`)
- **Auth context**: `AuthProvider` in `src/lib/auth.tsx` with role-based access (`paciente`, `medico`, `recepcionista`, `admin`)
- **Server functions**: Use `createServerFn` from `@tanstack/react-start` (see `src/lib/api/example.functions.ts` for pattern)

## Routing

TanStack Start uses **file-based routing**. Every `.tsx` in `src/routes/` is a route. Do NOT create `src/pages/`, `app/layout.tsx`, or other Next.js/Remix layouts — the only root layout is `src/routes/__root.tsx`.

| File                  | URL                 |
| --------------------- | ------------------- |
| `index.tsx`           | `/`                 |
| `$id.tsx`             | `/:id` (dynamic)    |
| `_layout.tsx`         | layout route        |
| `__root.tsx`          | app shell           |
| `api/auth/$.ts`       | `api/auth/*` (API)  |

## Project Structure

```
src/
├── components/
│   ├── ui/               # Radix-based UI primitives (shadcn-style, via components.json)
│   ├── layout/           # SiteHeader, SiteFooter, DashboardLayout
│   ├── home/             # HomeSections
│   └── PasswordChangeGuard.tsx  # Forces password change if mustChangePassword
├── routes/
│   ├── __root.tsx        # Root layout (AuthProvider + PasswordChangeGuard)
│   ├── login.tsx         # better-auth email/password sign-in
│   ├── register.tsx      # better-auth email/password sign-up (patient registration)
│   ├── change-password.tsx  # Forced password change form
│   ├── api/auth/$.ts     # better-auth REST handler catch-all
│   └── ... (admin.tsx, dashboard.tsx, staff.tsx — still have broken supabase refs)
├── db/
│   ├── schema.ts         # 13 tables: user, session, account, verification, patients, specialties, doctors, doctorSchedules, appointments, galleryImages, notifications
│   ├── index.ts          # Drizzle client (postgres-js)
│   └── seed.ts           # Seeds 8 specialties
├── lib/
│   ├── auth.tsx          # AuthProvider + useAuth hook (uses authClient.getSession())
│   ├── auth.server.ts    # better-auth server config (drizzleAdapter, bcrypt, tanstackStartCookies)
│   ├── auth-client.ts    # createAuthClient + re-exports (signIn, signUp, signOut, useSession)
│   ├── password.ts       # bcryptjs hash/verify + strength validation + default passwords
│   ├── email.ts          # nodemailer transporter + welcome/password-change emails
│   ├── config.server.ts
│   ├── api/              # createServerFn server functions
│   └── error-*.ts        # SSR error capture & rendering
├── middleware.ts          # requireAuth placeholder middleware
├── router.tsx            # Router factory with QueryClient
├── server.ts             # SSR entry with error normalization
├── start.ts              # TanStack Start config (middleware)
├── styles.css            # Tailwind + global styles
└── test/
    └── setup.ts          # Vitest setup (jsdom, testing library matchers)
```

## Phase 1 — Infrastructure & CI/CD (COMPLETE)

- **PostgreSQL 16** via Docker Compose (`docker-compose.yml` at root)
- **Drizzle ORM** with `src/db/schema.ts` (13 tables), `src/db/index.ts`, `src/db/seed.ts`
- **Vitest** (`vitest.config.ts`, `src/test/setup.ts`)
- **GitHub Actions** (`.github/workflows/ci.yml` — continue-on-error for all steps)
- Supabase packages removed; `src/integrations/supabase/` and `src/integrations/lovable/index.ts` deleted
- Packages installed: `drizzle-orm`, `drizzle-kit`, `postgres`, `better-auth`, `bcryptjs`, `nodemailer`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`

## Phase 2 — Auth System (COMPLETE)

- **better-auth** server config with `drizzleAdapter`, `bcrypt` password hashing, `tanstackStartCookies`
- **Schema** rewritten for better-auth: `user` (text id), `session`, `account`, `verification` + app tables
- **AuthProvider** uses `authClient.getSession()` with role extracted from `user.role` (additionalFields)
- **login.tsx** — `authClient.signIn.email()` with role-based redirect (admin→/admin, medico/recepcionista→/staff, paciente→/dashboard)
- **register.tsx** — `authClient.signUp.email()` with firstName/lastName/phone/documentNumber
- **change-password.tsx** — forced password change with Zod-style validation
- **PasswordChangeGuard** — wraps `__root.tsx`; redirects to /change-password if `mustChangePassword`
- **Email** — nodemailer (Gmail SMTP) for welcome + password-change notifications
- **API handler** — `src/routes/api/auth/$.ts` exports `handler` for better-auth REST endpoints

## Known Build State

- `bun run lint`: 39 issues (31 errors, 8 warnings) — all pre-existing `no-explicit-any` in animation components + admin/dashboard/staff routes + 5 new ones in `auth.tsx` for better-auth type casting
- `bunx tsc --noEmit`: ~57 errors — ALL pre-existing `supabase` references in `admin.tsx`, `dashboard.tsx`, `staff.tsx`, `HomeSections.tsx`. **0 errors in Phase 2 files.**
- `bun run build`: Compiles successfully. Warning about `api/auth/$.ts` not exporting a Route is cosmetic (TanStack Start discovers API routes independently).
- Supabase references must be rewritten to Drizzle queries (Phase 3+).

## Gotchas

- **Supabase references broken** in `admin.tsx`, `dashboard.tsx`, `staff.tsx`, `HomeSections.tsx` — need Drizzle rewrite (Phase 3+)
- **No test files yet** — vitest infra is ready (`vitest run` reports "No test files found")
- **Nitro targets Cloudflare** by default (via `@lovable.dev/vite-tanstack-config`)
- **Bun 24h guard**: New package versions blocked for 24h; `@lovable.dev/vite-tanstack-config` excluded
- **`@typescript-eslint/no-unused-vars` disabled** in ESLint; `no-explicit-any` errors exist in legacy code
- **`verbatimModuleSyntax: false`** in tsconfig — allows non-verbatim imports
- **Lovable auto-generated files**: `src/integrations/supabase/` and `src/integrations/lovable/index.ts` have been **deleted** — do not recreate
- **Docker Desktop required** before running `bun run docker:up` (PostgreSQL) then `bun run db:push`
- **`api/auth/$.ts`** exports a `handler` function (not a Route) — it's a TanStack Start API endpoint, not a client-side route
- **`useSession`** from `better-auth/react` is available, but use `useAuth()` from `auth.tsx` for consistent role-based access context

## Environment

- PostgreSQL: `medicare/medicare_local` on port `5432`
- Supabase project: ~~`egyybszzwteizjriptzx`~~ (no longer used)
- Env vars in `.env` (not committed): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SMTP_*`, default passwords
