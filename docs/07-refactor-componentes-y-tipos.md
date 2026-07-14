# Plan 07 — Refactor de componentes, tipos y errores

> **Leé primero [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md).** Resuelve **Q1 (componentes), Q2, Q3, Q5**.
> Autocontenido, pero rinde más **después** del Plan 06 (slots ya extraídos) y del Plan 03 (errores tipados a mostrar).

## Objetivo

Reducir la deuda estructural: descomponer las rutas monolíticas, tipar desde Drizzle en vez de `any`, y traducir errores del servidor a mensajes útiles para el usuario.

## Por qué

- **Q1**: `ApptCard`, `RescheduleDialog`, `DayView`, `WeekView`, `statusBg` están **copiados enteros** entre [`staff.tsx`](../src/routes/staff.tsx) y [`doctor.tsx`](../src/routes/doctor.tsx). Las rutas van de 1.100 a 1.760 líneas.
- **Q2**: `user: any` en [`auth.tsx`](../src/lib/auth.tsx), casts `as StaffAppt[]`, tipos manuales que Drizzle infiere.
- **Q3**: `catch {}` → toast genérico "Error al actualizar"; el motivo real nunca llega.
- **Q5**: modal casero en [`dashboard.tsx:397`](../src/routes/dashboard.tsx) sin focus-trap/ESC/aria mientras el resto usa Radix.

## Archivos afectados

- **Nuevo**: `src/components/agenda/` (`ApptCard.tsx`, `RescheduleDialog.tsx`, `DayView.tsx`, `WeekView.tsx`, `status.ts`).
- **Nuevo**: `src/lib/errors.ts` (códigos + helper de toast).
- `staff.tsx`, `doctor.tsx`, `dashboard.tsx` — consumir los compartidos.
- `auth.tsx` — tipar `user`/`session`.

## Diseño de la solución

### 1. Componentes compartidos de agenda
Extraer a `src/components/agenda/` los componentes duplicados. Diferencias reales entre staff y doctor (ej. staff muestra médico + obra social; doctor muestra botón "Historial") se resuelven con **props** (`variant` o slots de acciones), no con dos copias. `statusBg`/colores de estado a un único `status.ts`.

### 2. Tipos desde Drizzle
- `type Appointment = InferSelectModel<typeof appointments>` y tipos derivados de los `with` de las queries, en lugar de `StaffAppt`/`DoctorAppt` manuales.
- Tipar el retorno de las server fns y dejar que el cliente lo infiera (evita `as ...`).
- En `auth.tsx`, tipar `user` con el modelo de better-auth + `role`.

### 3. Errores tipados (Q3)
```ts
// src/lib/errors.ts
export type DomainErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN"
  | "SLOT_TAKEN" | "STALE_STATE" | "INVALID_TRANSITION"
  | "SOFTLOCKED" | "NOT_FOUND" | "VALIDATION";
```
- El servidor lanza errores que incluyan el `code` (Plan 01 y 03 ya producen varios de estos).
- Un helper `toastError(err)` mapea cada código a un mensaje en castellano ("El horario ya fue reservado", "El sistema abre a las 08:00", etc.).
- Reemplazar los `catch {}` por `catch (e) { toastError(e) }`.

### 4. Reemplazar el modal casero del dashboard (Q5)
Migrar `BookAppointmentDialog` al `Dialog` de Radix ya usado en el resto, con focus-trap/ESC/aria gratis.

## Pasos de implementación

1. `status.ts` + `ApptCard` compartido (el más duplicado); reemplazar en staff y doctor, verificar.
2. `RescheduleDialog`, `DayView`, `WeekView` compartidos.
3. `errors.ts` + `toastError`; reemplazar catches genéricos.
4. Tipos desde Drizzle (incremental, archivo por archivo; `tsc` como guía — coordinar con el gate de CI del Plan 06).
5. Migrar el modal del dashboard a Radix.

## Consideraciones de despliegue

- Sin migración. Riesgo bajo pero **amplio** (toca las 3 rutas grandes): hacerlo incremental y probar cada pantalla.
- Rinde mucho más si el Plan 06 ya extrajo los slots (menos superficie duplicada).

## Criterios de aceptación

- `ApptCard`/`RescheduleDialog`/`DayView`/`WeekView` existen una sola vez.
- Sin `any` en el contexto de auth; sin casts `as StaffAppt[]`.
- Un error de `SLOT_TAKEN`/`SOFTLOCKED` muestra un mensaje específico, no "Error al actualizar".
- El diálogo de reserva del paciente cierra con ESC y atrapa el foco.

## Riesgos y rollback

- **Riesgo**: regresiones visuales/funcionales por unificar dos variantes. Mitigación: paridad visual pantalla por pantalla antes de borrar la copia.
- **Rollback**: revertir por componente.

## Qué NO tocar

- Lógica de negocio (slots → Plan 06; estados → Plan 03). Este plan es estructural/presentacional.
