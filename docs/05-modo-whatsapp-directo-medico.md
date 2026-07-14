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

## Pasos de implementación

1. Migración: agregar `direct_booking` a `doctors` (aditiva, default false → segura).
2. Server fn `updateMyDirectBooking` + incluir el flag en las lecturas de perfil y en `getDoctorsBySpecialty`.
3. Toggle en el dashboard del médico.
4. Helper `toWaLink(phone, text)` + panel de WhatsApp en el diálogo de reserva del paciente.
5. Aplicar el mismo aviso en el flujo de recepción (`staff.tsx` `NewAppointmentDialog`).
6. (Decisión) qué pasa con los turnos ya existentes de un médico que activa el modo — ver pregunta abierta.

## Consideraciones de despliegue

- Migración **aditiva** (columna con default) → segura. Igual, ventana nocturna por convención.
- Sin impacto en el resto del sistema si el flag queda en `false`.

## Criterios de aceptación

- Un médico activa el toggle; un paciente que lo elige ve el link de WhatsApp, no el calendario.
- El link abre WhatsApp al número correcto con mensaje prellenado.
- Un médico con el toggle en `false` funciona igual que hoy.
- Recepción ve el aviso al intentar agendarle un turno a ese médico.

## Preguntas abiertas

- ¿El número de WhatsApp es siempre `user.phone` o puede ser uno distinto? (Define si se agrega `whatsappNumber`.)
- ¿Prefijo de país por defecto para normalizar? (AR `54` asumido.)
- Al **activar** el modo, ¿qué pasa con los turnos ya agendados en el sistema para ese médico? ¿Se mantienen y se siguen avisando, o se ocultan/cancelan? (Recomendado: mantenerlos hasta que se completen; solo cambia el flujo de reserva nueva.)

## Qué NO tocar

- La máquina de estados (Plan 03) ni el envío de turnero (Plan 02): un médico en modo directo simplemente no genera turnos nuevos por el sistema.
