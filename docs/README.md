# Planes de mejora CAIF — Índice

Documentación de auditoría y planes de implementación para el sistema de turnos CAIF.
Pensada para trabajar **cada plan en un chat separado y enfocado**.

## ⚠️ Restricciones globales (aplican a TODOS los planes)

1. **Congelamiento de datos — fase de carga de médicos.** El sistema está a mitad de la carga de datos previa a producción. **Nada debe modificar/borrar datos existentes.** El `seed.ts` es idempotente (seguro), pero **`bunx drizzle-kit push` corre en cada deploy** ([`Dockerfile:57`](../Dockerfile)) y auto-aplica cualquier cambio de `schema.ts` contra producción. Mientras dure la carga: **solo cambios de schema aditivos**; las migraciones que tocan datos (**03** constraint, **04** FK, **08** storage) se **posponen** o se corren manualmente con **dump previo**, nunca vía el push automático del deploy.
2. **No endurecer el login de pacientes.** Email no verificado + DNI = "usuario glorificado", a propósito (público con adultos mayores). No agregar verificación de email/2FA/fricción. El Plan 01 es autorización server-side, no autenticación. Ver §4.6 del relevamiento.

## Cómo usar esta carpeta

1. [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md) es la **fuente de verdad**: arquitectura real + todos los hallazgos con severidad y `archivo:línea`. **Todo plan asume que se leyó primero.**
2. Cada `0X-*.md` es un **plan autocontenido e independiente**: objetivo, por qué, archivos, diseño (el "cómo"), pasos, despliegue, criterios de aceptación, riesgos y qué NO tocar.
3. Para arrancar un plan en un chat nuevo, usá la **plantilla de prompt** de abajo.

## Índice

| Plan | Título | Tipo | Urgencia |
|------|--------|------|----------|
| [01](01-autorizacion-server-side.md) | Autorización server-side + hardening | Seguridad | 🔴 Alta |
| [02](02-whatsapp-produccion-y-robustez.md) | WhatsApp: reparar producción + robustez | Bug prod | 🔴 Alta |
| [03](03-integridad-ciclo-de-vida-turno.md) | Integridad y ciclo de vida del turno | Datos/lógica | 🔴 Alta |
| [04](04-correcciones-puntuales.md) | Correcciones puntuales | Varios | 🟡 Media |
| [05](05-modo-whatsapp-directo-medico.md) | Feature: modo WhatsApp directo del médico | Feature | 🟡 Media |
| [06](06-modulo-slots-y-tests.md) | Módulo único de slots + tests + CI | Refactor base | 🟡 Media |
| [07](07-refactor-componentes-y-tipos.md) | Refactor de componentes, tipos y errores | Refactor | 🟢 Baja |
| [08](08-almacenamiento-archivos.md) | Archivos fuera de Postgres | Storage | 🟡 Media |
| [09](09-rediseno-frontend-ux.md) | Rediseño frontend / UX | Rediseño | 🟢 Baja |

## Orden recomendado

```
02 (prod caído)  →  01 (datos expuestos)  →  03 (integridad)  →  04 (quick wins)
   →  06 (slots+tests)  →  05 (feature)  →  08 (storage)  →  07 (refactor)  →  09 (UX)
```

Dependencias blandas: 07 rinde más tras 06; 09 rinde más tras 03/06/07. Todo lo demás es independiente.

## Dependencias / solapamientos a tener en cuenta

- **01, 03, 04, 07** usan un concepto común de **errores tipados** (`SLOT_TAKEN`, `SOFTLOCKED`, `STALE_STATE`, `FORBIDDEN`...). El primero que se implemente puede crear `src/lib/errors.ts`; los demás lo reutilizan.
- **03 y 06** tocan `appointments.functions.ts`: 06 aporta la función pura de slots, 03 la usa dentro de la transacción. Si se hacen en paralelo, coordinar el merge de ese archivo.
- **02 y 04** ambos pueden tocar `.gitignore`/`.dockerignore` (`.wwebjs_cache`). Hacerlo en uno solo.
- **04 (ítem 2, softlock) y 05** se apoyan en la identidad de sesión del **01**; si se hacen antes, dejar el chequeo de rol marcado como provisorio.

---

## Plantilla de prompt para un chat enfocado

Copiá esto en el chat nuevo, reemplazando `NN` por el número de plan:

```
Vas a implementar un plan de mejora ya definido para CAIF (sistema de turnos de un
consultorio médico). El trabajo previo de auditoría y planificación ya está hecho y
vive en la carpeta docs/.

ANTES de escribir código, leé en este orden y confirmá que entendiste:
1. docs/00-RELEVAMIENTO.md  → arquitectura real + hallazgos (fuente de verdad).
   Prestá especial atención a §4.6 (no tocar el login de pacientes) y §4.7
   (congelamiento de datos durante la carga de médicos).
2. docs/README.md  → sección "Restricciones globales" (aplican a todos los planes).
3. docs/NN-<nombre-del-plan>.md  → el plan que vas a implementar.
4. CLAUDE.md  → stack, comandos (Bun, no npm), y las "Deployment caution":
   producción está viva en Render, DB de 256 MB sin PITR, y solo se deploya
   entre 21:00 y 08:00 ARG.

RESTRICCIÓN DURA: estamos a mitad de la carga de datos de médicos. NADA debe
modificar ni borrar datos existentes. Recordá que `drizzle-kit push` corre en cada
deploy y auto-aplica cambios de schema. Si tu plan toca la DB, solo cambios
aditivos; cualquier migración que toque datos se pospone o se corre manualmente
con dump previo — nunca vía el push automático del deploy. Ante la duda, preguntá
antes de tocar schema.ts.

Contexto de producto ya confirmado con el cliente (está en el §4/§5 del relevamiento):
no hay display de sala; el softlock 21:00–08:00 es solo para que los pacientes no
reserven de madrugada; el turnero WhatsApp debe listar pendiente + confirmado; a los
turnos los marca ausente solo el médico y pasados N minutos se asume asistido.

Reglas de trabajo:
- Respetá el alcance del plan NN. Si algo cae fuera, anotalo pero no lo implementes acá.
- Mirá la sección "Qué NO tocar" del plan.
- Mirá las "Preguntas abiertas" del plan: si alguna bloquea, preguntámela antes de asumir.
- Antes de tocar la DB, verificá localmente (bun db:push contra una copia) y evitá
  migraciones destructivas.
- Al terminar, cumplí los "Criterios de aceptación" del plan y decime cómo los verificaste.

Empezá leyendo los 3 documentos y devolvéme un resumen breve del plan NN + tu
propuesta de primeros pasos antes de tocar nada.
```

> Para planes con migración (03, 04-ítem3, 05, 08) recordale explícitamente el dump previo y la ventana nocturna de deploy.
