import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { sendWelcomeEmail } from "@/lib/email";
import { db } from "@/db";
import { user, account, patients, doctors, doctorSpecialties, appointments } from "@/db/schema";
import { eq, and, or, ilike } from "drizzle-orm";
import { getUserByEmail, getAllUsers } from "./db-helpers";
import { requireSession, requireRole, AuthError } from "./_guards";

const createDoctorSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Apellido requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(1, "Teléfono requerido"),
  specialtyIds: z.array(z.string().uuid()).min(1, "Al menos una especialidad requerida"),
  licenseNumber: z.string().optional(),
  insuranceCompanies: z.array(z.string()).optional(),
});

const createRecepcionistaSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Apellido requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(1, "Teléfono requerido"),
});

export const createDoctorAccount = createServerFn({ method: "POST" })
  .inputValidator(createDoctorSchema)
  .handler(async ({ data }) => {
    await requireRole("admin");
    const existing = await getUserByEmail(data.email);
    if (existing) {
      throw new Error("Ya existe un usuario con este email");
    }

    const defaultPassword = process.env.DEFAULT_DOCTOR_PASSWORD || "MediCare2026!";
    const passwordHash = await hashPassword(defaultPassword);

    const userId = crypto.randomUUID();
    const normalizedEmail = data.email.toLowerCase();
    const [newUser] = await db
      .insert(user)
      .values({
        id: userId,
        email: normalizedEmail,
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        phone: data.phone,
        role: "medico",
        mustChangePassword: true,
        isActive: true,
        name: `${data.firstName} ${data.lastName}`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: newUser.id,
      accountId: normalizedEmail,
      providerId: "credential",
      password: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [newDoctor] = await db
      .insert(doctors)
      .values({
        userId: newUser.id,
        licenseNumber: data.licenseNumber || null,
        insuranceCompanies: data.insuranceCompanies || null,
      })
      .returning();

    if (data.specialtyIds.length > 0) {
      await db.insert(doctorSpecialties).values(
        data.specialtyIds.map((specialtyId) => ({
          doctorId: newDoctor.id,
          specialtyId,
        })),
      );
    }

    sendWelcomeEmail(data.email, data.firstName, defaultPassword).catch(console.error);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
      },
      temporaryPassword: defaultPassword,
    };
  });

export const createRecepcionistaAccount = createServerFn({ method: "POST" })
  .inputValidator(createRecepcionistaSchema)
  .handler(async ({ data }) => {
    await requireRole("admin");
    const existing = await getUserByEmail(data.email);
    if (existing) {
      throw new Error("Ya existe un usuario con este email");
    }

    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "AdminMediCare2026!";
    const passwordHash = await hashPassword(defaultPassword);

    const userId = crypto.randomUUID();
    const normalizedEmail = data.email.toLowerCase();
    const [newUser] = await db
      .insert(user)
      .values({
        id: userId,
        email: normalizedEmail,
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        phone: data.phone,
        role: "recepcionista",
        mustChangePassword: true,
        isActive: true,
        name: `${data.firstName} ${data.lastName}`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: newUser.id,
      accountId: normalizedEmail,
      providerId: "credential",
      password: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    sendWelcomeEmail(data.email, data.firstName, defaultPassword).catch(console.error);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
      },
      temporaryPassword: defaultPassword,
    };
  });

export const getUsers = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      search: z.string().optional(),
      role: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin");
    return getAllUsers(data);
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string(),
      newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin");
    const passwordHash = await hashPassword(data.newPassword);
    await db
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(and(eq(account.userId, data.userId), eq(account.providerId, "credential")));
    await db
      .update(user)
      .set({ mustChangePassword: true, updatedAt: new Date() })
      .where(eq(user.id, data.userId));
    return { success: true };
  });

export const updateUserActive = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("admin");

    if (!data.isActive) {
      const target = await db.query.user.findFirst({
        where: eq(user.id, data.userId),
        columns: { role: true },
      });
      if (target?.role === "admin") {
        throw new Error("No se puede desactivar un usuario administrador");
      }
    }

    await db
      .update(user)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(user.id, data.userId));

    return { success: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string(), confirmName: z.string() }))
  .handler(async ({ data }) => {
    await requireRole("admin");
    const target = await db.query.user.findFirst({
      where: eq(user.id, data.userId),
      columns: { role: true, firstName: true, lastName: true },
    });
    if (!target) throw new Error("Usuario no encontrado");
    if (target.role === "admin") throw new Error("No se puede eliminar un usuario administrador");

    const expectedName = `${target.firstName} ${target.lastName}`.trim();
    if (data.confirmName.trim() !== expectedName) {
      throw new Error("El nombre ingresado no coincide. No se eliminó el usuario.");
    }

    const hasAppointmentsAsPatient = await db.query.appointments.findFirst({
      where: eq(appointments.patientId, data.userId),
      columns: { id: true },
    });

    let hasAppointmentsAsDoctor = false;
    if (target.role === "medico") {
      const doctor = await db.query.doctors.findFirst({
        where: eq(doctors.userId, data.userId),
        columns: { id: true },
      });
      if (doctor) {
        const doctorAppt = await db.query.appointments.findFirst({
          where: eq(appointments.doctorId, doctor.id),
          columns: { id: true },
        });
        hasAppointmentsAsDoctor = !!doctorAppt;
      }
    }

    if (hasAppointmentsAsPatient || hasAppointmentsAsDoctor) {
      // Tiene turnos asociados: se desactiva en vez de borrar para no perder el historial ni violar FKs.
      await db
        .update(user)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(user.id, data.userId));
      return { success: true, softDeleted: true };
    }

    await db.delete(user).where(eq(user.id, data.userId));
    return { success: true, softDeleted: false };
  });

export const createPatientRecord = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string(),
      documentNumber: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const session = await requireSession();
    const isOwnAccount = session.user.email.toLowerCase() === data.email.toLowerCase();
    if (!isOwnAccount && session.user.role !== "admin") {
      throw new AuthError("FORBIDDEN", "No autorizado");
    }
    const found = await getUserByEmail(data.email);
    if (!found) throw new Error("Usuario no encontrado");
    const existing = await db.query.patients.findFirst({
      where: eq(patients.documentNumber, data.documentNumber),
    });
    if (existing) return { success: true };
    await db.insert(patients).values({
      userId: found.id,
      documentNumber: data.documentNumber,
    });
    return { success: true };
  });

export const searchPatients = createServerFn({ method: "POST" })
  .inputValidator(z.object({ search: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireRole("recepcionista", "admin", "medico");
    const term = `%${data.search}%`;
    const rows = await db
      .select({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        documentNumber: patients.documentNumber,
      })
      .from(user)
      .leftJoin(patients, eq(patients.userId, user.id))
      .where(
        and(
          eq(user.role, "paciente"),
          or(
            ilike(user.firstName, term),
            ilike(user.lastName, term),
            ilike(user.email, term),
            ilike(patients.documentNumber, term),
          ),
        ),
      )
      .limit(20);
    return rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      documentNumber: r.documentNumber ?? null,
    }));
  });

export const createPatientByStaff = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      firstName: z.string().min(1, "Nombre requerido"),
      lastName: z.string().min(1, "Apellido requerido"),
      email: z.string().email("Email inválido"),
      phone: z.string().min(1, "Teléfono requerido"),
      documentNumber: z.string().min(1, "DNI requerido"),
    }),
  )
  .handler(async ({ data }) => {
    await requireRole("recepcionista", "admin");
    const existing = await getUserByEmail(data.email);
    if (existing) {
      throw new Error("Ya existe un usuario con este email");
    }

    const existingDni = await db.query.patients.findFirst({
      where: eq(patients.documentNumber, data.documentNumber),
    });
    if (existingDni) {
      throw new Error("Ya existe un paciente con este DNI");
    }

    const defaultPassword = process.env.DEFAULT_DOCTOR_PASSWORD || "MediCare2026!";
    const passwordHash = await hashPassword(defaultPassword);

    const normalizedEmail = data.email.toLowerCase();
    const userId = crypto.randomUUID();
    const [newUser] = await db
      .insert(user)
      .values({
        id: userId,
        email: normalizedEmail,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: "paciente",
        name: `${data.firstName} ${data.lastName}`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: newUser.id,
      accountId: normalizedEmail,
      providerId: "credential",
      password: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(patients).values({
      userId: newUser.id,
      documentNumber: data.documentNumber,
    });

    return {
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      phone: newUser.phone,
    };
  });
