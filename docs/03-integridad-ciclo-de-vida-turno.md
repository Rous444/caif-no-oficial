# Plan 03 — Integridad y ciclo de vida del turno

> **Leé primero [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md).** Resuelve **C3, C4, C6, M2, M4** y define el modelo de estados (§4.5).
> Autocontenido a nivel DB/servidor. Comparte archivos con Plan 06 (slots) pero no lo requiere.
>
> **⚠️ Este plan agrega un constraint a `appointments` (toca la DB).** Durante la fase de carga de datos (§4.7 del relevamiento) **no** aplicar la migración vía el `drizzle-kit push` automático del deploy. Recomendación: implementar la lógica de servidor/estados ahora (no toca datos), y **posponer la migración del constraint** hasta terminar la carga, o correrla **manualmente con dump previo** y detección de solapamientos existentes. Confirmar con el cliente antes de tocar el schema.

## Objetivo

Que el estado de un turno tenga invariantes garantizadas por la base de datos y el servidor: no puede haber dos turnos en el mismo slot, las transiciones de estado son válidas, y dos pantallas concurrentes no se corrompen entre sí.

## Por qué

Ver §2 C3/C4/C6/M2/M4. Hoy la unicidad de un slot depende de un `for` en JS sin transacción (doble turno posible), `updateAppointmentStatus` acepta cualquier transición, y `updateMySchedule` puede dejar a un médico sin horarios.

## Modelo de estados confirmado (§4.5 del relevamiento)

- Estados: `pendiente → confirmado → {completado | ausente | cancelado}`, `pendiente → cancelado`.
- **El médico marca solo `ausente`.** No hay marcado manual masivo de "asistió".
- **Regla de auto-asistido**: pasados **N minutos** del horario del turno sin marca de `ausente`, se considera **asistido/completado**. (N: pregunta abierta — dejar parametrizable, default sugerido 15–20 min; decidir si N es global o por médico.)
- Recepción: crea turnos y puede cancelar; casi no cambia estados.

### Transiciones permitidas (servidor)
```
pendiente   → confirmado, cancelado
confirmado  → ausente, cancelado, (completado por auto-regla)
cancelado   → (final)
completado  → (final)
ausente     → (final)
```
`completado` puede llegar por la regla de auto-asistido (lazy, ver abajo) más que por click.

## Archivos afectados

- [`src/db/schema.ts`](../src/db/schema.ts) — constraint de exclusión / índice.
- Migración Drizzle nueva en `src/db/migrations/`.
- [`src/lib/api/appointments.functions.ts`](../src/lib/api/appointments.functions.ts) — transacciones + máquina de estados.
- [`src/lib/api/doctor-schedule.functions.ts`](../src/lib/api/doctor-schedule.functions.ts) — `updateMySchedule` en transacción (M2).
- Cliente: deshabilitar botones durante mutación (M8, ver también Plan 04) y mostrar conflicto.

## Diseño de la solución

### 1. Constraint de no-solapamiento (C3)

Opción robusta (Postgres, requiere `btree_gist`):
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    doctor_id WITH =,
    tsrange(scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval) WITH &&
  ) WHERE (status <> 'cancelado');
```
Opción mínima si `btree_gist`/exclusion diera problemas en el plan de Render: índice único parcial sobre `(doctor_id, scheduled_at) WHERE status <> 'cancelado'` (no cubre solapamientos de distinta duración, pero cubre el caso común de slots de igual grilla). **Decidir según lo que soporte la instancia.**

### 2. `bookAppointment` transaccional (C3)

- Envolver en `db.transaction`.
- Validar dentro de la tx: solapamiento (acotado al **día**, no histórico completo), contra `doctorSchedules`, y contra el pasado.
- Dejar que el constraint sea la red de seguridad: capturar la violación y devolver error tipado `SLOT_TAKEN`.

### 3. `rescheduleAppointment` (C4)

- Misma validación que book (solapamiento + horario + pasado), en transacción.
- **Decidir el estado resultante**: hoy fuerza `pendiente`. Definir con el cliente si reprogramar mantiene `confirmado` o vuelve a `pendiente`. Documentar la elección.
- Excluir el propio turno del chequeo de solapamiento (`ne(id, appointmentId)`).

### 4. Máquina de estados en `updateAppointmentStatus` (C6)

- Cargar el turno, validar que la transición `estadoActual → nuevo` esté permitida; si no, error `INVALID_TRANSITION`.
- **Concurrencia optimista (M4)**: `UPDATE ... WHERE id = ? AND status = ?` (estado esperado). Si `rowCount == 0`, alguien cambió el estado ⇒ error `STALE_STATE` que la UI muestre ("Este turno cambió de estado; recargá").

### 5. Auto-asistido (`ausente`/§4.5)

Dos implementaciones posibles — recomiendo **lazy computation** para no depender de otro cron:
- **Lazy (recomendado)**: no se persiste `completado` automáticamente. En las lecturas (agenda del médico, historial), un turno `confirmado`/`pendiente` cuyo horario + N minutos ya pasó y no fue marcado `ausente` se **muestra como "asistido"** (derivado). Ventaja: sin cron, sin escrituras masivas, reversible.
- **Cron (alternativa)**: job diario que setea `completado` a los que corresponda. Más simple de reportar pero agrega otra pieza que puede fallar (ver M10).
- Exponer el botón **"Marcar ausente"** en el `ApptCard` del médico (hoy `ausente` es estado muerto — Q8).

### 6. `updateMySchedule` transaccional (M2)

- DELETE + INSERT dentro de `db.transaction`.
- Validar solapamiento entre bloques del mismo `weekday` antes de escribir.

## Pasos de implementación

1. Migración: `btree_gist` + constraint (probar en copia local con `bun db:push`/SQL manual). Confirmar que la data actual no viola el constraint (limpiar solapamientos preexistentes si los hubiera).
2. `bookAppointment` transaccional + captura de `SLOT_TAKEN`.
3. `rescheduleAppointment` con validación completa (decidir estado resultante con el cliente).
4. Máquina de estados + `WHERE status = ?` optimista en `updateAppointmentStatus`.
5. Regla de auto-asistido (lazy) en las lecturas + botón "ausente" en la UI del médico.
6. `updateMySchedule` transaccional.
7. Cliente: mostrar `SLOT_TAKEN`/`STALE_STATE`/`INVALID_TRANSITION` como mensajes claros (coordinar con Plan 07 si ya existe el helper de errores; si no, mensajes inline).

## Consideraciones de despliegue

- **Migración con constraint sobre tabla en producción**: revisar primero que no haya solapamientos existentes (`SELECT` de detección). Aplicar en ventana nocturna. Aditiva pero puede fallar si hay data sucia.
- Postgres 256 MB / sin PITR: hacer dump lógico antes de la migración.

## Criterios de aceptación

- Dos `bookAppointment` concurrentes al mismo slot ⇒ uno falla con `SLOT_TAKEN`.
- Reprogramar sobre un slot ocupado ⇒ rechazado.
- `updateAppointmentStatus` de `completado → pendiente` ⇒ `INVALID_TRANSITION`.
- Confirmar un turno que otra pantalla acaba de cancelar ⇒ `STALE_STATE`.
- El médico puede marcar `ausente`; un turno viejo sin marca aparece como asistido.
- Un fallo simulado en `updateMySchedule` no deja al médico sin horarios.

## Riesgos y rollback

- **Riesgo alto**: la migración del constraint contra data sucia. Mitigación: detección + limpieza previa + dump.
- **Rollback**: `DROP CONSTRAINT` + revertir server functions.

## Preguntas abiertas (bloqueantes de detalle, no de arranque)

- Valor de **N** (auto-asistido) y si es global o por médico.
- Estado resultante de una reprogramación (`pendiente` vs mantener).
- Exclusion constraint vs índice único parcial según soporte de la instancia Render.
