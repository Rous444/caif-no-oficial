# Plan: WhatsApp Appointment Reminders

**Status:** Not started
**Estimated effort:** ~200+ lines across 7 files
**Risk:** Medium (schema change + production WhatsApp integration)

---

## Goal

Doctors can opt in to receive their next-day appointment list via WhatsApp at 21:00 ART. Messages are sent as plain text (not PDF) with patient names and times. Messages are staggered (3-5s apart) to avoid WhatsApp bans.

---

## Part A: Render Persistent Disk + Session Persistence

The WhatsApp session (`LocalAuth` data) is currently lost on every Render deploy/restart because the filesystem is ephemeral. Render's Starter plan now supports persistent disks.

### Changes to `render.yaml`

Add `disk` section and env vars to the web service:

```yaml
services:
  - type: web
    name: caif
    runtime: docker
    plan: starter
    region: ohio
    disk:
      name: whatsapp-session
      mountPath: /app/whatsapp-session
      sizeGB: 1
    envVars:
      # ... existing env vars ...
      - key: WHATSAPP_SESSION_PATH
        value: /app/whatsapp-session
      - key: WHATSAPP_TURNERO_TO
        sync: false # set manually in Render dashboard — admin group number
```

### Changes to `Dockerfile`

No code changes needed. The `WHATSAPP_SESSION_PATH` env var is already read by `src/lib/whatsapp.ts:11`. The persistent disk at `/app/whatsapp-session` means `LocalAuth` session survives redeploys.

### Changes to `src/lib/whatsapp.ts`

No changes needed — already reads `process.env.WHATSAPP_SESSION_PATH` with default `./whatsapp-session`.

---

## Part B: Doctor Opt-In for WhatsApp Reminders

Each doctor toggles whether they want daily appointment messages.

### 1. `src/db/schema.ts` — Add column to `doctors` table

```ts
whatsappNotifications: boolean("whatsapp_notifications").default(false),
```

Non-destructive: existing doctors get `false` by default.

### 2. Server function — Toggle endpoint

Add to `src/lib/api/admin-doctors.functions.ts` (or `doctor-schedule.functions.ts`):

```ts
export const updateDoctorWhatsappPreference = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      doctorId: z.string().uuid(),
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await db
      .update(doctors)
      .set({ whatsappNotifications: data.enabled })
      .where(eq(doctors.id, data.doctorId));
    return { success: true };
  });
```

### 3. UI — Add toggle to doctor management

Add a switch/toggle in the admin DoctorsTab or doctor profile edit form:

- Label: "Recibir turnero por WhatsApp"
- Calls `updateDoctorWhatsappPreference` on toggle

### 4. Doctor also needs a phone number

The `user` table already has a `phone` field. When sending, look up the doctor's `user.phone`.

---

## Part C: Per-Doctor WhatsApp Message System

Replace the single-PDF send with per-doctor text messages.

### 1. New file: `src/lib/whatsapp-messages.ts`

```ts
export function formatTurneroForDoctor(appointments: { hora: string; paciente: string }[]): string {
  // Returns:
  // "Turnero del martes 15/07/2026\n\n08:00 - Juan García\n08:30 - María López"
}

export async function sendDoctorTurnero(
  client: any,
  phone: string,
  doctorName: string,
  appointments: { hora: string; paciente: string }[],
): Promise<boolean> {
  // Builds message via formatTurneroForDoctor
  // Sends via client.sendMessage(`${phone}@c.us`, message)
  // Returns true on success, false on failure
}
```

### 2. Rewrite `src/lib/scheduler.ts` — 21:00 cron job

Current flow:

```
getTomorrowAppointments() → generateTurneroPDF() → sendTurneroPDF() to one number
```

New flow:

```
1. getTomorrowAppointments() — same query, but now grouped by doctor
2. For each doctor with whatsappNotifications === true:
   a. Look up doctor's user.phone
   b. Build text message with their appointments
   c. Send via sendDoctorTurnero()
   d. Wait 3-5 seconds (rate limiting)
3. Optionally keep PDF turnero for admin group (WHATSAPP_TURNERO_TO)
```

Rate limiting approach:

```ts
const DELAY_BETWEEN_MESSAGES = 4000; // 4 seconds

for (const doctor of doctorsWithWhatsapp) {
  await sendDoctorTurnero(client, phone, name, appointments);
  await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MESSAGES));
}
```

If WhatsApp disconnects mid-send, log which doctors were skipped.

### 3. Query changes in `src/lib/pdf-turnero.ts`

Add a new function (or modify `getTomorrowAppointments`) that groups by doctor:

```ts
export async function getTomorrowAppointmentsByDoctor(): Promise<
  Map<string, { doctorName: string; phone: string; appointments: TurneroRow[] }>
>;
```

Query:

- Same as current `getTomorrowAppointments()` but JOIN `doctors` → `user` for doctor info
- Filter: `doctors.whatsappNotifications === true`
- Group results by `doctorId`

### 4. Keep existing PDF turnero (optional)

The existing `generateTurneroPDF()` + `sendTurneroPDF()` can still run for the admin group number (`WHATSAPP_TURNERO_TO`). This is separate from the per-doctor messages.

---

## Files to modify

| File                                     | Change                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| `render.yaml`                            | Add disk config + WHATSAPP_SESSION_PATH env var       |
| `src/db/schema.ts`                       | Add `whatsappNotifications` to `doctors` table        |
| `src/lib/scheduler.ts`                   | Rewrite cron to send per-doctor text messages         |
| `src/lib/whatsapp.ts`                    | Add `sendTextMessage()` helper (or reuse in new file) |
| `src/lib/whatsapp-messages.ts`           | **New file** — format + send per-doctor messages      |
| `src/lib/pdf-turnero.ts`                 | Add `getTomorrowAppointmentsByDoctor()` query         |
| `src/lib/api/admin-doctors.functions.ts` | Add `updateDoctorWhatsappPreference` endpoint         |
| Admin UI (DoctorsTab or profile)         | Add opt-in toggle                                     |

---

## Deployment order

1. Export database on Render (backup)
2. Push schema changes locally (`bun db:push`) — adds `whatsappNotifications` column
3. Add persistent disk on Render dashboard
4. Deploy code to GitHub → Render auto-deploys
5. Set `WHATSAPP_TURNERO_TO` in Render dashboard
6. Scan QR code via admin WhatsApp tab (one time — session persists after)
7. Test: create a test appointment for tomorrow, wait for 21:00 or manually trigger

---

## Key gotchas

- **Render free plan spins down after inactivity** — the cron may not fire if no one visits the site at 21:00. Consider a health-check ping or upgrade to Starter.
- **WhatsApp ban risk** — sending too many messages too fast triggers bans. Keep 4-5s delay between messages. Don't send more than ~50 messages/day.
- **Phone number format** — must be international format without `+` (e.g., `5492994567890`).
- **No retry logic** — if a message fails, it's skipped for the day. Simple for v1, can add retry queue later.
- **DB schema change is additive only** — `boolean default(false)` is safe, no data loss.
