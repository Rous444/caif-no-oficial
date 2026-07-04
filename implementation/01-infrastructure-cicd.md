# Phase 1: Infrastructure & CI/CD

**Goal**: Set up local PostgreSQL, Drizzle ORM, CI/CD pipeline, and test runner scripts.

**Estimated time**: 2-3 hours

## Tasks

### 1.1 Docker Compose

Create `docker-compose.yml` at project root:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: medicare
      POSTGRES_USER: medicare
      POSTGRES_PASSWORD: medicare_local
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Verify**: `docker compose up -d` starts PostgreSQL on port 5432.

### 1.2 Install Dependencies

**Remove Supabase**:

```bash
bun remove @supabase/supabase-js @lovable.dev/cloud-auth-js
```

**Add new dependencies**:

```bash
bun add drizzle-orm postgres better-auth bcryptjs nodemailer
bun add -D drizzle-kit @types/bcryptjs @types/nodemailer
bun add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

### 1.3 Environment Variables

Update `.env`:

```env
# Database (local Docker)
DATABASE_URL=postgresql://medicare:medicare_local@localhost:5432/medicare

# Auth
BETTER_AUTH_SECRET=<generate-64-char-random-string>
BETTER_AUTH_URL=http://localhost:3000

# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=MediCare <your-email@gmail.com>

# Default passwords
DEFAULT_DOCTOR_PASSWORD=MediCare2026!
DEFAULT_ADMIN_PASSWORD=AdminMediCare2026!
```

Generate `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 48
```

### 1.4 Drizzle Configuration

Create `drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### 1.5 Database Schema

Create `src/db/schema.ts`:

```typescript
import { pgTable, text, uuid, boolean, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  role: text("role", {
    enum: ["paciente", "medico", "recepcionista", "admin"],
  }).notNull(),
  mustChangePassword: boolean("must_change_password").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
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

export const doctors = pgTable("doctors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  specialtyId: uuid("specialty_id")
    .notNull()
    .references(() => specialties.id),
  licenseNumber: text("license_number"),
  bio: text("bio"),
  slotMinutes: integer("slot_minutes").default(30),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const doctorSchedules = pgTable("doctor_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctors.id, {
      onDelete: "cascade",
    }),
  weekday: integer("weekday").notNull(), // 0=Sunday, 6=Saturday
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(), // "17:00"
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => users.id),
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

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const galleryImages = pgTable("gallery_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  title: text("title"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").default("info"),
  isRead: boolean("is_read").default(false),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 1.6 Database Client

Create `src/db/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

### 1.7 Push Schema to Database

```bash
bun run db:push
```

**Verify**: Tables created in PostgreSQL:

```bash
docker compose exec postgres psql -U medicare -d medicare -c "\dt"
```

### 1.8 Update package.json Scripts

```json
{
  "scripts": {
    "dev": "bun run docker:up && vite dev",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

### 1.9 Vitest Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `src/test/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

### 1.10 CI/CD Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: medicare_test
          POSTGRES_USER: medicare
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile

      - name: Create test directories
        run: mkdir -p test

      - name: Lint
        run: bun run lint 2>&1 | tee test/lint-results.txt
        continue-on-error: true

      - name: Type Check
        run: bunx tsc --noEmit 2>&1 | tee test/typecheck-results.txt
        continue-on-error: true

      - name: Unit Tests
        run: bun run test 2>&1 | tee test/unit-results.txt
        env:
          DATABASE_URL: postgresql://medicare:test_password@localhost:5432/medicare_test
          BETTER_AUTH_SECRET: test-secret-key-for-ci-only-32-chars!!
          BETTER_AUTH_URL: http://localhost:3000
        continue-on-error: true

      - name: Build
        run: bun run build 2>&1 | tee test/build-results.txt
        continue-on-error: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test/
```

### 1.11 Test Runner Scripts

Create `run-tests.sh`:

```bash
#!/bin/bash
set -e

mkdir -p test

echo "========================================="
echo "  MediCare Test Runner"
echo "  $(date)"
echo "========================================="
echo ""

echo "[1/4] Lint..."
echo "=== Lint Results ===" > test/lint-results.txt
echo "Date: $(date)" >> test/lint-results.txt
echo "" >> test/lint-results.txt
bun run lint 2>&1 | tee -a test/lint-results.txt
echo "" >> test/lint-results.txt
echo "Exit code: $?" >> test/lint-results.txt
echo ""

echo "[2/4] Type Check..."
echo "=== Type Check Results ===" > test/typecheck-results.txt
echo "Date: $(date)" >> test/typecheck-results.txt
echo "" >> test/typecheck-results.txt
bunx tsc --noEmit 2>&1 | tee -a test/typecheck-results.txt
echo "" >> test/typecheck-results.txt
echo "Exit code: $?" >> test/typecheck-results.txt
echo ""

echo "[3/4] Unit Tests..."
echo "=== Unit Test Results ===" > test/unit-results.txt
echo "Date: $(date)" >> test/unit-results.txt
echo "" >> test/unit-results.txt
bun run test 2>&1 | tee -a test/unit-results.txt
echo "" >> test/unit-results.txt
echo "Exit code: $?" >> test/unit-results.txt
echo ""

echo "[4/4] Build..."
echo "=== Build Results ===" > test/build-results.txt
echo "Date: $(date)" >> test/build-results.txt
echo "" >> test/build-results.txt
bun run build 2>&1 | tee -a test/build-results.txt
echo "" >> test/build-results.txt
echo "Exit code: $?" >> test/build-results.txt
echo ""

echo "========================================="
echo "  All tests completed!"
echo "  Results saved to test/ directory"
echo "========================================="
```

Create `run-tests.bat`:

```batch
@echo off
if not exist test mkdir test

echo =========================================
echo   MediCare Test Runner
echo   %date% %time%
echo =========================================
echo.

echo [1/4] Lint...
echo === Lint Results === > test\lint-results.txt
echo Date: %date% %time% >> test\lint-results.txt
echo. >> test\lint-results.txt
bun run lint 2>&1 >> test\lint-results.txt
echo. >> test\lint-results.txt
echo.

echo [2/4] Type Check...
echo === Type Check Results === > test\typecheck-results.txt
echo Date: %date% %time% >> test\typecheck-results.txt
echo. >> test\typecheck-results.txt
bunx tsc --noEmit 2>&1 >> test\typecheck-results.txt
echo. >> test\typecheck-results.txt
echo.

echo [3/4] Unit Tests...
echo === Unit Test Results === > test\unit-results.txt
echo Date: %date% %time% >> test\unit-results.txt
echo. >> test\unit-results.txt
bun run test 2>&1 >> test\unit-results.txt
echo. >> test\unit-results.txt
echo.

echo [4/4] Build...
echo === Build Results === > test\build-results.txt
echo Date: %date% %time% >> test\build-results.txt
echo. >> test\build-results.txt
bun run build 2>&1 >> test\build-results.txt
echo. >> test\build-results.txt
echo.

echo =========================================
echo   All tests completed!
echo   Results saved to test\ directory
echo =========================================
```

### 1.12 Seed Initial Data

Create `src/db/seed.ts`:

```typescript
import { db } from "./index";
import { specialties } from "./schema";

async function seed() {
  console.log("Seeding specialties...");

  await db.insert(specialties).values([
    {
      name: "Clínica Médica",
      description: "Atención integral del adulto",
      icon: "Stethoscope",
      sortOrder: 1,
    },
    { name: "Pediatría", description: "Salud infantil y adolescente", icon: "Baby", sortOrder: 2 },
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
  ]);

  console.log("Seeding complete!");
}

seed().catch(console.error);
```

Add seed script to `package.json`:

```json
"db:seed": "bun run src/db/seed.ts"
```

## Verification Checklist

- [ ] `docker compose up -d` starts PostgreSQL
- [ ] `bun run db:push` creates all tables
- [ ] `bun run db:seed` inserts specialties
- [ ] `bun run lint` passes
- [ ] `bunx tsc --noEmit` passes
- [ ] `bun run test` runs (even if no tests yet)
- [ ] `bun run build` succeeds
- [ ] `.github/workflows/ci.yml` syntax is valid
- [ ] `run-tests.sh` and `run-tests.bat` execute without errors
