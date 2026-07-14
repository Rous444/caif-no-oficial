import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { galleryImages } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { requireRole } from "./_guards";

export const getActiveGalleryImages = createServerFn({ method: "GET" }).handler(async () => {
  return db
    .select()
    .from(galleryImages)
    .where(eq(galleryImages.isActive, true))
    .orderBy(asc(galleryImages.sortOrder));
});

export const getAllGalleryImages = createServerFn({ method: "GET" }).handler(async () => {
  await requireRole("admin");
  return db.query.galleryImages.findMany({
    orderBy: (galleryImages, { asc }) => [asc(galleryImages.sortOrder)],
  });
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
      const [newImage] = await db
        .insert(galleryImages)
        .values({
          url: null,
          title: data.title || null,
          sortOrder: data.sortOrder ?? 0,
          isActive: true,
          imageType: "upload",
          fileData: data.fileData,
          fileSize: data.fileSize ?? null,
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
      if (data.imageType === "upload" && data.fileData) {
        updateFields.url = null;
        updateFields.imageType = "upload";
        updateFields.fileData = data.fileData;
        updateFields.fileSize = data.fileSize ?? null;
      } else if (data.imageType === "url" && data.url) {
        updateFields.url = data.url;
        updateFields.imageType = "url";
        updateFields.fileData = null;
        updateFields.fileSize = null;
      }
      const [updated] = await db
        .update(galleryImages)
        .set(updateFields)
        .where(eq(galleryImages.id, data.id))
        .returning();
      return updated;
    } else {
      const imageType = data.imageType ?? "url";
      if (imageType === "upload" && data.fileData) {
        const [newImage] = await db
          .insert(galleryImages)
          .values({
            url: null,
            title: data.title || null,
            sortOrder: data.sortOrder,
            isActive: true,
            imageType: "upload",
            fileData: data.fileData,
            fileSize: data.fileSize ?? null,
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
    await db.delete(galleryImages).where(eq(galleryImages.id, data.id));
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
