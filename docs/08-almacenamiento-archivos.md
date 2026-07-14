# Plan 08 — Archivos fuera de Postgres

> **Leé primero [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md).** Resuelve **M9**.
> Autocontenido. Toca fichas médicas y galería; independiente del resto.
>
> **⚠️ Es el plan que más toca datos (migra archivos y elimina `fileData`). NO ejecutar durante la fase de carga de médicos (§4.7).** Posponer hasta que la carga esté 100% terminada y hacerlo **fuera** del `drizzle-kit push` automático del deploy, con **dump previo** y verificación en dos pasadas (nunca borrar `fileData` hasta confirmar la copia). Este es el candidato #1 a esperar.

## Objetivo

Dejar de guardar archivos (fichas médicas, imágenes de galería) como **base64 en columnas `text` de Postgres**, para no agotar el plan de 256 MB.

## Por qué

Ver §2 M9. [`medicalRecords.fileData`](../src/db/schema.ts) y `galleryImages.fileData` guardan archivos de hasta 20 MB en base64 (≈ +33% de overhead) dentro de un Postgres de 256 MB **sin PITR**, con versionado que nunca poda ([`medical-records.functions.ts`](../src/lib/api/medical-records.functions.ts)). Es una cuenta regresiva al disco lleno y al colapso de backups.

## Archivos afectados

- [`src/db/schema.ts`](../src/db/schema.ts) — `medicalRecords`/`galleryImages`: reemplazar `fileData` por `storagePath` (metadata) + migración.
- [`src/lib/api/medical-records.functions.ts`](../src/lib/api/medical-records.functions.ts) — leer/escribir del storage.
- [`src/lib/api/gallery.functions.ts`](../src/lib/api/gallery.functions.ts) — ídem.
- `doctor.tsx` (upload/view de fichas) y `GalleryTab.tsx` — ajustar cliente si cambia el contrato.

## Diseño de la solución

### Opción A — Disco persistente de Render (`/var/data`) — más simple, ya montado
- Ya existe el disco de 1 GB en `/var/data` ([`render.yaml`](../render.yaml)). Guardar los archivos ahí (`/var/data/records/<id>`), en DB solo `storagePath` + metadata.
- **Servir**: una server fn autenticada (Plan 01) que lee el archivo del disco y lo devuelve como response con el `content-type` correcto. **No** exponer el disco como estático público (son datos de salud).
- **Contras**: comparte disco con la sesión de WhatsApp; 1 GB es finito; el archivo vive en la instancia (aceptable para 1 instancia).

### Opción B — Object storage (S3/R2/Supabase Storage) — más robusto
- Subir a un bucket; DB guarda la key. Servir con URLs firmadas de corta duración.
- **Contras**: dependencia externa + credenciales; más setup. Mejor a mediano plazo.

**Recomendación**: empezar con **Opción A** (rápida, sin dependencias nuevas) y dejar B documentada como evolución. El repo ya tiene una carpeta `supabase/` — verificar si hay intención previa de usar Supabase Storage antes de decidir.

### Migración de datos existentes
- Script único que recorre las filas con `fileData`, escribe el archivo al storage y setea `storagePath`, luego (en una segunda pasada, tras verificar) limpia `fileData`.
- **Pregunta abierta** (§6 relevamiento): ¿migrar lo existente o solo cambiar de aquí en más? Migrar es lo que libera espacio; solo-nuevos no resuelve M9.

## Pasos de implementación

1. Migración de schema: agregar `storagePath` (nullable durante la transición); mantener `fileData` temporalmente.
2. Escritura: `uploadMedicalRecord`/galería escriben al storage y setean `storagePath`.
3. Lectura: `getRecordFile` lee del storage si hay `storagePath`, si no cae a `fileData` (compat).
4. Script de migración de datos existentes (con verificación).
5. Segunda migración: eliminar `fileData` una vez migrado y verificado.
6. Poda de versiones (opcional): política de retención para `recordVersion` viejas.

## Consideraciones de despliegue

- **Dos migraciones** (agregar columna → eliminar `fileData`) separadas por la migración de datos. Ventana nocturna + dump previo.
- Coordinar con Plan 01: la lectura de archivos **debe** estar autenticada y con chequeo de pertenencia.
- Cuidar el tamaño de `/var/data` (Opción A) vs. la sesión de WhatsApp.

## Criterios de aceptación

- Subir una ficha nueva no escribe base64 en la DB.
- Ver/descargar una ficha existente sigue funcionando (compat durante la transición).
- Tras la migración, `SELECT sum(length(file_data))` cae a ~0.

## Riesgos y rollback

- **Riesgo medio**: pérdida de archivos si el script de migración falla a medias. Mitigación: no borrar `fileData` hasta verificar; dump previo.
- **Rollback**: mientras `fileData` exista, revertir el código restaura el comportamiento anterior.

## Qué NO tocar

- Auth (Plan 01) provee el guard de lectura; acá solo se cambia dónde vive el byte.
