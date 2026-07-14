import {
  pgTable,
  text,
  uuid,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  role: text("role", {
    enum: ["paciente", "medico", "recepcionista", "admin"],
  })
    .notNull()
    .default("paciente"),
  mustChangePassword: boolean("must_change_password").default(false),
  isActive: boolean("is_active").default(true),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentNumber: text("document_number").notNull(),
    birthDate: timestamp("birth_date"),
  },
  (t) => [uniqueIndex("patients_dni_idx").on(t.documentNumber)],
);

export const specialties = pgTable("specialties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const doctorSpecialties = pgTable(
  "doctor_specialties",
  {
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    specialtyId: uuid("specialty_id")
      .notNull()
      .references(() => specialties.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("doctor_specialty_idx").on(t.doctorId, t.specialtyId)],
);

export const doctors = pgTable("doctors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  specialtyId: uuid("specialty_id").references(() => specialties.id),
  licenseNumber: text("license_number"),
  bio: text("bio"),
  slotMinutes: integer("slot_minutes").default(30),
  insuranceCompanies: text("insurance_companies").array(),
  isActive: boolean("is_active").default(true),
  whatsappNotifications: boolean("whatsapp_notifications").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const doctorSchedules = pgTable("doctor_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctors.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: text("patient_id")
    .notNull()
    .references(() => user.id),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctors.id),
  specialtyId: uuid("specialty_id")
    .notNull()
    .references(() => specialties.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").default(30),
  status: text("status", {
    enum: ["pendiente", "confirmado", "cancelado", "completado", "ausente"],
  }).default("pendiente"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const galleryImages = pgTable("gallery_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url"),
  title: text("title"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  imageType: text("image_type").default("url"),
  fileData: text("file_data"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const medicalRecords = pgTable("medical_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctors.id, { onDelete: "cascade" }),
  patientId: text("patient_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull().default("application/pdf"),
  fileData: text("file_data").notNull(),
  fileSize: integer("file_size").notNull(),
  recordVersion: integer("record_version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Registro de envíos del turnero por WhatsApp (Plan 02, P1). Append-only:
// `doctorId` es un uuid SIN foreign key a propósito, para que el log sobreviva
// a un eventual borrado del médico y para que el cambio de schema sea puramente
// aditivo (una tabla nueva, sin tocar ni referenciar tablas existentes).
export const whatsappLog = pgTable("whatsapp_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id"),
  targetDate: text("target_date").notNull(), // fecha del turnero (YYYY-MM-DD, ARG)
  status: text("status", { enum: ["sent", "failed"] }).notNull(),
  error: text("error"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").default("info"),
  isRead: boolean("is_read").default(false),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  specialty: one(specialties, { fields: [doctors.specialtyId], references: [specialties.id] }),
  user: one(user, { fields: [doctors.userId], references: [user.id] }),
  specialties: many(doctorSpecialties),
  schedules: many(doctorSchedules),
  medicalRecords: many(medicalRecords),
}));

export const doctorSpecialtiesRelations = relations(doctorSpecialties, ({ one }) => ({
  doctor: one(doctors, { fields: [doctorSpecialties.doctorId], references: [doctors.id] }),
  specialty: one(specialties, {
    fields: [doctorSpecialties.specialtyId],
    references: [specialties.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  patients: many(patients),
  doctors: many(doctors),
  notifications: many(notifications),
  medicalRecords: many(medicalRecords),
}));

export const medicalRecordsRelations = relations(medicalRecords, ({ one }) => ({
  doctor: one(doctors, { fields: [medicalRecords.doctorId], references: [doctors.id] }),
  patient: one(user, { fields: [medicalRecords.patientId], references: [user.id] }),
}));

export const patientsRelations = relations(patients, ({ one }) => ({
  user: one(user, { fields: [patients.userId], references: [user.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(user, { fields: [appointments.patientId], references: [user.id] }),
  doctor: one(doctors, { fields: [appointments.doctorId], references: [doctors.id] }),
  specialty: one(specialties, { fields: [appointments.specialtyId], references: [specialties.id] }),
}));

export const doctorSchedulesRelations = relations(doctorSchedules, ({ one }) => ({
  doctor: one(doctors, { fields: [doctorSchedules.doctorId], references: [doctors.id] }),
}));

export const specialtiesRelations = relations(specialties, ({ many }) => ({
  doctors: many(doctorSpecialties),
}));
