import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { doctorSchedules, doctors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireDoctor } from "./_guards";

export const updateMyInsurance = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      insuranceCompanies: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { doctorId } = await requireDoctor();
    await db
      .update(doctors)
      .set({ insuranceCompanies: data.insuranceCompanies })
      .where(eq(doctors.id, doctorId));
    return { success: true };
  });

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleSchema = z.object({
  weekday: z.number().min(0).max(6),
  startTime: z.string().regex(timeRegex, "Formato de hora inválido (HH:MM)"),
  endTime: z.string().regex(timeRegex, "Formato de hora inválido (HH:MM)"),
});

export const getMySchedule = createServerFn({ method: "POST" }).handler(async () => {
  const { doctorId } = await requireDoctor();
  return db.query.doctorSchedules.findMany({
    where: eq(doctorSchedules.doctorId, doctorId),
  });
});

export const updateMySchedule = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      schedules: z.array(scheduleSchema),
    }),
  )
  .handler(async ({ data }) => {
    const { doctorId } = await requireDoctor();

    for (const sched of data.schedules) {
      if (sched.startTime >= sched.endTime) {
        throw new Error(
          `La hora de fin debe ser posterior a la hora de inicio (día ${sched.weekday})`,
        );
      }
    }

    const byWeekday = new Map<number, typeof data.schedules>();
    for (const s of data.schedules) {
      const list = byWeekday.get(s.weekday) ?? [];
      list.push(s);
      byWeekday.set(s.weekday, list);
    }
    for (const [weekday, blocks] of byWeekday) {
      const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].startTime < sorted[i - 1].endTime) {
          throw new Error(`Los horarios del día ${weekday} se superponen entre sí`);
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(doctorSchedules).where(eq(doctorSchedules.doctorId, doctorId));

      if (data.schedules.length > 0) {
        await tx.insert(doctorSchedules).values(
          data.schedules.map((s) => ({
            doctorId,
            weekday: s.weekday,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        );
      }
    });

    return { success: true };
  });

export const getDoctorSchedule = createServerFn({ method: "POST" })
  .inputValidator(z.object({ doctorId: z.string().uuid() }))
  .handler(async ({ data }) => {
    return db.query.doctorSchedules.findMany({
      where: eq(doctorSchedules.doctorId, data.doctorId),
    });
  });

export const getMyDoctorProfile = createServerFn({ method: "POST" }).handler(async () => {
  const { doctorId } = await requireDoctor();
  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, doctorId),
    with: { specialties: { with: { specialty: true } }, user: true },
  });
  return doctor!;
});

export const updateMyBio = createServerFn({ method: "POST" })
  .inputValidator(z.object({ bio: z.string().max(500) }))
  .handler(async ({ data }) => {
    const { doctorId } = await requireDoctor();
    await db.update(doctors).set({ bio: data.bio }).where(eq(doctors.id, doctorId));
    return { success: true };
  });

export const getDoctorIdByUserId = createServerFn({ method: "POST" }).handler(async () => {
  const { doctorId } = await requireDoctor();
  return doctorId;
});

export const updateMyWhatsappPreference = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const { doctorId } = await requireDoctor();
    await db
      .update(doctors)
      .set({ whatsappNotifications: data.enabled })
      .where(eq(doctors.id, doctorId));
    return { success: true };
  });
