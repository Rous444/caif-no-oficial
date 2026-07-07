# MediCare Design System — Changelog

All notable changes to the MediCare design system and UI are tracked in this file.

## [Unreleased]

### Added

- Phase 1: Foundation — framer-motion dependency, design token update, shadow utilities

### Added (Supabase → Drizzle migration)

- **`admin.tsx`** — Full admin panel with 4 tabs: Usuarios (search, role filter, create doctor/recepcionista, toggle active, delete), Especialidades (CRUD cards with edit/create dialog), Médicos (table with edit dialog for specialty, license, bio, slot duration, active), Galería (image grid with delete)
- **`doctor.tsx`** — Doctor dashboard with 2 tabs: Agenda (day/week view, confirm/complete/cancel/reprogram appointments via `getDoctorAppointments`), Horarios (weekly schedule management via `updateMySchedule` — add/remove time slots per day)
- **`recepcionista.tsx`** — New route that redirects to `/staff` for role-based navigation

### Changed

- **`staff.tsx`** — Removed doctor-specific code (`getDoctorIdByUserId` query, client-side filter); guard changed from `medico || recepcionista || admin` to `recepcionista || admin` (doctors now use `/doctor` route)
- **`AGENTS.md`** — Routes table updated with new `/doctor`, `/recepcionista`, `/admin` entries; removed outdated known issues

### Fixed

- **`admin.tsx`** — Role filter uses `"all"` instead of `" "` for "Todos"; gallery tab uses `getAllGalleryImages` instead of `getActiveGalleryImages`; role query param omitted when filter is `"all"`

## [0.2.0] — 2026-07-07

### Added

- **Schema**: `doctor_specialties` junction table (many-to-many doctor↔specialty), `insurance_companies` text array on `doctors` table
- **Server functions**: `getMyDoctorProfile`, `updateMyInsurance` in `doctor-schedule.functions`; `getDoctorsBySpecialty` now queries through junction table; `updateDoctor`/`deleteDoctor` handle multi-specialty + insurance cascade
- **`doctor.tsx`** — "Obras Sociales" tab: tag-input for insurance companies management, displays doctor's specialties
- **`admin.tsx`** — Create doctor dialog uses multi-select specialty toggle buttons; Doctor edit dialog has multi-specialty selector + insurance tag-input
- **`dashboard.tsx`** — Patients see accepted insurance companies as tags when selecting a doctor; booking uses doctor's `slotMinutes` instead of hardcoded 30
- **`staff.tsx`** — Appointment cards show insurance info per doctor
- **`db-helpers.ts`** — `getDoctorByUserId` includes specialties relation

### Changed

- **`login.tsx`** — Fixed broken error handling (previously showed "success" and redirected on failure); now displays actual error message and stays on login page
- **`auth.server.ts`** — `mustChangePassword` added to session `additionalFields` for reliable detection on login redirect
- **`admin-users.functions.ts`** — `createDoctorAccount` accepts `specialtyIds` array + `insuranceCompanies`; inserts junction rows
- **`admin-doctors.functions.ts`** — All CRUD functions updated for many-to-many specialties and insuranceCompanies field

### Fixed

- TypeScript errors: null-safe access for `insuranceCompanies` in admin.tsx and staff.tsx; variable hoisting in dashboard.tsx
- Schema: `bun db:push` applied successfully — new `doctor_specialties` table + `insurance_companies` column

### [0.1.0] — YYYY-MM-DD

### Added

- Initial project setup
