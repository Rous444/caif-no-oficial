# Plan 05 — Feature: modo "WhatsApp directo" del médico

> **Leé primero [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md) (§5).** Feature nueva solicitada por el cliente.
> Autocontenido. Se apoya idealmente en la identidad de sesión del Plan 01, pero no lo bloquea.
>
> **Nota de datos (§4.7):** este plan agrega una columna con default (`direct_booking`), que es un cambio **aditivo y seguro** — no borra ni modifica datos existentes, apto para el `drizzle-kit push` del deploy incluso durante la carga. Si además se agrega `whatsappNumber` (ver preguntas abiertas), mantenerlo también aditivo/nullable.

## Objetivo

Permitir que un médico **desactive el sistema de reserva por calendario** para sí mismo. Cuando está activo el "modo WhatsApp directo", el paciente que intente sacar turno con ese médico **no ve el calendario/disponibilidad**, sino un **link de WhatsApp + el número del médico** para coordinar directamente.

## Contexto

Algunos médicos prefieren manejar sus turnos hablando por WhatsApp con los pacientes en vez de usar el sistema. Hoy no hay forma de expresar eso: todos los médicos aparecen con calendario.

## Archivos afectados

- [`src/db/schema.ts`](../src/db/schema.ts) — nuevo campo en `doctors` (ej. `directBooking boolean default false`) + migración.
- [`src/lib/api/doctor-schedule.functions.ts`](../src/lib/api/doctor-schedule.functions.ts) — server fn para leer/actualizar el flag (patrón igual a `updateMyWhatsappPreference`).
- [`src/routes/doctor.tsx`](../src/routes/doctor.tsx) — toggle en el dashboard del médico (patrón `DoctorWhatsAppToggle`).
- [`src/routes/dashboard.tsx`](../src/routes/dashboard.tsx) — el flujo de reserva del paciente bifurca según el flag.
- [`src/lib/api/admin-doctors.functions.ts`](../src/lib/api/admin-doctors.functions.ts) — `getDoctorsBySpecialty` debe devolver el flag y el teléfono del médico.

## Diseño de la solución

### 1. Modelo
Agregar a `doctors`:
```ts
directBooking: boolean("direct_booking").default(false),
```
El número de WhatsApp del médico ya existe en `user.phone` (del usuario asociado al doctor). Reutilizarlo; no duplicar. (Si se quiere un número distinto al de contacto, agregar `whatsappNumber text` — **pregunta abierta**, ver abajo.)

### 2. Toggle en el dashboard del médico
Componente análogo a `DoctorWhatsAppToggle` ([`doctor.tsx:116`](../src/routes/doctor.tsx)): switch "Coordinar turnos por WhatsApp directo". Copy claro de qué implica ("Los pacientes verán tu WhatsApp en lugar del calendario").

### 3. Bifurcación en la reserva del paciente
En `BookAppointmentDialog` ([`dashboard.tsx:196`](../src/routes/dashboard.tsx)):
- Al elegir médico, si `doctor.directBooking === true`: **no** cargar schedules/slots; renderizar un panel con:
  - Texto: "Este profesional coordina los turnos por WhatsApp."
  - Botón/enlace `https://wa.me/<numero_normalizado>?text=<mensaje_prellenado>` (ej. "Hola, quisiera coordinar un turno de <especialidad>").
  - El número visible como fallback.
- **Normalización del número**: `wa.me` requiere formato internacional sin `+`/espacios/guiones (ej. `54911...`). Escribir un helper `toWaLink(phone)` y decidir el prefijo de país por defecto (AR `54`) — **pregunta abierta** si hay médicos con otros formatos.

### 4. Exponer el flag donde se listan médicos
`getDoctorsBySpecialty` (y cualquier selector de médico en staff/doctor) debe incluir `directBooking` y `phone`. Considerar si recepción, al sacar un turno para un paciente, también debe ver el aviso (probablemente sí: no tiene sentido agendar en el sistema a un médico que lo maneja por fuera).

### 5. Formato y validación de teléfono (agregado tras revisión con cliente)

Hoy `user.phone` se guarda como el admin lo tipee, sin normalizar (`z.string().min(1)` en [`admin-users.functions.ts`](../src/lib/api/admin-users.functions.ts)), y `sendTextMessage`/`sendTurneroPDF` ([`whatsapp.ts:144,162`](../src/lib/whatsapp.ts)) lo usan **tal cual** concatenado con `@c.us` — esperan dígitos puros en formato `549` + 10 dígitos locales (ej. `5491122334455`), sin `+` ni separadores. Cualquier normalización debe preservar exactamente ese formato de guardado para no romper el turnero (Plan 02, "qué NO tocar").

Se agrega `src/lib/phone.ts`:
- `normalizeArPhoneDigits(raw)`: extrae dígitos, quita prefijo `54` y `9` si están, devuelve los 10 dígitos locales.
- `isValidArPhone(raw)`: `true` si normaliza a exactamente 10 dígitos.
- `formatArPhone(raw)`: máscara de visualización con separador de código de área **variable** (2, 3 o 4 dígitos), no fijo — el resto del número siempre se agrupa dejando los últimos 4 dígitos como grupo final (ej. `+54 9 11 2345-6789` para CABA/GBA de 2 dígitos, `+54 9 351 234-5678` para Córdoba de 3, `+54 9 3440 11-2233` para un código de 4). El código de área se detecta contra una lista de códigos de 2 y 3 dígitos conocidos (`TWO_DIGIT_AREA_CODES`/`THREE_DIGIT_AREA_CODES` en `phone.ts`); lo que no matchea esa lista se asume de 4 dígitos por defecto. Esta lista es de memoria/pública, no está validada contra el nomenclador oficial de ENACOM — si aparece un código de área real que se agrupe mal, se agrega a la lista.
- `toWaPhone(raw)` / `toWaLink(raw, text)`: arman `549` + 10 dígitos y el link `wa.me`.

Aplicación (sin tocar registro/login de pacientes, §4.6):
- **`ProfileEditor.tsx`** (todos los roles, incluye pacientes): el input de teléfono muestra `formatArPhone` en vivo mientras se escribe; el valor guardado sigue siendo el dígito-puro normalizado (`549` + local). **No bloqueante** — no impide guardar si el formato no cierra, para no agregar fricción a pacientes.
- **`admin.tsx`** (alta de médico/recepcionista): mismo input con máscara en vivo. Para el alta de **médico** específicamente, el submit se bloquea si `!isValidArPhone(phone)` (ese número es el que se va a usar para WhatsApp Directo; para recepcionista queda como hoy, no bloqueante).
- **`doctor.tsx`** (toggle "WhatsApp directo"): si el médico intenta activar el toggle y su `user.phone` no pasa `isValidArPhone`, se bloquea con mensaje pidiendo corregir el teléfono en su perfil primero.
- **`dashboard.tsx` / `staff.tsx`** (panel que ve el paciente/recepción): el número se muestra con `formatArPhone` para lectura humana; el link usa `toWaLink` con los dígitos puros.

No se migra ni reformatea el `phone` de usuarios ya existentes (freeze de datos, §4.7) — la máscara solo aplica a edición/alta nueva.

## Pasos de implementación

1. Migración: agregar `direct_booking` a `doctors` (aditiva, default false → segura).
2. `src/lib/phone.ts` (normalize/format/validate/link) con tests.
3. Server fn `updateMyDirectBooking` + incluir el flag en las lecturas de perfil y en `getDoctorsBySpecialty`.
4. Toggle en el dashboard del médico, con gate de teléfono válido.
5. Panel de WhatsApp en el diálogo de reserva del paciente (dashboard.tsx), usando `toWaLink`/`formatArPhone`.
6. Aplicar el mismo aviso en el flujo de recepción (`staff.tsx` `NewAppointmentDialog`).
7. Máscara de teléfono en `ProfileEditor.tsx` (no bloqueante) y en `admin.tsx` (bloqueante solo para alta de médico).
8. Turnos ya existentes al activar el modo: se mantienen tal cual; el médico puede cancelarlos manualmente si lo necesita (sin automatismo agregado).

## Consideraciones de despliegue

- Migración **aditiva** (columna con default) → segura. Igual, ventana nocturna por convención.
- Sin impacto en el resto del sistema si el flag queda en `false`.

## Criterios de aceptación

- Un médico activa el toggle; un paciente que lo elige ve el link de WhatsApp, no el calendario.
- El link abre WhatsApp al número correcto con mensaje prellenado.
- Un médico con el toggle en `false` funciona igual que hoy.
- Recepción ve el aviso al intentar agendarle un turno a ese médico.

## Preguntas abiertas — resueltas (confirmado con cliente)

- Número de WhatsApp: siempre `user.phone`. No se agrega `whatsappNumber`.
- Prefijo de país por defecto: `54` (AR).
- Turnos ya agendados al activar el modo: se **mantienen**; el médico los cancela manualmente si lo necesita.

## Qué NO tocar

- La máquina de estados (Plan 03) ni el envío de turnero (Plan 02): un médico en modo directo simplemente no genera turnos nuevos por el sistema.
