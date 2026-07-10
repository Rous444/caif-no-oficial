import { eq } from "drizzle-orm";
import { db } from "./index";
import { user, account, specialties } from "./schema";
import { hashPassword, getAdminDefaultPassword } from "../lib/password";

async function seed() {
  console.log("Seeding specialties...");

  await db
    .insert(specialties)
    .values([
      {
        name: "Clínica Médica",
        description: "Atención integral del adulto",
        icon: "Stethoscope",
        sortOrder: 1,
      },
      {
        name: "Pediatría",
        description: "Salud infantil y adolescente",
        icon: "Baby",
        sortOrder: 2,
      },
      {
        name: "Cardiología",
        description: "Salud del corazón y sistema circulatorio",
        icon: "Heart",
        sortOrder: 3,
      },
      { name: "Dermatología", description: "Salud de la piel", icon: "Sparkles", sortOrder: 4 },
      { name: "Ginecología", description: "Salud de la mujer", icon: "Flower2", sortOrder: 5 },
      {
        name: "Traumatología",
        description: "Huesos, articulaciones y músculos",
        icon: "Bone",
        sortOrder: 6,
      },
      { name: "Neurología", description: "Sistema nervioso", icon: "Brain", sortOrder: 7 },
      { name: "Oftalmología", description: "Salud visual", icon: "Eye", sortOrder: 8 },
    ])
    .onConflictDoNothing();

  console.log("Seeding admin user...");

  const adminEmail = "admin@medicare.com";
  const existingAdmin = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, adminEmail))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log(`  Admin user already exists (${adminEmail}) — skipping`);
  } else {
    const adminPassword = getAdminDefaultPassword();
    const passwordHash = await hashPassword(adminPassword);
    const now = new Date();
    const adminId = crypto.randomUUID();

    await db.insert(user).values({
      id: adminId,
      email: adminEmail,
      emailVerified: true,
      name: "Admin MediCare",
      createdAt: now,
      updatedAt: now,
      firstName: "Admin",
      lastName: "MediCare",
      phone: "0000000000",
      role: "admin",
      mustChangePassword: true,
      isActive: true,
    });

    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: adminId,
      accountId: adminId,
      providerId: "credential",
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`  Admin user created: ${adminEmail} / ${adminPassword}`);
  }

  console.log("Seeding complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
