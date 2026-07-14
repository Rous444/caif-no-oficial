# Plan 09 — Rediseño frontend / UX

> **Leé primero [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md) (§3).** Resuelve la planitud del frontend y la falta de reactividad.
> Rinde mucho más **después** del Plan 06 (slots) y Plan 03 (estados/errores). Sin display de sala (decisión confirmada §4.1).

## Objetivo

Dar jerarquía funcional y reactividad a la interfaz sin perder la identidad visual que ya evita el look genérico de IA. Foco en la **agenda de recepción/médico** (herramienta de trabajo intensivo) y en el feedback inmediato.

## Por qué

Ver §3 del relevamiento: hay tokens decentes (teal/verde, DM Serif Display + Fira Sans) pero **todo se renderiza con la misma receta** (`rounded-2xl border bg-background p-5`), sin jerarquía. La agenda es una lista de cards sin eje temporal. El feedback es "clic → silencio → toast". La reactividad a la presencia es nula.

## Dirección visual (concreta, no genérica)

Conservar la identidad (serif display + teal sobre neutros) y construir **jerarquía por densidad y función**, no por más decoración.

### 1. La agenda como grilla temporal, no como lista
- Eje vertical de horas (08:00–21:00); en escritorio, **columnas por profesional**; en mobile, un profesional por vez (selector) — sigue las convenciones mobile del CLAUDE.md.
- **Huecos visibles** (se ve la disponibilidad real), **línea de "ahora"**, turnos como bloques con altura proporcional a la duración.
- Estado codificado con **borde izquierdo de color + badge**, no con cards uniformes.
- Reemplaza la lista vertical de `DayView` para staff/médico. El panel del **paciente** puede quedar en formato lista/card (uso ocasional).

### 2. Densidad por audiencia
- Paciente: "aireado" como está.
- Recepción/médico: **densidad compacta** — menos padding, tipografía utilitaria más chica, acciones en menú contextual (`⋯`) en vez de 4 botones por fila.

### 3. Feedback y presencia (reactividad)
- **Mutaciones optimistas** con rollback para cambios de estado (el clic responde en 0 ms). Apoyarse en `useMutation` de React Query.
- **Refresco por presencia**: `refetchInterval` de 30–60 s en la agenda **mientras la tab está visible** (`document.visibilityState`), con indicador discreto "Actualizado hace Xs". Resuelve M4/M7 a nivel percepción (la corrección de fondo es Plan 03).
- **Skeletons** en vez de "Cargando..." plano.
- **`aria-live`** en los toasts/cambios de estado.

### 4. Consistencia
- Unificar el tratamiento de slots ocupados (hoy: "Ocupado" rojo en staff, tachado en doctor, oculto en dashboard).
- Migrar el modal casero del dashboard a Radix (si no se hizo en Plan 07).
- `lang="es"`, 404/error en castellano (si no se hizo en Plan 04).
- Explicar el softlock donde deshabilita ("El sistema abre a las 08:00").

## Archivos afectados

- Nuevo: `src/components/agenda/DayGrid.tsx` (grilla temporal) — o extender los `src/components/agenda/` del Plan 07.
- `staff.tsx`, `doctor.tsx` — usar la grilla.
- `src/components/ui/skeleton.tsx` (ya existe) — usar.
- Ajustes de tokens/utilidades en [`styles.css`](../src/styles.css) si hace falta densidad.

## Pasos de implementación

1. Definir la grilla `DayGrid` (layout de horas + bloques) en desktop; validar con datos reales.
2. Variante mobile (selector de profesional + scroll horario).
3. Optimistic updates + `refetchInterval` por visibilidad + indicador de frescura.
4. Skeletons y `aria-live`.
5. Densidad compacta para staff/médico; unificar slots ocupados; softlock explicado.

## Consideraciones de despliegue

- Sin migración. Riesgo **medio** por ser un cambio de UX amplio (la grilla no es incremental sobre las cards — es reemplazo).
- Hacerlo detrás de los planes de fondo (03/06) para no rediseñar sobre lógica que va a cambiar.

## Criterios de aceptación

- La agenda de recepción muestra un eje temporal con huecos y "ahora".
- Cambiar el estado de un turno se refleja al instante (optimista) y se revierte si el server rechaza.
- Con la tab visible, la agenda se actualiza sola cada 30–60 s y se ve cuándo fue la última actualización.
- Mobile: un profesional por vez, usable con el pulgar (touch targets 44px).

## Riesgos y rollback

- **Riesgo**: la grilla temporal es el mayor cambio visual del proyecto. Mitigación: construirla como componente nuevo conviviendo con la lista hasta validar, luego cambiar el default.
- **Rollback**: volver a `DayView` lista.

## Dependencias

- **Ideal después de**: Plan 06 (slots), Plan 03 (estados/errores tipados para el feedback), Plan 07 (componentes de agenda compartidos).
- No introduce display de sala (descartado).
