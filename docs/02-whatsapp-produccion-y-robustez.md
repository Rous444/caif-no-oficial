# Plan 02 — WhatsApp: reparar producción + robustez

> **Leé primero [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md).** Resuelve **C7, C8, C5, Q4, M10** (el turnero nocturno está caído en prod).
> Autocontenido. Es el plan más urgente: el producto principal (aviso de turnos al médico) no funciona.

## Objetivo

Que el envío del turnero por WhatsApp a las 21:00 ARG vuelva a funcionar en Render, de forma confiable y observable.

## Diagnóstico (de los logs de Render)

### Bug A — `Cannot find package 'pdfkit'` (C7)
El runtime del Dockerfile hace `bun install --production` ([`Dockerfile:43`](../Dockerfile)), que **no instala devDependencies**. `pdfkit` y `qrcode` están en `devDependencies` ([`package.json:113-115`](../package.json)). El cron importa [`pdf-turnero.ts`](../src/lib/pdf-turnero.ts), cuyo `import PDFDocument from "pdfkit"` (línea 1) **falla al cargar el módulo** → se cae `getTomorrowAppointmentsByDoctor` y no se envía nada. El QR (`/api/whatsapp/qr-image`, usa `qrcode`) rompe por la misma razón.

### Bug B — Chromium `Code 21 / SingletonLock` (C8)
El perfil de Chromium (LocalAuth) vive en el disco persistente `/var/data` (`WHATSAPP_SESSION_PATH`, [`render.yaml:27`](../render.yaml)). Cuando un contenedor anterior murió sin cerrar Chromium, dejó `SingletonLock`/`SingletonSocket`/`SingletonCookie` apuntando al **hostname/PID viejo**. El contenedor nuevo (hostname distinto, mismo disco montado) ve el lock y **se niega a arrancar**. Clásico de Puppeteer sobre volúmenes persistentes.

### Bugs de contenido del turnero
- **C5**: el query filtra `status = 'pendiente'` ([`pdf-turnero.ts:110`](../src/lib/pdf-turnero.ts)) → los turnos **confirmados** por recepción no aparecen. Debe ser `pendiente` **+** `confirmado` (decisión confirmada).
- **Q4**: en `getTomorrowAppointments` (variante global), `doctorName: user.name` sale del join con el **paciente** ([`pdf-turnero.ts:53`](../src/lib/pdf-turnero.ts)) → columna "Médico" muestra el nombre del paciente. (Esta variante hoy no la usa el cron, pero corregir igual.)

## Archivos afectados

- [`package.json`](../package.json) — mover `pdfkit` y `qrcode` a `dependencies`.
- [`src/lib/whatsapp.ts`](../src/lib/whatsapp.ts) — limpiar locks antes de `initialize()`.
- [`src/lib/pdf-turnero.ts`](../src/lib/pdf-turnero.ts) — fix de filtro de estado + nombre de médico; separar la generación de PDF de las queries.
- [`src/lib/scheduler.ts`](../src/lib/scheduler.ts) — logging/reintento.
- **Nuevo (opcional, robustez)**: tabla `whatsapp_log` + reintento.

## Diseño de la solución

### Fase P0 — reparar producción (mínimo para que funcione)

1. **Mover a `dependencies`**: `pdfkit` y `qrcode`. Regenerar `bun.lock`. (Dejar `@types/*` en dev.)
   - *Verificación*: `bun install --production` en limpio y `node -e "import('pdfkit')"`.
2. **Limpiar locks de Chromium** en `startWhatsAppClient()` antes de `client.initialize()`:
   ```ts
   // borrar Singleton* del perfil si existen (perfil = SESSION_PATH/session o similar)
   for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
     await fs.rm(path.join(profileDir, f), { force: true }).catch(() => {});
   }
   ```
   Determinar `profileDir` real que crea LocalAuth bajo `dataPath` (`.wwebjs_auth/session-*` o el que aplique). Loguearlo una vez para confirmar la ruta en Render.
3. **Separar PDF de queries**: hoy `pdf-turnero.ts` mezcla `getTomorrowAppointmentsByDoctor` (solo datos) con `generateTurneroPDF` (usa pdfkit). El cron solo necesita datos. Mover `generateTurneroPDF` a `src/lib/pdf-generate.ts` para que el path del cron no arrastre `pdfkit`. (Defensa en profundidad: aun si pdfkit faltara, el aviso de texto seguiría saliendo.)
4. **Fix C5**: en `getTomorrowAppointmentsByDoctor`, filtro `inArray(status, ["pendiente", "confirmado"])` en vez de `eq(status, "pendiente")`.
5. **Fix Q4**: en `getTomorrowAppointments`, resolver el nombre del médico con un join/alias correcto sobre `doctors.userId → user`, no el `user` del paciente.

### Fase P1 — robustez (reduce el riesgo de M10)

6. **Log de envíos**: tabla `whatsapp_log (id, doctor_id, fecha, status, error, sent_at)`. Registrar cada intento en `sendAllDoctorTurneros`.
7. **Reintento**: cron adicional a las 21:15 que reintente los `failed`/faltantes del día. Si el cliente no conectó a las 21:00, reintentar.
8. **Guardas del ciclo init→send→destroy**: proteger contra solapamientos (si un `restart` manual coincide con el cron). El `isStarting`/`client` global ya ayuda; agregar log claro de estado.

### Fase P2 — aislamiento (opcional, mayor esfuerzo)

9. Evaluar mover WhatsApp/Chromium a un **worker/proceso aparte** (o Render background worker) para que un OOM de Chromium no tire el web server. Requiere IPC o que el worker lea la DB directamente. Documentar como follow-up; **no** bloquea P0/P1.

## Pasos de implementación

1. P0.1 (deps) + P0.2 (locks) + P0.4 (filtro C5) — es el mínimo para que el próximo 21:00 funcione.
2. Deploy en ventana nocturna y **observar los logs del 21:00 siguiente** (o forzar con `/api/whatsapp/init` + un envío de prueba, ya protegido por Plan 01 si está aplicado).
3. P0.3 (separar PDF) + P0.5 (Q4).
4. P1 (log + reintento) en un segundo deploy.

## Consideraciones de despliegue

- **Disco `/var/data`**: si el lock quedó pegado, un primer arranque puede necesitar limpieza manual (o simplemente el fix P0.2 lo resuelve solo en el próximo boot).
- Deploy solo 21:00–08:00 ARG. Idealmente probar el envío la misma noche.
- `.wwebjs_cache/` **no debería estar en git** (Q9): agregarlo a `.gitignore` y `.dockerignore` (coordinar con Plan 04 si se hace junto).

## Criterios de aceptación

- Build de runtime (`bun install --production`) resuelve `pdfkit` y `qrcode`.
- Reinicio del contenedor con lock preexistente en `/var/data` ⇒ Chromium arranca igual.
- El log del 21:00 muestra `X enviados, 0 fallidos` (o reintento exitoso 21:15).
- El mensaje al médico incluye turnos `confirmado`, no solo `pendiente`.

## Riesgos y rollback

- **Riesgo**: borrar un `Singleton*` en uso por un Chromium vivo. Mitigación: solo se limpia en `startWhatsAppClient` cuando `client == null` (no hay cliente activo).
- **Rollback**: revertir `package.json`/lock y el cambio de whatsapp.ts. El log/reintento son aditivos.

## Qué NO tocar

- La capa de auth de los endpoints (Plan 01) — se integra bien pero es otro plan.
- La feature de "WhatsApp directo del médico" (Plan 05) es independiente.
