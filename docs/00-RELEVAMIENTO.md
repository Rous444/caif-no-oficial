# 00 — Relevamiento y Hallazgos (CAIF)

> Documento de referencia. **Todos los planes de `docs/` asumen que este archivo fue leído primero.**
> Es la fuente de verdad sobre cómo funciona hoy el sistema y qué está roto.

---

## 1. Qué es el sistema (realidad, sin idealizar)

CAIF es un sistema de **reserva de turnos** para un consultorio médico (no un "turnero de llamado en sala" — ver §6, decisión confirmada: **no** habrá display de sala).

Es una SPA con SSR (TanStack Start) que expone **server functions** (RPCs HTTP POST) consumidas desde React con React Query. El estado del turno son filas en Postgres. La lógica de negocio (generación de slots, solapamientos, permisos) vive **en los componentes React**, con copias parciales y divergentes en el servidor.

Un side-channel de WhatsApp (whatsapp-web.js + Chromium/Puppeteer, **en el mismo proceso web**) manda a las 21:00 ARG a cada médico su lista de turnos del día siguiente.

### Stack
- **Runtime**: TanStack Start (React 19 SSR) + Vite. En prod: proxy Node casero [`start.js`](../start.js) sobre Render **Starter (512 MB)**.
- **DB**: PostgreSQL **plan free/256 MB, sin point-in-time recovery**. Drizzle ORM + postgres-js.
- **Auth**: better-auth (roles `paciente|medico|recepcionista|admin`), con `AuthProvider` casero en cliente ([`src/lib/auth.tsx`](../src/lib/auth.tsx)).
- **WhatsApp**: whatsapp-web.js + Chromium, orquestado por node-cron ([`src/lib/scheduler.ts`](../src/lib/scheduler.ts)).
- **Deploy**: Docker multi-stage, disco persistente en `/var/data` para la sesión de WhatsApp ([`render.yaml`](../render.yaml)).

### Modelo de datos ([`src/db/schema.ts`](../src/db/schema.ts))
better-auth (`user`, `session`, `account`, `verification`) + `patients`, `specialties`, `doctors`, `doctorSpecialties` (junción), `doctorSchedules`, `appointments`, `galleryImages`, `medicalRecords`, `notifications`.

- `appointments.status`: `pendiente | confirmado | cancelado | completado | ausente`. Default `pendiente`.
- `notifications`: **existe en el schema pero no se usa en ningún lado** (feature planeada — ver `PLAN-whatsapp-reminders.md`).
- `medicalRecords.fileData` y `galleryImages.fileData`: **archivos en base64 dentro de columnas `text`** (hasta 20 MB c/u), en un Postgres de 256 MB.

### Flujo del turno (real)
1. **Creación**: paciente reserva en [`dashboard.tsx`](../src/routes/dashboard.tsx); recepción en [`staff.tsx`](../src/routes/staff.tsx); médico en [`doctor.tsx`](../src/routes/doctor.tsx). Todo entra `pendiente`. Los slots se generan **en el cliente**.
2. **Avance**: botones → `updateAppointmentStatus` (UPDATE directo, sin validar transición).
3. **Cierre**: no hay. El turnero de mañana se materializa como mensaje WhatsApp a las 21:00.
4. **Sincronización entre pantallas**: ninguna activa (solo `refetchOnWindowFocus` default + `refetch()` tras acción propia).

---

## 2. Hallazgos por severidad

### CRÍTICOS

| ID | Hallazgo | Ubicación |
|----|----------|-----------|
| **C1** | **Ninguna server function verifica sesión ni rol.** Toda la API es pública. `curl` sin cookie puede: resetear la contraseña de cualquiera (incl. admin), leer/borrar fichas médicas por UUID, dumpear pacientes (nombre/tel/email/DNI), manipular turnos y cuentas. | Todo `src/lib/api/*` |
| **C2** | **Endpoints WhatsApp sin auth.** `/api/whatsapp/qr-image` expone el QR de vinculación (→ secuestro del WhatsApp de la clínica); `/api/whatsapp/send-test` manda mensajes arbitrarios desde el número de la clínica; `/api/whatsapp/restart` tira el cliente. | [`start.ts:25-69`](../src/start.ts) |
| **C3** | **Race condition en `bookAppointment`**: check-then-insert sin transacción ni constraint → doble turno en el mismo slot. Además carga todos los turnos históricos del médico en memoria. | [`appointments.functions.ts:97-107`](../src/lib/api/appointments.functions.ts) |
| **C4** | **`rescheduleAppointment` no valida solapamiento** (pese a que la UI dice que sí), ni horario del médico, ni pasado. Resetea estado a `pendiente` sin avisar. | [`appointments.functions.ts:165`](../src/lib/api/appointments.functions.ts) |
| **C5** | **El turnero WhatsApp solo incluye `pendiente`** → los turnos que recepción confirmó **desaparecen** del listado del médico. (Confirmado: debe ser `pendiente` + `confirmado`.) | [`pdf-turnero.ts:110`](../src/lib/pdf-turnero.ts) |
| **C6** | **Sin máquina de estados**: `updateAppointmentStatus` acepta cualquier transición (`completado→pendiente`, `cancelado→confirmado`). | [`appointments.functions.ts:189`](../src/lib/api/appointments.functions.ts) |
| **C7 (PROD)** | **`pdfkit` en producción → `ERR_MODULE_NOT_FOUND`.** El runtime hace `bun install --production` y `pdfkit`/`qrcode` están en devDependencies. Rompe el turnero nocturno y el QR. | [`Dockerfile:43`](../Dockerfile), [`package.json:113-115`](../package.json) |
| **C8 (PROD)** | **Chromium no arranca: SingletonLock (Code 21).** El perfil vive en `/var/data`; un contenedor previo dejó un lock con hostname viejo. | [`whatsapp.ts:65`](../src/lib/whatsapp.ts), [`render.yaml:27`](../render.yaml) |

### MEDIOS

| ID | Hallazgo | Ubicación |
|----|----------|-----------|
| **M1** | **Vista "Semana" de recepción solo trae el lunes**: la query manda un solo día también en modo semana. Las otras 6 columnas siempre vacías. | [`staff.tsx:116-123`](../src/routes/staff.tsx) |
| **M2** | **`updateMySchedule` = DELETE all + INSERT sin transacción**: un fallo intermedio deja al médico sin horarios (desaparece de la reserva). No valida solapamiento entre bloques. | [`doctor-schedule.functions.ts:74`](../src/lib/api/doctor-schedule.functions.ts) |
| **M3** | **`deleteUser` revienta con FK**: `appointments.patientId/doctorId` sin `onDelete`. Borrar un usuario con turnos lanza violación de FK → toast genérico. | [`schema.ts:137-142`](../src/db/schema.ts) |
| **M4** | **Concurrencia última-escritura-gana** entre recepción/médico/paciente, sin chequeo de estado previo ni versión. | `appointments.functions.ts` |
| **M5** | **Slots recepción/médico no ocultan horas pasadas de hoy** (dashboard sí): recepción puede reservar 9:00 a las 10:00. Hardcodean 30 min ignorando `slotMinutes`. | [`staff.tsx:656-706`](../src/routes/staff.tsx), [`doctor.tsx:1506-1557`](../src/routes/doctor.tsx) |
| **M6** | **Softlock inconsistente**: `throwIfSoftlocked()` solo cubre book + reschedule; confirmar/cancelar/completar y admin funcionan de noche. En cliente deshabilita botones sin explicar. (Intención confirmada: solo bloquear que **pacientes** reserven de madrugada.) | [`softlock.ts`](../src/lib/softlock.ts) |
| **M7** | **Sesión cargada una sola vez** al montar; si expira, la UI sigue "logueada" y —como el server no valida— todo sigue funcionando. | [`auth.tsx:46-48`](../src/lib/auth.tsx) |
| **M8** | **Botones de estado no se deshabilitan durante el request** → doble clic, doble llamado. | [`staff.tsx:125-133`](../src/routes/staff.tsx) |
| **M9** | **Fichas médicas e imágenes como base64 en Postgres 256 MB**, versionado sin poda → cuenta regresiva al disco lleno. | [`medical-records.functions.ts`](../src/lib/api/medical-records.functions.ts) |
| **M10** | **WhatsApp comparte proceso con el web server**: un OOM de Chromium (512 MB) tira el sitio. El envío depende de que el proceso viva a las 21:00; Render puede reciclar la instancia y se pierde sin registro ni reintento. | [`scheduler.ts`](../src/lib/scheduler.ts) |

### COSMÉTICOS / CALIDAD

| ID | Hallazgo | Ubicación |
|----|----------|-----------|
| **Q1** | **Lógica de slots triplicada y divergente** (3 copias). `ApptCard`, `RescheduleDialog`, `DayView`, `WeekView`, `statusBg` copiados enteros entre staff y doctor. Rutas de ~1.100-1.760 líneas. | staff.tsx, doctor.tsx, dashboard.tsx |
| **Q2** | **Tipos `any`** en auth, casts `as StaffAppt[]`, tipos manuales que Drizzle podría inferir. | varios |
| **Q3** | **Errores tragados**: `catch {}` → toast genérico "Error al actualizar". El motivo real (softlock, FK, red, sesión) nunca llega al usuario. | rutas |
| **Q4** | **`getTomorrowAppointments` (variante global): columna "Médico" muestra el nombre del paciente** (`doctorName: user.name` sale del join con el paciente). | [`pdf-turnero.ts:53`](../src/lib/pdf-turnero.ts) |
| **Q5** | **Modal casero** del dashboard (`div fixed inset-0`) sin focus-trap/ESC/aria, mientras el resto usa Radix Dialog. | [`dashboard.tsx:397`](../src/routes/dashboard.tsx) |
| **Q6** | **`html lang="en"`** en app 100% castellano; 404 y error boundary en inglés. | [`__root.tsx:124`](../src/routes/__root.tsx) |
| **Q7** | **CI con `continue-on-error: true` en todos los pasos y cero tests.** `bun test` pasa en vacío. | `.github/workflows/ci.yml` |
| **Q8** | **`ausente` nunca se setea** por ningún botón hoy (estado muerto). | rutas |
| **Q9** | **`.env` commiteado** (secret dummy) y `.wwebjs_cache/` trackeado en git. | repo |

---

## 3. Frontend / UX (resumen)

- Hay tokens decentes (teal/verde, DM Serif Display + Fira Sans en [`styles.css`](../src/styles.css)), pero **todo se renderiza con la misma receta** (`rounded-2xl border bg-background p-5`): sin jerarquía funcional. La agenda de recepción (uso intensivo) tiene el mismo layout aireado que el panel del paciente (uso ocasional).
- **La agenda no es una agenda**: lista vertical de cards sin eje temporal, sin huecos visibles, sin "ahora".
- **Feedback pobre**: clic → silencio → toast. Sin optimistic, sin skeletons, sin `aria-live`. Botones deshabilitados por softlock sin explicación.
- **Reactividad a la presencia: nula.** Tab abierta 4 h = datos de hace 4 h.
- **Bases de a11y buenas** (skip-link, focus-visible global, touch targets 44px). Faltan `aria-live`, labels en inputs inline, contraste de badges.

---

## 4. Decisiones de producto confirmadas (del cliente)

1. **No** habrá display/llamado de turnos en sala.
2. **Softlock 21:00–08:00**: su único fin es que **los pacientes no reserven de madrugada**. No debería bloquear operaciones del staff.
3. **Turnero WhatsApp**: debe listar `pendiente` **+** `confirmado`.
4. **`notifications`**: feature **planeada** (recordatorios) — ver `PLAN-whatsapp-reminders.md`.
5. **`ausente`**: lo marca **solo el médico**. No habrá marcado explícito de "asistió/completado": el médico marca únicamente los ausentes (minoría); **pasados N minutos del horario sin marca de ausente ⇒ se considera que el paciente asistió**. Recepción casi no toca turnos salvo sacar turnos nuevos.
6. **Autenticación de pacientes: NO se toca.** El email **no** se verifica a propósito; email + DNI funcionan como un "usuario glorificado". No se agrega verificación de email, confirmación, 2FA ni fricción de login/registro: el público incluye adultos mayores poco expertos y complicarlo los aleja. Las cuentas de **paciente son de bajo riesgo** (solo sacan turnos; no exponen datos peligrosos). ⇒ El Plan 01 es sobre **autorización server-side** (que la API no sea pública), **no** sobre endurecer el login del paciente. Ver Plan 01 §"Restricciones confirmadas".
7. **⚠️ Congelamiento de datos (fase de carga).** El sistema está a mitad de la **carga de datos de médicos** antes de pasar 100% a producción. **Nada debe modificar/borrar los datos existentes.** El `seed.ts` es idempotente (seguro). El vector de riesgo es el `bunx drizzle-kit push` que corre **en cada deploy** ([`Dockerfile:57`](../Dockerfile)): auto-aplica cualquier cambio de `schema.ts` contra la DB de producción, y puede ser destructivo ante cambios no aditivos. Regla mientras dure la carga: **solo cambios de schema aditivos**; las migraciones que tocan datos (Plan 03 constraint, Plan 04 FK, Plan 08) se **posponen** hasta terminar la carga o se ejecutan manualmente con dump previo, nunca vía el push automático del deploy.

## 5. Feature nueva solicitada

**Modo "WhatsApp directo" del médico.** Algunos médicos no quieren usar el sistema de turnos: prefieren coordinar por WhatsApp. Se pide un **toggle activable en el dashboard del médico**; cuando está activo, si un paciente intenta sacar turno con ese médico, **en vez del calendario/disponibilidad ve un link de WhatsApp + el número del médico** para coordinar directo. Ver plan `05`.

## 6. Preguntas abiertas restantes

- **N minutos** para el auto-asistido de `ausente` (§4.5): ¿valor fijo, configurable por médico, global? (Plan 03 lo deja parametrizable, default a definir.)
- ¿El link de WhatsApp directo (Plan 05) debe **además** cancelar/ocultar los turnos ya existentes de ese médico, o solo cambiar el flujo de reserva nuevo?
- ¿Migrar los archivos base64 ya existentes (Plan 08) o solo cambiar el almacenamiento de aquí en más?

---

## 7. Índice de planes

| Plan | Título | Severidad/tipo | Depende de |
|------|--------|----------------|------------|
| [01](01-autorizacion-server-side.md) | Autorización server-side + hardening de endpoints | CRÍTICO (seguridad) | — |
| [02](02-whatsapp-produccion-y-robustez.md) | WhatsApp: reparar producción + robustez | CRÍTICO (prod caído) | — |
| [03](03-integridad-ciclo-de-vida-turno.md) | Integridad y ciclo de vida del turno | CRÍTICO (datos) | — |
| [04](04-correcciones-puntuales.md) | Correcciones puntuales | Medio (varios) | — |
| [05](05-modo-whatsapp-directo-medico.md) | Feature: modo WhatsApp directo del médico | Feature | — |
| [06](06-modulo-slots-y-tests.md) | Módulo único de slots + tests + CI | Refactor base | — |
| [07](07-refactor-componentes-y-tipos.md) | Refactor de componentes, tipos y errores | Refactor | (idealmente 06) |
| [08](08-almacenamiento-archivos.md) | Archivos fuera de Postgres | Storage | — |
| [09](09-rediseno-frontend-ux.md) | Rediseño frontend / UX | Rediseño | (idealmente 03, 06) |

**Orden recomendado de ejecución**: 02 → 01 → 03 → 04 → 06 → 05 → 08 → 07 → 09.
(02 primero porque el producto principal está caído en prod; 01 en paralelo/inmediato por la exposición de datos médicos.)
