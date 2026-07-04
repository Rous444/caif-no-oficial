# Implementation Overview

**Stack**: TanStack Start (React 19, SSR) + TypeScript + Vite + Tailwind CSS v4 + PostgreSQL + better-auth + Drizzle ORM

**Architecture**:

```
Local Dev:     Browser → bun dev → PostgreSQL (Docker) → better-auth → Drizzle ORM
Production:    Browser → Cloud Run → Cloud SQL (PostgreSQL) → better-auth → Drizzle ORM
```

## Phases

| #   | Phase                                                 | Est. Time | Status  |
| --- | ----------------------------------------------------- | --------- | ------- |
| 1   | [Infrastructure & CI/CD](./01-infrastructure-cicd.md) | 2-3h      | Pending |
| 2   | [Auth System](./02-auth-system.md)                    | 3-4h      | Pending |
| 3   | [Server Functions](./03-server-functions.md)          | 4-5h      | Pending |
| 4   | [UI Components](./04-ui-components.md)                | 5-6h      | Pending |
| 5   | [Security Guards](./05-security-guards.md)            | 1-2h      | Pending |
| 6   | [Testing](./06-testing.md)                            | 2-3h      | Pending |

**Total estimated time**: 17-23 hours

## Key Decisions

- **Database**: PostgreSQL via Docker (local) / Cloud SQL (production)
- **ORM**: Drizzle ORM (type-safe, lightweight, great PostgreSQL support)
- **Auth**: better-auth (email/password, sessions, cookie-based)
- **Email**: Gmail SMTP (nodemailer)
- **Password hashing**: bcryptjs (12 salt rounds)
- **Testing**: Vitest + Testing Library
- **CI/CD**: GitHub Actions with PostgreSQL service container

## Files to Delete

```
src/integrations/supabase/
src/integrations/lovable/
```

## Files to Create

See individual phase files for complete file lists.

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://medicare:medicare_local@localhost:5432/medicare

# Auth
BETTER_AUTH_SECRET=<64-char-random-string>
BETTER_AUTH_URL=http://localhost:3000

# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=MediCare <your-email@gmail.com>

# Default passwords
DEFAULT_DOCTOR_PASSWORD=MediCare2026!
DEFAULT_ADMIN_PASSWORD=AdminMediCare2026!
```

## Default User Roles

| Role            | Self-Register | Created By     | Can Login To     |
| --------------- | ------------- | -------------- | ---------------- |
| `paciente`      | Yes           | -              | `/dashboard`     |
| `medico`        | No            | Admin          | `/doctor`        |
| `recepcionista` | No            | Admin          | `/recepcionista` |
| `admin`         | No            | Manual DB seed | `/admin`         |

## Forced Password Change

- Applies to: admin, medico, recepcionista on first login
- Cannot be bypassed (reload, back button, new tab all redirect)
- Route: `/change-password`
- Must change before accessing any other route
