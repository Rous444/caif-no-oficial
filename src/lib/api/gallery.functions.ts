import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { galleryImages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const getActiveGalleryImages = createServerFn({ method: "GET" }).handler(async () => {
  return db
    .select()
    .from(galleryImages)
    .where(eq(galleryImages.isActive, true))
    .orderBy(asc(galleryImages.sortOrder));
});

export const getAllGalleryImages = createServerFn({ method: "GET" }).handler(async () => {
  return db.query.galleryImages.findMany({
    orderBy: (galleryImages, { asc }) => [asc(galleryImages.sortOrder)],
  });
});

export const createGalleryImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      url: z.string().url(),
      title: z.string().max(200).optional(),
      sortOrder: z.number().int().min(0).max(999).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const [newImage] = await db.insert(galleryImages).values(data).returning();
    return newImage;
  });

export const deleteGalleryImage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await db.delete(galleryImages).where(eq(galleryImages.id, data.id));
    return { success: true };
  });
