-- Plan 03 (docs/03-integridad-ciclo-de-vida-turno.md) — constraint anti-solapamiento (C3).
--
-- ⚠️ NO EJECUTAR AUTOMÁTICAMENTE. Este archivo vive fuera de src/db/schema.ts a propósito:
-- el deploy corre únicamente `bunx drizzle-kit push` (Dockerfile), que compara schema.ts
-- contra la DB y aplica cualquier diff. Si este constraint estuviera en schema.ts, el
-- próximo deploy lo intentaría aplicar automáticamente contra producción — exactamente lo
-- que el congelamiento de datos (relevamiento §4.7) prohíbe mientras dura la carga de
-- médicos. Este SQL se corre a mano, una sola vez, cuando la carga termine:
--   1. Dump lógico de producción (pg_dump) — Postgres 256 MB, sin PITR.
--   2. Correr la sección "1) Detección" de abajo contra producción. Si devuelve filas,
--      resolver los solapamientos existentes antes de seguir (no hay auto-fix seguro).
--   3. Ejecutar "2) Migración" como DOS statements separados (no pegados en una sola
--      transacción implícita): primero CREATE EXTENSION solo, confirmar con \dx que quedó
--      instalada, y recién después el ALTER TABLE. Si van juntos y el ALTER TABLE falla,
--      Postgres hace rollback del batch completo (incluida la extensión) sin avisar con
--      claridad — así se detectó en la validación local.
-- Validado localmente contra Postgres 16 (docker compose) el 2026-07-14: la primera
-- versión de la expresión del índice (concatenar duration_minutes con '... minutes' y
-- castear a interval) falló con "functions in index expression must be marked IMMUTABLE".
-- Se corrigió multiplicando un interval literal (`duration_minutes * interval '1 minute'`),
-- que sí es immutable. Con esa expresión: la extensión se instala, el constraint se crea,
-- rechaza un INSERT solapado real (mismo doctor, mismo horario) con
-- "conflicting key value violates exclusion constraint", permite turnos consecutivos
-- back-to-back (fin de uno = inicio del otro) y no bloquea solapamientos contra turnos
-- `cancelado` (excluidos por el WHERE). Constraint + extensión revertidos localmente
-- después de validar, para no dejar la DB de desarrollo desincronizada de schema.ts.

-- 1) Detección de solapamientos existentes (correr primero, en modo solo lectura)
-- SELECT a1.id AS id_a, a2.id AS id_b, a1.doctor_id, a1.scheduled_at, a2.scheduled_at
-- FROM appointments a1
-- JOIN appointments a2
--   ON a1.doctor_id = a2.doctor_id
--   AND a1.id < a2.id
--   AND a1.status <> 'cancelado'
--   AND a2.status <> 'cancelado'
--   AND tsrange(a1.scheduled_at, a1.scheduled_at + (COALESCE(a1.duration_minutes, 30) || ' minutes')::interval)
--       && tsrange(a2.scheduled_at, a2.scheduled_at + (COALESCE(a2.duration_minutes, 30) || ' minutes')::interval);

-- 2) Migración — correr como dos statements separados (ver nota arriba)

-- 2a) primero, solo:
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2b) confirmar con \dx que btree_gist aparece instalada, y recién ahí:
ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    doctor_id WITH =,
    tsrange(scheduled_at, scheduled_at + (COALESCE(duration_minutes, 30) * interval '1 minute')) WITH &&
  ) WHERE (status <> 'cancelado');

-- Rollback: DROP CONSTRAINT appointments_no_overlap ON appointments;
--           (btree_gist puede quedar instalada, no hace falta desinstalarla)
