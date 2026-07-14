import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { specialties } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireRole } from "./_guards";

export const getActiveSpecialties = createServerFn({ method: "GET" }).handler(async () => {
  return db
    .select()
    .from(specialties)
    .where(eq(specialties.isActive, true))
    .orderBy(asc(specialties.sortOrder));
});

export const getAllSpecialties = createServerFn({ method: "GET" }).handler(async () => {
  return db.query.specialties.findMany({
    orderBy: (specialties, { asc }) => [asc(specialties.sortOrder)],
  });
});

export const createSpecialty = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(2).max(80),
      description: z.string().max(500).optional(),
      icon: z.string().max(40).optional(),
      sortOrder: z.number().int().min(0).max(999),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin");
    const [newSpecialty] = await db.insert(specialties).values(data).returning();
    return newSpecialty;
  });

export const updateSpecialty = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(2).max(80),
      description: z.string().max(500).optional(),
      icon: z.string().max(40).optional(),
      sortOrder: z.number().int().min(0).max(999),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin");
    const { id, ...updateData } = data;
    await db.update(specialties).set(updateData).where(eq(specialties.id, id));
    return { success: true };
  });

export const deleteSpecialty = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireRole("admin");
    await db.delete(specialties).where(eq(specialties.id, data.id));
    return { success: true };
  });
