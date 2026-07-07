import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { doctorSchedules, doctors } from "@/db/schema";
import { eq } from "drizzle-orm";

export const updateMyInsurance = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string(),
      insuranceCompanies: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, data.userId),
    });
    if (!doctor) throw new Error("No se encontró perfil de médico");
    await db
      .update(doctors)
      .set({ insuranceCompanies: data.insuranceCompanies })
      .where(eq(doctors.id, doctor.id));
    return { success: true };
  });

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleSchema = z.object({
  weekday: z.number().min(0).max(6),
  startTime: z.string().regex(timeRegex, "Formato de hora inválido (HH:MM)"),
  endTime: z.string().regex(timeRegex, "Formato de hora inválido (HH:MM)"),
});

export const getMySchedule = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, data.userId),
    });

    if (!doctor) {
      throw new Error("No se encontró perfil de médico");
    }

    return db.query.doctorSchedules.findMany({
      where: eq(doctorSchedules.doctorId, doctor.id),
    });
  });

export const updateMySchedule = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string(),
      schedules: z.array(scheduleSchema),
    }),
  )
  .handler(async ({ data }) => {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, data.userId),
    });

    if (!doctor) {
      throw new Error("No se encontró perfil de médico");
    }

    for (const sched of data.schedules) {
      if (sched.startTime >= sched.endTime) {
        throw new Error(
          `La hora de fin debe ser posterior a la hora de inicio (día ${sched.weekday})`,
        );
      }
    }

    await db.delete(doctorSchedules).where(eq(doctorSchedules.doctorId, doctor.id));

    if (data.schedules.length > 0) {
      await db.insert(doctorSchedules).values(
        data.schedules.map((s) => ({
          doctorId: doctor.id,
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      );
    }

    return { success: true };
  });

export const getDoctorSchedule = createServerFn({ method: "POST" })
  .inputValidator(z.object({ doctorId: z.string().uuid() }))
  .handler(async ({ data }) => {
    return db.query.doctorSchedules.findMany({
      where: eq(doctorSchedules.doctorId, data.doctorId),
    });
  });

export const getMyDoctorProfile = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, data.userId),
      with: { specialties: { with: { specialty: true } }, user: true },
    });
    return doctor;
  });

export const getDoctorIdByUserId = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, data.userId),
    });
    return doctor?.id ?? null;
  });
