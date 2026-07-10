import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { medicalRecords, doctors, patients, user } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const uploadMedicalRecord = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      doctorId: z.string().uuid(),
      patientId: z.string(),
      fileName: z.string().min(1),
      fileType: z.string().min(1),
      fileData: z.string().min(1),
      fileSize: z
        .number()
        .int()
        .max(20 * 1024 * 1024),
    }),
  )
  .handler(async ({ data }) => {
    const lastVersion = await db
      .select({ maxVersion: sql<number>`coalesce(max(${medicalRecords.recordVersion}), 0)` })
      .from(medicalRecords)
      .where(
        and(
          eq(medicalRecords.doctorId, data.doctorId),
          eq(medicalRecords.patientId, data.patientId),
        ),
      )
      .then((r) => r[0]?.maxVersion ?? 0);

    const [record] = await db
      .insert(medicalRecords)
      .values({
        doctorId: data.doctorId,
        patientId: data.patientId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileData: data.fileData,
        fileSize: data.fileSize,
        recordVersion: lastVersion + 1,
      })
      .returning();
    return record;
  });

export const getMyPatientRecords = createServerFn({ method: "POST" })
  .inputValidator(z.object({ doctorId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const rows = await db
      .select({
        id: medicalRecords.id,
        doctorId: medicalRecords.doctorId,
        patientId: medicalRecords.patientId,
        fileName: medicalRecords.fileName,
        fileType: medicalRecords.fileType,
        fileSize: medicalRecords.fileSize,
        recordVersion: medicalRecords.recordVersion,
        createdAt: medicalRecords.createdAt,
        patientFirstName: user.firstName,
        patientLastName: user.lastName,
        patientEmail: user.email,
        patientDni: patients.documentNumber,
      })
      .from(medicalRecords)
      .innerJoin(user, eq(user.id, medicalRecords.patientId))
      .leftJoin(patients, eq(patients.userId, medicalRecords.patientId))
      .where(eq(medicalRecords.doctorId, data.doctorId))
      .orderBy(desc(medicalRecords.createdAt));

    return rows.map((r) => ({
      id: r.id,
      doctorId: r.doctorId,
      patientId: r.patientId,
      fileName: r.fileName,
      fileType: r.fileType,
      fileSize: r.fileSize,
      recordVersion: r.recordVersion,
      createdAt: r.createdAt,
      patient: {
        firstName: r.patientFirstName,
        lastName: r.patientLastName,
        email: r.patientEmail,
        documentNumber: r.patientDni ?? null,
      },
    }));
  });

export const getRecordFile = createServerFn({ method: "POST" })
  .inputValidator(z.object({ recordId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const record = await db.query.medicalRecords.findFirst({
      where: eq(medicalRecords.id, data.recordId),
      columns: { fileData: true, fileName: true, fileType: true, recordVersion: true },
    });
    if (!record) throw new Error("Ficha médica no encontrada");
    return record;
  });

export const deleteMedicalRecord = createServerFn({ method: "POST" })
  .inputValidator(z.object({ recordId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await db.delete(medicalRecords).where(eq(medicalRecords.id, data.recordId));
    return { success: true };
  });
