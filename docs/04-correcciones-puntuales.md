# Plan 04 — Correcciones puntuales

> **Leé primero [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md).** Bugs medios/cosméticos independientes, de bajo riesgo y alto retorno.
> Autocontenido. Cada ítem es aislado; se pueden hacer en cualquier orden o por separado.

## Objetivo

Resolver un conjunto de bugs pequeños y sin dependencias entre sí, que degradan la operación o confunden al usuario.

## Ítems

### 1. Vista "Semana" de recepción solo muestra el lunes (M1)
- **Dónde**: [`staff.tsx:116-123`](../src/routes/staff.tsx) manda `date: range.from` (un día) también en modo semana; `getStaffAppointments` filtra ese día exacto.
- **Cómo**: extender `getStaffAppointments` para aceptar un **rango** (`from`/`to`) además del `date` puntual, y en `staff.tsx` pasar el rango de la semana cuando `view === "week"`. La grilla `WeekView` ya agrupa por día; solo le falta recibir los 7 días de datos.
- **Aceptación**: en vista semana, cada día con turnos los muestra.

### 2. Softlock solo para pacientes (M6)
- **Contexto**: intención confirmada — el softlock 21:00–08:00 existe **solo para que los pacientes no reserven de madrugada**. Hoy `throwIfSoftlocked()` bloquea `bookAppointment` y `rescheduleAppointment` para todos, y la UI deshabilita botones de staff sin explicar.
- **Cómo**:
  - Aplicar `throwIfSoftlocked()` **solo** cuando quien reserva es un paciente para sí mismo. Staff (recepción/médico) puede reservar/reprogramar de noche. (Se apoya en la identidad de sesión del Plan 01; si Plan 01 no está aún, usar el rol disponible en el input de forma temporal y dejar TODO.)
  - En el cliente: no deshabilitar el botón "Nuevo turno" para staff; para el paciente, mostrar el motivo ("El sistema abre a las 08:00") en vez de un botón gris mudo.
- **Aceptación**: recepción puede sacar un turno 22:00; un paciente no, y ve por qué.

### 3. FK `onDelete` en `appointments` (M3)
- **⚠️ Toca el schema — posponer durante la carga de datos (§4.7).** Cambiar FKs vía el `drizzle-kit push` del deploy es riesgoso; correr manualmente con dump previo o esperar a que termine la carga. La variante soft-delete (abajo) no requiere migración y es preferible mientras tanto.
- **Dónde**: [`schema.ts:137-142`](../src/db/schema.ts) — `patientId`/`doctorId` sin `onDelete`; `deleteUser` revienta con violación de FK.
- **Cómo**: decidir política y aplicarla vía migración:
  - Preferido: **soft-delete** de usuarios (ya existe `user.isActive`) — no borrar físicamente. Ajustar `deleteUser` para desactivar en vez de `DELETE`, o mantener `DELETE` solo si no tiene turnos.
  - Alternativa: `onDelete: "set null"`/`"restrict"` con mensaje claro.
- **Aceptación**: intentar borrar un usuario con turnos da un mensaje claro (o lo desactiva), sin error crudo.

### 4. Doble clic en botones de estado (M8 — parte cliente)
- **Dónde**: `updateStatus` en [`staff.tsx:125-133`](../src/routes/staff.tsx) y equivalente en doctor.tsx no deshabilitan durante el request.
- **Cómo**: estado `pending` por botón/fila (o usar `useMutation` de React Query con `isPending`) y `disabled` mientras corre.
- **Nota**: la guardia server-side contra doble transición vive en el Plan 03 (`STALE_STATE`); esto es solo la mejora de UX inmediata.
- **Aceptación**: doble clic rápido no dispara dos requests.

### 5. i18n mínimo (Q6)
- **Dónde**: `html lang="en"` ([`__root.tsx:124`](../src/routes/__root.tsx)); `NotFoundComponent` y `ErrorComponent` en inglés.
- **Cómo**: `lang="es"`; traducir los textos de 404 y error boundary al castellano.
- **Aceptación**: `lang="es"` y páginas de error en español.

### 6. Higiene de repo (Q9)
- **Cómo**: sacar `.wwebjs_cache/` del tracking de git; agregarlo a `.gitignore` y `.dockerignore`. Confirmar que `.env` no lleva secretos reales (el actual es dummy; documentar que los reales van por env de Render).
- **Nota**: si se hace junto con el Plan 02, coordinar para no duplicar.
- **Aceptación**: `git status` limpio de `.wwebjs_cache`.

## Consideraciones de despliegue

- Ítems 1, 4, 5, 6: sin migración, riesgo mínimo.
- Ítem 3: **migración** (FK / política de borrado) → ventana nocturna, dump previo.
- Ítem 2: se integra mejor sobre el Plan 01 (identidad de sesión); si se hace antes, dejar el chequeo de rol marcado como provisorio.

## Riesgos y rollback

- Bajo en todos. Rollback = revertir commit; el único con estado es el ítem 3 (migración FK).

## Qué NO tocar

- Máquina de estados y concurrencia (Plan 03). Este plan no cambia la semántica de estados, solo corrige bugs puntuales.
