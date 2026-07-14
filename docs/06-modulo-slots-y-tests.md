# Plan 06 — Módulo único de slots + tests + CI real

> **Leé primero [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md).** Resuelve **Q1 (parte slots), M5** y monta la base de testing.
> Autocontenido. Es el cimiento de calidad para los planes de refactor.

## Objetivo

Eliminar la triplicación divergente de la lógica de generación de slots, moviéndola a un módulo puro y testeado que consuman las 3 pantallas **y** el servidor. Encender la CI para que los tests importen.

## Por qué

La generación de slots existe **3 veces** con comportamientos distintos (§2 Q1, M5):
- [`dashboard.tsx:234-312`](../src/routes/dashboard.tsx): usa `slotMinutes` del médico y **oculta horas pasadas de hoy**.
- [`staff.tsx:656-706`](../src/routes/staff.tsx) y [`doctor.tsx:1506-1557`](../src/routes/doctor.tsx): **hardcodean 30 min** y **no** filtran horas pasadas → recepción puede reservar en el pasado.

Además, el servidor valida solapamiento con **otra** copia de la lógica ([`appointments.functions.ts`](../src/lib/api/appointments.functions.ts)). Una sola fuente de verdad evita que vuelvan a divergir.

## Archivos afectados

- **Nuevo**: `src/lib/slots.ts` (puro, sin React ni DB).
- **Nuevo**: `src/test/slots.test.ts`.
- `dashboard.tsx`, `staff.tsx`, `doctor.tsx` — consumir el módulo.
- `appointments.functions.ts` — usar el módulo para validar (coordinar con Plan 03 si va después).
- `.github/workflows/ci.yml` — quitar `continue-on-error` de test/typecheck.

## Diseño de la solución

### API del módulo
```ts
// src/lib/slots.ts
export type ScheduleBlock = { weekday: number; startTime: string; endTime: string };
export type OccupiedRange = { start: Date; end: Date };
export type Slot = { value: string; label: string; available: boolean };

export function generateSlots(params: {
  date: Date;                 // día objetivo (local)
  schedule: ScheduleBlock[];  // bloques del médico
  occupied: OccupiedRange[];  // turnos no cancelados del día
  slotMinutes: number;        // del médico, no hardcode
  now?: Date;                 // para ocultar horas pasadas de hoy
}): Slot[];
```
Reglas unificadas (tomar el comportamiento correcto del dashboard):
- Respetar `slotMinutes` real del médico.
- Soportar múltiples bloques por día.
- Ocultar slots pasados **en todas** las pantallas (arregla M5).
- Marcar `available` según solapamiento con `occupied`.
- Manejo de TZ consistente y documentado (hoy se mezcla TZ del navegador con rangos del server — dejar explícito que todo se computa en hora local ARG mientras `TZ` esté fijo; anotar como deuda si algún día hay usuarios fuera de ARG).

### Consumo
- Las 3 pantallas reemplazan su bloque inline por `generateSlots(...)`.
- El servidor (validación de book/reschedule, Plan 03) usa la **misma** función para chequear que el slot pedido sea válido y esté libre — no confía en el cliente.

## Pasos de implementación

1. Escribir `src/lib/slots.ts` extrayendo la versión del dashboard (la más correcta) y parametrizando `slotMinutes`/`now`.
2. **TDD**: `src/test/slots.test.ts` cubriendo: múltiples bloques, slot ocupado (solapamiento parcial), horas pasadas de hoy, `slotMinutes` ≠ 30, día sin horario, borde de bloque (`m + dur <= blockEnd`).
3. Reemplazar el inline de `dashboard.tsx`, luego `staff.tsx`, luego `doctor.tsx`. Verificar cada pantalla.
4. (Si Plan 03 ya está) usar `generateSlots`/validación compartida en el servidor.
5. CI: quitar `continue-on-error: true` de los pasos de `tsc` y `test`; dejar `lint` como warning si hace falta por el ruido de prettier/CRLF (documentado en CLAUDE.md).

## Consideraciones de despliegue

- Sin migración. Riesgo bajo: es refactor con red de tests.
- El cambio en CI puede empezar a **fallar el pipeline** si hay errores de `tsc` preexistentes — revisar y arreglar o acotar el gate a los tests nuevos primero.

## Criterios de aceptación

- Una sola definición de generación de slots en el repo (grep no encuentra las copias).
- `bun test` corre `slots.test.ts` y pasa.
- Recepción y médico **ya no** ofrecen horarios pasados de hoy.
- Los slots respetan el `slotMinutes` del médico en las 3 pantallas.
- CI falla si un test falla.

## Riesgos y rollback

- **Riesgo**: sutilezas de TZ/borde al unificar. Mitigación: tests exhaustivos antes de reemplazar.
- **Rollback**: revertir; las pantallas vuelven a su inline.

## Qué NO tocar

- La transaccionalidad/constraint del Plan 03 (aunque ambos tocan `appointments.functions.ts`, este plan solo aporta la función pura; el Plan 03 la usa dentro de la transacción).
