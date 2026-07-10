# Implementation Plan

## [Overview]

Refactor the appointment booking system to fix critical bugs (day-offset in recepcionista view, double-booking vulnerability), enhance the landing page with role-based personalized content for authenticated users, and redesign the dashboard header to include a "Volver a Inicio" button and a unified "Mis accesos" dropdown menu for all user roles.

The current system has three interconnected issues that require coordinated fixes. First, the recepcionista appointment creation dialog uses `new Date(selectedDate)` which interprets "YYYY-MM-DD" strings as midnight UTC, causing a 1-day offset in Argentina's UTC-3 timezone when computing `getDay()` for schedule matching. Second, the `bookAppointment` server function only checks for overlap against the first existing appointment with status "pendiente" (`findFirst`), allowing unlimited double-bookings. Third, the landing page shows identical content regardless of authentication state, and the dashboard header lacks a clear "Volver a Inicio" navigation option and a role-aware "Mis accesos" menu.

The solution involves: (1) fixing timezone handling in staff.tsx slot generation by constructing dates in local time, (2) rewriting the overlap check in bookAppointment to query all non-canceled appointments and validate against all of them, (3) adding role-based sections to the landing page Hero component, (4) refactoring DashboardLayout to replace the single "Salir" button with a "Volver a Inicio" button plus a dropdown menu containing role-specific links and "Salir", and (5) ensuring the SiteHeader "Mis accesos" dropdown is also available inside dashboards.

## [Types]

No new types are required. The existing types are sufficient. Minor type adjustments may be needed in the following areas:

- `StaffAppt` in `staff.tsx` (line 56-70): already correctly typed.
- `DoctorAppt` in `doctor.tsx` (line 61-69): already correctly typed.
- `AppRole` in `auth.tsx` (line 4): already covers all roles.
- `ScheduleEntry` in `doctor.tsx` (line 71-75): already correctly typed.

No schema changes are needed. The `appointments` table already has all necessary fields (`scheduledAt`, `durationMinutes`, `status`, `doctorId`).

## [Files]

Modify 6 existing files. No new files, no deleted files.

### Files to Modify:

1. **`src/lib/api/appointments.functions.ts`** — Fix double-booking vulnerability in `bookAppointment`:
   - Change `findFirst` to `findMany` in the overlap check (line 94)
   - Change status filter from `eq(appointments.status, "pendiente")` to `neq(appointments.status, "cancelado")` (line 95)
   - Iterate over all existing appointments to check for overlap instead of just the first one

2. **`src/routes/staff.tsx`** — Fix timezone bug in `NewAppointmentDialog` slot generation:
   - In the `useEffect` at line 630-679, replace `new Date(selectedDate)` with a local-timezone-safe date constructor
   - The fix: parse "YYYY-MM-DD" manually and construct date using `new Date(year, month-1, day)` which uses local timezone
   - Also fix the same pattern in the `handleSubmit` function (line 704-706)

3. **`src/components/layout/DashboardLayout.tsx`** — Redesign header:
   - Replace the single "Salir" button (lines 29-31) with:
     - A "Volver a Inicio" button (link to `/`)
     - A "Mis accesos" dropdown menu (reuse the same pattern from SiteHeader)
     - The dropdown should contain role-specific links based on `user.role`
   - Import necessary components: `DropdownMenu`, `ChevronDown`, role icons

4. **`src/components/layout/SiteHeader.tsx`** — Enhance "Mis accesos" dropdown:
   - Add a "Volver al inicio" option at the top of the dropdown (already has `/dashboard` for patients, but needs to be more explicit)
   - Ensure the dropdown is consistent with the one in DashboardLayout
   - No structural changes needed, just ensure consistency

5. **`src/routes/index.tsx`** — Pass auth context to landing page:
   - Import `useAuth` from `@/lib/auth`
   - Pass `user` and `roles` to the `Hero` component (or render role-specific sections)

6. **`src/components/home/HomeSections.tsx`** — Add role-based personalized sections:
   - Modify the `Hero` component to accept `user` and `roles` props
   - When user is authenticated, show personalized content:
     - For `paciente`: "Tus próximos turnos" summary with quick-access button to `/dashboard`
     - For `medico`: "Tu agenda hoy" summary with quick-access button to `/doctor`
     - For `recepcionista`/`admin`: "Agenda general" with quick-access to `/staff`
   - When user is NOT authenticated, show the current CTA buttons ("Solicitar turno" / "Ver especialidades")
   - Add a visual indicator (e.g., a colored banner or avatar badge) to clearly distinguish authenticated state

## [Functions]

### Modified Functions:

1. **`bookAppointment`** in `src/lib/api/appointments.functions.ts` (line 80-121):
   - **Current**: Uses `findFirst` with `eq(appointments.status, "pendiente")` — only checks first pending appointment
   - **Change**: Use `findMany` with `neq(appointments.status, "cancelado")` — check all non-canceled appointments
   - **New logic**: Query all appointments for the same doctor where status is not "cancelado" and the time ranges overlap. If any exist, throw error.

2. **`handleSubmit`** (inline) in `src/routes/staff.tsx` (line 693-723):
   - **Current**: `new Date(selectedDate)` at line 705 creates UTC-midnight date
   - **Change**: Parse `selectedDate` as `new Date(parseInt(year), parseInt(month)-1, parseInt(day))` for local timezone

3. **Slot generation `useEffect`** in `src/routes/staff.tsx` (line 630-679):
   - **Current**: `new Date(selectedDate)` at line 639 creates UTC-midnight date
   - **Change**: Same local-timezone-safe parsing

4. **`Hero`** in `src/components/home/HomeSections.tsx` (line 43-108):
   - **Current**: No props, static content
   - **Change**: Accept `user` and `roles` props, conditionally render personalized content

### No functions removed.

## [Classes]

No classes are used in this codebase (functional React components only). No class modifications needed.

## [Dependencies]

No new dependencies. No version changes. The existing stack (React 19, TanStack Start, Drizzle ORM, Radix UI, Lucide icons) covers all requirements.

## [Testing]

No existing test files to modify. The project has vitest infra ready but no test files yet.

### Validation Strategy:

1. **Manual test**: Create a doctor with Wednesday schedule. From recepcionista account, create an appointment for Wednesday. Verify it shows on Wednesday, not Thursday.
2. **Manual test**: Book two appointments for the same doctor at the same time from patient account. Second attempt should fail with "horario ya reservado" error.
3. **Manual test**: Book an appointment, cancel it, then book again in the same slot. Should succeed.
4. **Visual test**: Verify landing page shows personalized content when logged in as each role.
5. **Visual test**: Verify dashboard header shows "Volver a Inicio" button and "Mis accesos" dropdown with correct role-specific options.

## [Implementation Order]

Implement changes in dependency order to minimize conflicts and ensure each change can be tested independently.

1. **Fix `bookAppointment` overlap check** (appointments.functions.ts) — Server-side fix for double-booking. This is the most critical bug and independent of other changes.
2. **Fix timezone bug in staff.tsx** — Fix slot generation and handleSubmit in NewAppointmentDialog. Independent of step 1.
3. **Redesign DashboardLayout header** — Replace "Salir" with "Volver a Inicio" + "Mis accesos" dropdown. Independent of steps 1-2.
4. **Enhance landing page** — Add role-based personalized content to Hero section. Depends on step 3 for visual consistency.
5. **Final integration verification** — Test all flows end-to-end.
