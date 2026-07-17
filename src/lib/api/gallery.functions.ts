import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { galleryImages } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { requireRole } from "./_guards";
import { fileStorage } from "@/lib/storage.server";
import { parseDataUrl, toDataUrl } from "@/lib/dataUrl.server";

// El pipeline de compresión del cliente (GalleryTab.tsx `compressImage`) siempre
// produce JPEG, así que no hace falta persistir el mime type por separado.
const UPLOAD_MIME = "image/jpeg";

async function hydrateGalleryImage<
  T extends { imageType: string | null; storagePath: string | null; fileData: string | null },
>(img: T): Promise<T> {
  if (img.imageType === "upload" && img.storagePath) {
    const buffer = await fileStorage.readStoredFile(img.storagePath);
    return { ...img, fileData: toDataUrl(UPLOAD_MIME, buffer) };
  }
  return img;
}

export const getActiveGalleryImages = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await db
    .select()
    .from(galleryImages)
    .where(eq(galleryImages.isActive, true))
    .orderBy(asc(galleryImages.sortOrder));
  return Promise.all(rows.map(hydrateGalleryImage));
});

export const getAllGalleryImages = createServerFn({ method: "GET" }).handler(async () => {
  await requireRole("admin");
  const rows = await db.query.galleryImages.findMany({
    orderBy: (galleryImages, { asc }) => [asc(galleryImages.sortOrder)],
  });
  return Promise.all(rows.map(hydrateGalleryImage));
});

export const createGalleryImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      url: z.string().url().optional(),
      title: z.string().max(200).optional(),
      sortOrder: z.number().int().min(0).max(999).optional(),
      imageType: z.enum(["url", "upload"]).optional(),
      fileData: z.string().optional(),
      fileSize: z.number().int().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin");
    const imageType = data.imageType ?? "url";
    if (imageType === "upload" && data.fileData) {
      const { buffer } = parseDataUrl(data.fileData);
      const storagePath = await fileStorage.saveFile("gallery", buffer);
      const [newImage] = await db
        .insert(galleryImages)
        .values({
          url: null,
          title: data.title || null,
          sortOrder: data.sortOrder ?? 0,
          isActive: true,
          imageType: "upload",
          storagePath,
          fileSize: data.fileSize ?? buffer.length,
        })
        .returning();
      return newImage;
    }
    const [newImage] = await db
      .insert(galleryImages)
      .values({
        url: data.url!,
        title: data.title || null,
        sortOrder: data.sortOrder ?? 0,
        isActive: true,
        imageType: "url",
      })
      .returning();
    return newImage;
  });

export const updateGalleryImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      url: z.string().url().optional(),
      title: z.string().max(200).optional(),
      sortOrder: z.number().int().min(0).max(999),
      imageType: z.enum(["url", "upload"]).optional(),
      fileData: z.string().optional(),
      fileSize: z.number().int().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin");
    if (data.id) {
      const updateFields: Record<string, unknown> = {
        title: data.title || null,
        sortOrder: data.sortOrder,
      };
      let oldStoragePath: string | null = null;
      if (data.imageType === "upload" && data.fileData) {
        const existing = await db.query.galleryImages.findFirst({
          where: eq(galleryImages.id, data.id),
          columns: { storagePath: true },
        });
        oldStoragePath = existing?.storagePath ?? null;
        const { buffer } = parseDataUrl(data.fileData);
        updateFields.url = null;
        updateFields.imageType = "upload";
        updateFields.storagePath = await fileStorage.saveFile("gallery", buffer);
        updateFields.fileData = null;
        updateFields.fileSize = data.fileSize ?? buffer.length;
      } else if (data.imageType === "url" && data.url) {
        updateFields.url = data.url;
        updateFields.imageType = "url";
        updateFields.fileData = null;
        updateFields.storagePath = null;
        updateFields.fileSize = null;
      }
      const [updated] = await db
        .update(galleryImages)
        .set(updateFields)
        .where(eq(galleryImages.id, data.id))
        .returning();
      if (oldStoragePath) await fileStorage.deleteStoredFile(oldStoragePath);
      return updated;
    } else {
      const imageType = data.imageType ?? "url";
      if (imageType === "upload" && data.fileData) {
        const { buffer } = parseDataUrl(data.fileData);
        const storagePath = await fileStorage.saveFile("gallery", buffer);
        const [newImage] = await db
          .insert(galleryImages)
          .values({
            url: null,
            title: data.title || null,
            sortOrder: data.sortOrder,
            isActive: true,
            imageType: "upload",
            storagePath,
            fileSize: data.fileSize ?? buffer.length,
          })
          .returning();
        return newImage;
      }
      const [newImage] = await db
        .insert(galleryImages)
        .values({
          url: data.url!,
          title: data.title || null,
          sortOrder: data.sortOrder,
          isActive: true,
          imageType: "url",
        })
        .returning();
      return newImage;
    }
  });

export const deleteGalleryImage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireRole("admin");
    const existing = await db.query.galleryImages.findFirst({
      where: eq(galleryImages.id, data.id),
      columns: { storagePath: true },
    });
    await db.delete(galleryImages).where(eq(galleryImages.id, data.id));
    if (existing?.storagePath) await fileStorage.deleteStoredFile(existing.storagePath);
    return { success: true };
  });

/**
 * Hide a default stock image across all devices.
 * Stores a record in gallery_images with imageType='hidden_default'
 * and the defaultId stored in the title field.
 */
export const hideDefaultImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      defaultId: z.string(),
      url: z.string(),
      title: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin");
    // Remove any existing hidden_default record for this defaultId
    await db
      .delete(galleryImages)
      .where(
        and(eq(galleryImages.imageType, "hidden_default"), eq(galleryImages.title, data.defaultId)),
      );

    // Insert new hidden record
    await db.insert(galleryImages).values({
      url: data.url,
      title: data.defaultId,
      imageType: "hidden_default",
      isActive: false,
      sortOrder: 0,
    });

    return { success: true };
  });

/**
 * Unhide a default stock image across all devices.
 * Removes the hidden_default record for the given defaultId.
 */
export const unhideDefaultImage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ defaultId: z.string() }))
  .handler(async ({ data }) => {
    await requireRole("admin");
    await db
      .delete(galleryImages)
      .where(
        and(eq(galleryImages.imageType, "hidden_default"), eq(galleryImages.title, data.defaultId)),
      );
    return { success: true };
  });

/**
 * Get the IDs of default stock images that are hidden globally.
 * Returns an array of default IDs (e.g., ["default-1", "default-3"]).
 */
export const getHiddenDefaultIds = createServerFn({ method: "GET" }).handler(async () => {
  const records = await db
    .select({ title: galleryImages.title })
    .from(galleryImages)
    .where(and(eq(galleryImages.imageType, "hidden_default"), eq(galleryImages.isActive, false)));
  return records.map((r) => r.title).filter(Boolean) as string[];
});
