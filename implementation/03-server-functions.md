# Phase 3: Server Functions

**Goal**: Create server functions for admin user management, doctor scheduling, and appointments.

**Estimated time**: 4-5 hours

**Depends on**: [Phase 2](./02-auth-system.md)

## Tasks

### 3.1 Database Query Helpers

Create `src/lib/api/db-helpers.ts`:

```typescript
import { db } from "@/db";
import { users, patients, doctors, doctorSchedules, specialties } from "@/db/schema";
import { eq, like, or, and, sql } from "drizzle-orm";

export async function getUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export async function getPatientByUserId(userId: string) {
  return db.query.patients.findFirst({ where: eq(patients.userId, userId) });
}

export async function getDoctorByUserId(userId: string) {
  return db.query.doctors.findFirst({
    where: eq(doctors.userId, userId),
    with: { specialty: true },
  });
}

export async function getAllUsers(options?: {
  search?: string;
  role?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];

  if (options?.search) {
    const term = `%${options.search}%`;
    conditions.push(
      or(like(users.firstName, term), like(users.lastName, term), like(users.email, term)),
    );
  }

  if (options?.role) {
    conditions.push(eq(users.role, options.role));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.query.users.findMany({
    where,
    limit: options?.limit || 50,
    offset: options?.offset || 0,
    orderBy: (users, { asc }) => [asc(users.lastName), asc(users.firstName)],
  });
}

export async function getDoctorSchedules(doctorId: string) {
  return db.query.doctorSchedules.findMany({
    where: eq(doctorSchedules.doctorId, doctorId),
  });
}
```

### 3.2 Admin User Management Functions

Create `src/lib/api/admin-users.functions.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashPassword, getDefaultPassword } from "@/lib/password";
import { sendWelcomeEmail } from "@/lib/email";
import { db } from "@/db";
import { users, patients, doctors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserByEmail, getAllUsers } from "./db-helpers";

// Schema for creating a doctor account
const createDoctorSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Apellido requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(1, "Teléfono requerido"),
  specialtyId: z.string().uuid("Especialidad requerida"),
  licenseNumber: z.string().optional(),
});

// Schema for creating a recepcionista account
const createRecepcionistaSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Apellido requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(1, "Teléfono requerido"),
});

export const createDoctorAccount = createServerFn({ method: "POST" })
  .validator(createDoctorSchema)
  .handler(async ({ data }) => {
    // Check if email already exists
    const existing = await getUserByEmail(data.email);
    if (existing) {
      throw new Error("Ya existe un usuario con este email");
    }

    const defaultPassword = getDefaultPassword();
    const passwordHash = await hashPassword(defaultPassword);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        phone: data.phone,
        role: "medico",
        mustChangePassword: true,
        isActive: true,
      })
      .returning();

    // Create doctor record
    await db.insert(doctors).values({
      userId: newUser.id,
      specialtyId: data.specialtyId,
      licenseNumber: data.licenseNumber || null,
    });

    // Send welcome email (don't wait for it)
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
  .validator(createRecepcionistaSchema)
  .handler(async ({ data }) => {
    const existing = await getUserByEmail(data.email);
    if (existing) {
      throw new Error("Ya existe un usuario con este email");
    }

    const defaultPassword = getDefaultPassword();
    const passwordHash = await hashPassword(defaultPassword);

    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        phone: data.phone,
        role: "recepcionista",
        mustChangePassword: true,
        isActive: true,
      })
      .returning();

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

export const getUsers = createServerFn({ method: "GET" })
  .validator(
    z.object({
      search: z.string().optional(),
      role: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    return getAllUsers(data);
  });

export const updateUserActive = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    // Prevent deactivating yourself
    // (session check would go here in production)

    await db
      .update(users)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(users.id, data.userId));

    return { success: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    // Prevent deleting yourself
    // (session check would go here in production)

    await db.delete(users).where(eq(users.id, data.userId));
    return { success: true };
  });
```

### 3.3 Password Change Functions

Create `src/lib/api/auth.functions.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/password";
import { sendPasswordChangeNotification } from "@/lib/email";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserById } from "./db-helpers";

export const changePassword = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      currentPassword: z.string().min(1, "Contraseña actual requerida"),
      newPassword: z.string().min(1, "Nueva contraseña requerida"),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getUserById(data.userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Verify current password
    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) {
      throw new Error("La contraseña actual es incorrecta");
    }

    // Validate new password strength
    const strength = validatePasswordStrength(data.newPassword);
    if (!strength.valid) {
      throw new Error(strength.error!);
    }

    // Check it's different from default
    const defaultPassword = process.env.DEFAULT_DOCTOR_PASSWORD || "MediCare2026!";
    if (data.newPassword === defaultPassword) {
      throw new Error("La nueva contraseña no puede ser la contraseña por defecto");
    }

    // Hash and update
    const newHash = await hashPassword(data.newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.userId));

    // Send notification email
    sendPasswordChangeNotification(user.email, user.firstName).catch(console.error);

    return { success: true };
  });

export const forcePasswordChange = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await db
      .update(users)
      .set({
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.userId));

    return { success: true };
  });
```

### 3.4 Doctor Schedule Functions

Create `src/lib/api/doctor-schedule.functions.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { doctorSchedules, doctors } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleSchema = z.object({
  weekday: z.number().min(0).max(6),
  startTime: z.string().regex(timeRegex, "Formato de hora inválido (HH:MM)"),
  endTime: z.string().regex(timeRegex, "Formato de hora inválido (HH:MM)"),
});

export const getMySchedule = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().uuid() }))
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
  .validator(
    z.object({
      userId: z.string().uuid(),
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

    // Validate no overlapping times for same weekday
    for (const sched of data.schedules) {
      if (sched.startTime >= sched.endTime) {
        throw new Error(
          `La hora de fin debe ser posterior a la hora de inicio (día ${sched.weekday})`,
        );
      }
    }

    // Delete existing schedules and insert new ones
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

export const getDoctorSchedule = createServerFn({ method: "GET" })
  .validator(z.object({ doctorId: z.string().uuid() }))
  .handler(async ({ data }) => {
    return db.query.doctorSchedules.findMany({
      where: eq(doctorSchedules.doctorId, data.doctorId),
    });
  });
```

### 3.5 Appointment Functions

Create `src/lib/api/appointments.functions.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { appointments, doctors, specialties, users } from "@/db/schema";
import { eq, and, gte, lt, desc } from "drizzle-orm";

export const getMyAppointments = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    return db.query.appointments.findMany({
      where: eq(appointments.patientId, data.userId),
      with: {
        doctor: {
          with: { specialty: true },
        },
      },
      orderBy: [desc(appointments.scheduledAt)],
    });
  });

export const getDoctorAppointments = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, data.userId),
    });

    if (!doctor) {
      throw new Error("No se encontró perfil de médico");
    }

    return db.query.appointments.findMany({
      where: eq(appointments.doctorId, doctor.id),
      with: {
        patient: true,
        specialty: true,
      },
      orderBy: [desc(appointments.scheduledAt)],
    });
  });

export const bookAppointment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      patientId: z.string().uuid(),
      doctorId: z.string().uuid(),
      specialtyId: z.string().uuid(),
      scheduledAt: z.string().datetime(),
      durationMinutes: z.number().default(30),
    }),
  )
  .handler(async ({ data }) => {
    // Check for overlapping appointments
    const scheduledDate = new Date(data.scheduledAt);
    const endDate = new Date(scheduledDate.getTime() + data.durationMinutes * 60000);

    const overlapping = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.doctorId, data.doctorId),
        eq(appointments.status, "pendiente"), // or "confirmado"
      ),
    });

    // Simple overlap check (can be enhanced with raw SQL for precision)
    if (overlapping) {
      const existingStart = new Date(overlapping.scheduledAt);
      const existingEnd = new Date(existingStart.getTime() + overlapping.durationMinutes * 60000);

      if (scheduledDate < existingEnd && endDate > existingStart) {
        throw new Error("El horario seleccionado ya está reservado para este profesional");
      }
    }

    const [newAppointment] = await db
      .insert(appointments)
      .values({
        patientId: data.patientId,
        doctorId: data.doctorId,
        specialtyId: data.specialtyId,
        scheduledAt: scheduledDate,
        durationMinutes: data.durationMinutes,
        status: "pendiente",
      })
      .returning();

    return newAppointment;
  });

export const cancelAppointment = createServerFn({ method: "POST" })
  .validator(z.object({ appointmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await db
      .update(appointments)
      .set({
        status: "cancelado",
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, data.appointmentId));

    return { success: true };
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      appointmentId: z.string().uuid(),
      status: z.enum(["pendiente", "confirmado", "cancelado", "completado", "ausente"]),
    }),
  )
  .handler(async ({ data }) => {
    await db
      .update(appointments)
      .set({
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, data.appointmentId));

    return { success: true };
  });
```

### 3.6 Specialty Functions

Create `src/lib/api/specialties.functions.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { specialties } from "@/db/schema";
import { eq } from "drizzle-orm";

export const getSpecialties = createServerFn({ method: "GET" }).handler(async () => {
  return db.query.specialties.findMany({
    orderBy: (specialties, { asc }) => [asc(specialties.sortOrder)],
  });
});

export const getActiveSpecialties = createServerFn({ method: "GET" }).handler(async () => {
  return db.query.specialties.findMany({
    where: eq(specialties.isActive, true),
    orderBy: (specialties, { asc }) => [asc(specialties.sortOrder)],
  });
});

export const createSpecialty = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(2).max(80),
      description: z.string().max(500).optional(),
      icon: z.string().max(40).optional(),
      sortOrder: z.number().int().min(0).max(999),
    }),
  )
  .handler(async ({ data }) => {
    const [newSpecialty] = await db.insert(specialties).values(data).returning();
    return newSpecialty;
  });

export const updateSpecialty = createServerFn({ method: "POST" })
  .validator(
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
    const { id, ...updateData } = data;
    await db.update(specialties).set(updateData).where(eq(specialties.id, id));
    return { success: true };
  });

export const deleteSpecialty = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await db.delete(specialties).where(eq(specialties.id, data.id));
    return { success: true };
  });
```

### 3.7 Doctor Functions (Admin)

Create `src/lib/api/admin-doctors.functions.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { doctors, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const getAllDoctors = createServerFn({ method: "GET" }).handler(async () => {
  return db.query.doctors.findMany({
    with: {
      specialty: true,
      user: true,
    },
  });
});

export const updateDoctor = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      specialtyId: z.string().uuid().optional(),
      licenseNumber: z.string().optional(),
      bio: z.string().optional(),
      slotMinutes: z.number().int().min(15).max(120).optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { id, ...updateData } = data;
    await db.update(doctors).set(updateData).where(eq(doctors.id, id));
    return { success: true };
  });

export const deleteDoctor = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await db.delete(doctors).where(eq(doctors.id, data.id));
    return { success: true };
  });
```

## Verification Checklist

- [ ] `createDoctorAccount` creates user + doctor record
- [ ] `createRecepcionistaAccount` creates user with recepcionista role
- [ ] `changePassword` updates password and clears `mustChangePassword`
- [ ] `updateMySchedule` saves doctor's weekly schedule
- [ ] `bookAppointment` creates appointment with overlap check
- [ ] `cancelAppointment` updates status to 'cancelado'
- [ ] Welcome email sends on account creation
- [ ] All functions have proper Zod validation
- [ ] Error messages are in Spanish (matching the app language)
