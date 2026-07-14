import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { doctors, doctorSpecialties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "./_guards";

export const getDoctorsBySpecialty = createServerFn({ method: "POST" })
  .inputValidator(z.object({ specialtyId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const ds = await db.query.doctorSpecialties.findMany({
      where: eq(doctorSpecialties.specialtyId, data.specialtyId),
      with: { doctor: { with: { user: true, specialties: { with: { specialty: true } } } } },
    });
    return ds.map((d) => d.doctor);
  });

export const getAllDoctors = createServerFn({ method: "GET" }).handler(async () => {
  await requireRole("recepcionista", "admin");
  return db.query.doctors.findMany({
    with: {
      specialty: true,
      user: true,
      specialties: { with: { specialty: true } },
    },
  });
});

export const updateDoctor = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      specialtyIds: z.array(z.string().uuid()).optional(),
      licenseNumber: z.string().optional(),
      bio: z.string().optional(),
      slotMinutes: z.number().int().min(15).max(120).optional(),
      insuranceCompanies: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin");
    const { id, specialtyIds, insuranceCompanies, ...updateData } = data;
    await db
      .update(doctors)
      .set({ ...updateData, insuranceCompanies: insuranceCompanies || null })
      .where(eq(doctors.id, id));
    if (specialtyIds) {
      await db.delete(doctorSpecialties).where(eq(doctorSpecialties.doctorId, id));
      if (specialtyIds.length > 0) {
        await db
          .insert(doctorSpecialties)
          .values(specialtyIds.map((specialtyId) => ({ doctorId: id, specialtyId })));
      }
    }
    return { success: true };
  });

export const deleteDoctor = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireRole("admin");
    await db.delete(doctorSpecialties).where(eq(doctorSpecialties.doctorId, data.id));
    await db.delete(doctors).where(eq(doctors.id, data.id));
    return { success: true };
  });

export const updateDoctorWhatsappPreference = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      doctorId: z.string().uuid(),
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin", "medico");
    await db
      .update(doctors)
      .set({ whatsappNotifications: data.enabled })
      .where(eq(doctors.id, data.doctorId));
    return { success: true };
  });
