import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { user, patients } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const resolveLoginIdentifier = createServerFn({ method: "POST" })
  .inputValidator(z.object({ identifier: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { identifier } = data;

    const isEmail = identifier.includes("@");
    if (isEmail) {
      const [found] = await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(eq(user.email, identifier.toLowerCase()))
        .limit(1);
      return { email: found?.email ?? null };
    }

    const [found] = await db
      .select({ email: user.email })
      .from(patients)
      .innerJoin(user, eq(patients.userId, user.id))
      .where(eq(patients.documentNumber, identifier))
      .limit(1);
    return { email: found?.email ?? null };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().min(1).optional(),
      email: z.string().email().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { userId, ...fields } = data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (fields.firstName !== undefined) updateData.firstName = fields.firstName;
    if (fields.lastName !== undefined) updateData.lastName = fields.lastName;
    if (fields.phone !== undefined) updateData.phone = fields.phone;
    if (fields.email !== undefined) {
      const existing = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.email, fields.email), eq(user.id, userId)))
        .limit(1);
      if (!existing.length) {
        const dup = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, fields.email))
          .limit(1);
        if (dup.length) throw new Error("Ya existe un usuario con este email");
      }
      updateData.email = fields.email;
      updateData.name =
        `${updateData.firstName ?? ""} ${updateData.lastName ?? ""}`.trim() || fields.email;
    }
    await db.update(user).set(updateData).where(eq(user.id, userId));
    return { success: true };
  });
