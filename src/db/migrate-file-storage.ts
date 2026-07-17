/**
 * Plan 08 — migración manual de archivos base64 a disco.
 *
 * NO se ejecuta en el deploy (no lo llama drizzle-kit push ni el Dockerfile).
 * Correr a mano, en dos pasadas, con dump previo de la DB:
 *
 *   bun run src/db/migrate-file-storage.ts            # pasada 1: copia a storage, NO toca fileData
 *   bun run src/db/migrate-file-storage.ts --verify    # solo reporta filas storagePath sin verificar
 *   bun run src/db/migrate-file-storage.ts --clear     # pasada 2: verifica bytes y recién ahí limpia fileData
 *
 * Ventana nocturna (21:00–08:00 ARG), STORAGE_PATH apuntando al disco de Render (/var/data)
 * y DATABASE_URL apuntando a producción. Ver docs/08-almacenamiento-archivos.md.
 */
import { db } from "./index";
import { medicalRecords, galleryImages } from "./schema";
import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { fileStorage } from "../lib/storage.server";
import { parseDataUrl } from "../lib/dataUrl.server";

async function migrateMedicalRecords() {
  const rows = await db
    .select({ id: medicalRecords.id, fileData: medicalRecords.fileData })
    .from(medicalRecords)
    .where(and(isNotNull(medicalRecords.fileData), isNull(medicalRecords.storagePath)));
  console.log(`medical_records: ${rows.length} fila(s) por migrar a storage`);
  for (const row of rows) {
    if (!row.fileData) continue;
    const storagePath = await fileStorage.saveFile("records", Buffer.from(row.fileData, "base64"));
    await db.update(medicalRecords).set({ storagePath }).where(eq(medicalRecords.id, row.id));
    console.log(`  ficha ${row.id} -> ${storagePath}`);
  }
}

async function migrateGalleryImages() {
  const rows = await db
    .select({ id: galleryImages.id, fileData: galleryImages.fileData })
    .from(galleryImages)
    .where(and(isNotNull(galleryImages.fileData), isNull(galleryImages.storagePath)));
  console.log(`gallery_images: ${rows.length} fila(s) por migrar a storage`);
  for (const row of rows) {
    if (!row.fileData) continue;
    const { buffer } = parseDataUrl(row.fileData);
    const storagePath = await fileStorage.saveFile("gallery", buffer);
    await db.update(galleryImages).set({ storagePath }).where(eq(galleryImages.id, row.id));
    console.log(`  imagen ${row.id} -> ${storagePath}`);
  }
}

async function verifyMedicalRecords(): Promise<{ id: string; ok: boolean }[]> {
  const rows = await db
    .select({
      id: medicalRecords.id,
      fileData: medicalRecords.fileData,
      storagePath: medicalRecords.storagePath,
    })
    .from(medicalRecords)
    .where(and(isNotNull(medicalRecords.fileData), isNotNull(medicalRecords.storagePath)));
  const results: { id: string; ok: boolean }[] = [];
  for (const row of rows) {
    const expected = Buffer.from(row.fileData!, "base64");
    const actual = await fileStorage.readStoredFile(row.storagePath!).catch(() => null);
    results.push({ id: row.id, ok: actual !== null && actual.equals(expected) });
  }
  return results;
}

async function verifyGalleryImages(): Promise<{ id: string; ok: boolean }[]> {
  const rows = await db
    .select({
      id: galleryImages.id,
      fileData: galleryImages.fileData,
      storagePath: galleryImages.storagePath,
    })
    .from(galleryImages)
    .where(and(isNotNull(galleryImages.fileData), isNotNull(galleryImages.storagePath)));
  const results: { id: string; ok: boolean }[] = [];
  for (const row of rows) {
    const { buffer: expected } = parseDataUrl(row.fileData!);
    const actual = await fileStorage.readStoredFile(row.storagePath!).catch(() => null);
    results.push({ id: row.id, ok: actual !== null && actual.equals(expected) });
  }
  return results;
}

async function clearVerified() {
  const [mr, gi] = await Promise.all([verifyMedicalRecords(), verifyGalleryImages()]);
  const failedMr = mr.filter((r) => !r.ok);
  const failedGi = gi.filter((r) => !r.ok);
  if (failedMr.length || failedGi.length) {
    console.error("Verificación falló, NO se limpia fileData de estas filas:");
    for (const r of failedMr) console.error(`  medical_records ${r.id}`);
    for (const r of failedGi) console.error(`  gallery_images ${r.id}`);
    process.exitCode = 1;
  }
  for (const r of mr.filter((r) => r.ok)) {
    await db.update(medicalRecords).set({ fileData: null }).where(eq(medicalRecords.id, r.id));
  }
  for (const r of gi.filter((r) => r.ok)) {
    await db.update(galleryImages).set({ fileData: null }).where(eq(galleryImages.id, r.id));
  }
  console.log(
    `Verificadas y limpiadas: ${mr.filter((r) => r.ok).length} fichas, ${gi.filter((r) => r.ok).length} imágenes.`,
  );
}

async function reportVerify() {
  const [mr, gi] = await Promise.all([verifyMedicalRecords(), verifyGalleryImages()]);
  console.log(`medical_records: ${mr.filter((r) => r.ok).length}/${mr.length} verificadas OK`);
  console.log(`gallery_images: ${gi.filter((r) => r.ok).length}/${gi.length} verificadas OK`);
  const failed = [...mr, ...gi].filter((r) => !r.ok);
  if (failed.length) {
    console.error("Filas con mismatch (no limpiar hasta resolver):", failed);
    process.exitCode = 1;
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === "--clear") {
    await clearVerified();
  } else if (mode === "--verify") {
    await reportVerify();
  } else {
    await migrateMedicalRecords();
    await migrateGalleryImages();
    console.log(
      "Pasada 1 completa. fileData NO fue tocado. Verificar con --verify y recién luego --clear.",
    );
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
