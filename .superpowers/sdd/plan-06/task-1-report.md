# Task 1 — Reporte

## Qué se implementó

- `src/lib/slots.ts`: módulo puro `generateSlots()` que unifica la generación de slots
  disponibles para un día, tomando como base el comportamiento correcto de
  `dashboard.tsx` (líneas 235-313):
  - Usa `slotMinutes` real (parámetro, sin hardcode de 30).
  - Soporta múltiples bloques de horario para el mismo weekday.
  - Filtra internamente `schedule` por `weekday = (date.getDay() + 6) % 7`.
  - Oculta slots pasados solo si `now` es provisto y `date` es el mismo día
    calendario que `now` (comparación de minutos desde medianoche).
  - Marca `available` chequeando solapamiento (`start < r.end && end > r.start`)
    contra `occupied` (rangos `Date` ya filtrados por el caller — la función no
    conoce ni filtra por `status`).
  - Loop `while (cursor + slotMs <= blockEnd)`: incluye un slot que termina
    exactamente en `blockEnd`, excluye uno que se pasaría.
  - Devuelve `{ value: slotStart.toISOString(), label: <es-AR HH:mm local>, available }`.
  - Comentario corto en la cabecera del archivo documentando el supuesto de TZ
    ARG fija (sin soporte multi-huso), según lo pedido en el brief.

- `src/test/slots.test.ts`: 10 tests con vitest cubriendo los 7 casos requeridos
  (algunos casos se dividieron en más de un `it` para mayor claridad):
  1. Múltiples bloques de horario el mismo día.
  2. Slot marcado no disponible por solapamiento parcial (no exacto).
  3. Horas pasadas de hoy ocultas cuando se pasa `now` y `date` es hoy.
  4. No se ocultan horas pasadas cuando `now` no se pasa (comportamiento
     explícito del brief, agregado como caso extra).
  5. `slotMinutes` distinto de 30 — casos con 15 y 45.
  6. Día sin ningún bloque de horario → `[]`.
  7. Borde de bloque: slot que terminaría después de `blockEnd` se excluye, y
     slot que termina exactamente en `blockEnd` se incluye (dos tests
     separados para dejar el borde bien explícito).
  8. Documentación explícita (vía comentario + test) de que `generateSlots` no
     filtra por `status === "cancelado"` — esa responsabilidad es del caller,
     que arma `occupied` ya filtrado.

TDD seguido: se escribieron los tests primero contra un `src/lib/slots.ts`
inexistente (falla de resolución de import confirmada), luego se implementó el
módulo y se iteró hasta verde.

## Decisión de diseño notable

Los labels (`toLocaleTimeString("es-AR", ...)`) dependen de los datos ICU
disponibles en el runtime (en este entorno Node devuelve `"08:00 a. m."` en vez
de `"08:00"` que se ve en navegadores reales). Para no acoplar los tests a esa
particularidad del entorno de CI/dev, se agregó un helper `label(hour, minute)`
en el test que llama exactamente al mismo método de formateo que usa la
implementación, y se comparan labels contra ese helper en lugar de strings
literales `"08:00"`. Esto mantiene los tests deterministas y correctos sin
importar el ICU data disponible, sin cambiar el comportamiento de producción.

## Comandos corridos y output

### `bunx vitest run src/test/slots.test.ts` (verificación inicial de falla, antes de crear slots.ts)

```
FAIL  src/test/slots.test.ts [ src/test/slots.test.ts ]
Error: Failed to resolve import "@/lib/slots" from "src/test/slots.test.ts". Does the file exist?
```

### `bunx vitest run src/test/slots.test.ts` (final, tras implementar)

```
 RUN  v4.1.9 C:/Users/kevin/OneDrive/Desktop/CAIF/caif-no-oficial


 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  11:37:11
   Duration  2.00s (transform 45ms, setup 198ms, import 30ms, tests 22ms, environment 1.55s)
```

### `bunx eslint src/lib/slots.ts src/test/slots.test.ts`

Sin errores tras `--fix` (1 error de `prettier/prettier` corregido automáticamente).

### `bunx tsc --noEmit`

Preexisten 5 errores de tipos en `HomeSections.tsx`, `doctor.tsx` (x1) y
`staff.tsx` (x2) — ninguno relacionado con `src/lib/slots.ts` ni con el test
nuevo. No se tocó ninguno de esos archivos en esta tarea.

## Status final

**DONE**

- Tests: 10/10 passing.
- No se tocaron `dashboard.tsx`, `staff.tsx` ni `doctor.tsx` (Task 2 se encarga
  de conectarlos al nuevo módulo).
- Sin dependencias nuevas.
- Commit directo sobre `main` (autorizado).

## Concerns

- Ninguno bloqueante. Nota para Task 2: el formateo de `label` con
  `toLocaleTimeString("es-AR", ...)` puede variar levemente según el ICU data
  del runtime (navegador vs Node/CI) — es el mismo comportamiento que ya tenía
  `dashboard.tsx`, no es una regresión introducida por este módulo.
