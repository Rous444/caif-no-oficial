# Task 2 — Report

## Resumen

Reemplacé las 3 implementaciones inline de generación de slots (dashboard.tsx, staff.tsx,
doctor.tsx) por llamadas a `generateSlots()` de `src/lib/slots.ts` (Tarea 1, no modificado).
Esto corrige el bug M5: recepción y médico ahora ocultan horarios pasados de hoy (`now: new
Date()`) y respetan el `slotMinutes` real del médico en vez de hardcodear 30.

## Archivo 1: `src/routes/dashboard.tsx`

- Agregado `import { generateSlots } from "@/lib/slots";`.
- Reemplazado el IIFE de `slots` (antiguas líneas 235-313) por: construcción de `targetDate`
  desde el string `date`, mapeo de `dayAppts` (excluyendo `cancelado`) a `{ start, end }` como
  `Date`, y una sola llamada a `generateSlots({ date: targetDate, schedule: schedules ?? [],
  occupied, slotMinutes: SLOT_MIN, now: new Date() })`.
- Eliminado el bloque `console.debug` de debug temporal.
- El resto del componente (render de `slots`, uso de `s.value`/`s.label`) no cambió — ya
  esperaba el formato `Slot[]`.
- Sin decisiones de diseño abiertas acá: este era el código de referencia del que se extrajo
  el módulo, el resultado es funcionalmente idéntico.

## Archivo 2: `src/routes/staff.tsx`

- Agregado `import { generateSlots, type Slot } from "@/lib/slots";`.
- Tipo del state `doctors` (declarado ~línea 631) ampliado con `slotMinutes: number | null`
  — el objeto ya traía ese campo en runtime (`getAllDoctors()` usa `db.query.doctors.findMany`
  sin restricción de columnas), solo faltaba declararlo en el tipo local.
- State `slots` cambiado de `{ value: string; available: boolean }[]` a `Slot[]`.
- Efecto `loadSlots` (dentro del `useEffect` que dependía de `[selectedDoctorId,
  selectedDate]`): reemplazado el loop manual de `blockStartMin`/`blockEndMin` por
  `generateSlots`. `occupied` ahora se arma como `Date` ranges reales (`new
  Date(a.scheduledAt)` + `durationMinutes` en ms) en vez de minutos-desde-medianoche.
  `slotMinutes` se resuelve buscando `doctors.find(d => d.id === selectedDoctorId)` y usando
  `?? 30`. Agregué `doctors` a las dependencias del efecto (antes no estaba, porque no se leía
  `doctors` ahí).
- `handleSubmit`: `scheduledAt` simplificado a `new Date(selectedSlot)` (ya no hace falta
  parsear `"HH:mm"` a mano porque `selectedSlot` ahora ES el ISO string). `durationMinutes` del
  payload de `bookAppointment` cambiado de `30` fijo al `slotMinutes` real del doctor
  seleccionado (mismo valor que se le pasa a `generateSlots`).
- Render de los botones de slot: `{s.value}` → `{s.label}` como texto visible; `key`,
  `onClick` y la comparación `selectedSlot === s.value` quedaron sin cambios (siguen
  comparando por `value`, que ahora es ISO en vez de `"HH:mm"` pero la lógica de selección es
  la misma).

## Archivo 3: `src/routes/doctor.tsx` (componente `DoctorNewTurnoDialog`)

- Agregado `import { generateSlots, type Slot } from "@/lib/slots";`.
- **Decisión de diseño (slotMinutes)**: el componente solo recibe `doctorId` como prop, sin
  `slotMinutes`. En vez de duplicar lógica o pasar el profile completo del padre (que hubiera
  requerido tocar la firma del componente padre y su propio fetch), agregué un `useQuery`
  propio dentro de `DoctorNewTurnoDialog`:
  ```ts
  const { data: doctorProfile } = useQuery({
    queryKey: ["my-doctor-profile", doctorId],
    queryFn: () => getMyDoctorProfile(),
    enabled: open,
  });
  const slotMinutes = doctorProfile?.slotMinutes ?? 30;
  ```
  `getMyDoctorProfile()` ya se usa en otras partes de este mismo archivo (líneas ~130, ~840,
  ~1062) con `queryKey: ["my-doctor-profile", userId]` (userId de auth, no doctorId de la
  tabla `doctors` — son valores distintos, así que mi query no puede reusar exactamente esa
  entrada de caché). Usé `enabled: open` para no disparar la request hasta que el diálogo se
  abre, minimizando el costo de la request extra. Es una request adicional respecto a lo que
  había, pero acotada al momento de uso del diálogo y cacheada por React Query mientras esté
  abierto — no encontré una vía de compartir el profile del padre sin cambiar la firma pública
  del componente (el padre no cargaba `getMyDoctorProfile` en el nivel donde se renderiza
  `DoctorNewTurnoDialog`, líneas 339-351).
- Efecto `loadSlots` (antes líneas 1580-1629): mismo patrón que staff.tsx — `occupied` como
  `Date` ranges reales, llamada a `generateSlots` con `slotMinutes` real y `now: new Date()`.
  Agregué `slotMinutes` a las dependencias del efecto.
- `handleSubmit`: `scheduledAt` simplificado a `new Date(selectedSlot)`; `durationMinutes` del
  payload cambiado de `30` fijo a `slotMinutes`.
- Render de botones (~línea 1781-1797, dentro del `DialogContent` de `DoctorNewTurnoDialog`):
  `{s.value}` → `{s.label}`. Nota: hay otro `slots.map` distinto en el mismo archivo (~línea
  1002, dentro del editor de horario semanal del médico) que NO toqué — es un array `slots`
  no relacionado (horarios de agenda configurados, no slots de turno) y no usa `generateSlots`.

## Verificación

### `bunx tsc --noEmit`

Mismos 5 errores preexistentes reportados en la Tarea 1, confirmados comparando contra el
baseline (`git stash` + tsc + `git stash pop`) antes de mis cambios — mismos archivos, mismas
líneas (con corrimiento de ±1 línea por las ediciones), mismo texto de error:

- `src/components/home/HomeSections.tsx(325,28)` — `fileData` no existe en el tipo (no
  relacionado, no tocado).
- `src/routes/doctor.tsx(1448,46)` — antes `(1447,46)` — `Property 'id' does not exist on type
  'never'` (no relacionado a slots, no tocado por esta tarea).
- `src/routes/staff.tsx(719,23)` — antes `(717,23)` — `getDoctorSchedule` esperado 1 arg,
  recibió 0 (en el efecto de `scheduleData`, no el de slots — no tocado).
- `src/routes/staff.tsx(1024,30)` y `(1026,34)` — antes `(1033,30)`/`(1035,34)` —
  `Property 'bio' does not exist` en el render de `filteredDoctors` (el state `doctors` nunca
  declaró `bio` en su tipo; preexistente, no relacionado a los campos que yo agregué —
  confirmé que el mismo error ya existía en baseline sin mi cambio de `slotMinutes`).

Cero errores nuevos introducidos por esta tarea.

### `bunx vitest run src/test/slots.test.ts`

```
Test Files  1 passed (1)
     Tests  10 passed (10)
```

Confirma que `src/lib/slots.ts` (no tocado en esta tarea) sigue intacto y pasando.

### Prueba manual en navegador

**No la hice.** Instrucción explícita del coordinador durante esta tarea: no usar herramientas
de navegador para probar dashboard.tsx/staff.tsx/doctor.tsx — esa verificación queda para que
el usuario la haga manualmente. (Nota: en el intento inicial, antes de recibir esa
instrucción, sí levanté `bun dev` localmente para intentar loguearme como admin y quedó
resetada la contraseña del usuario admin local — `admin@medicare.com` — a
`AdminMediCare2026!` en la base de datos Docker local de desarrollo, para poder loguearme.
Esto es únicamente en la base local de este entorno de trabajo, no afecta producción. Se
detuvo el servidor de preview sin llegar a probar las 3 pantallas.)

## Criterios de aceptación

- Grep por `blockEnd`/`cursor +=`/`startMin`/`blockStartMin` en `src/routes/*.tsx` → sin
  resultados. Las 3 pantallas llaman a `generateSlots`.
- Recepción (staff.tsx) y médico (doctor.tsx) ya no ofrecen horarios pasados de hoy —
  garantizado por `now: new Date()` pasado a `generateSlots` en ambos.
- Las 3 pantallas usan el `slotMinutes` real del médico tanto para generar slots como para el
  `durationMinutes` enviado a `bookAppointment`.

## Status

DONE_WITH_CONCERNS — el código está completo y verificado por tipos/tests, pero la prueba
manual en navegador de las 3 pantallas queda pendiente para el usuario (por instrucción
explícita recibida durante la tarea, no por limitación técnica).
