# Phase 5: Security Guards

**Goal**: Implement application-level security to replace Supabase RLS.

**Estimated time**: 1-2 hours

**Depends on**: [Phase 3](./03-server-functions.md)

## Overview

Since we're moving away from Supabase's Row Level Security (RLS), we need to implement security at the application level. This means:

1. Every server function must validate the user's session
2. Every server function must check if the user has permission for the action
3. Data access must be scoped to the user's role and ownership

## Tasks

### 5.1 Auth Middleware for Server Functions

Create `src/lib/api/middleware.ts`:

```typescript
import { createMiddleware } from "@tanstack/react-start";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, doctors, patients } from "@/db/schema";
import { eq } from "drizzle-orm";

// Extended context type
interface AuthContext {
  session: {
    user: {
      id: string;
      email: string;
      role: string;
      firstName: string;
      lastName: string;
      mustChangePassword: boolean;
    };
  } | null;
}

// Middleware: Require any authenticated user
export const requireAuth = createMiddleware().server(async ({ next }) => {
  // In production, get session from request headers/cookies
  // For now, we'll use a simplified approach
  // The actual implementation depends on better-auth's server-side session handling
  return next({
    context: {
      session: null, // Will be populated by better-auth middleware
    },
  });
});

// Middleware: Require admin role
export const requireAdmin = createMiddleware().server(async ({ next }) => {
  // Check session exists
  // Check user.role === 'admin'
  // Check user.mustChangePassword === false
  return next({
    context: {
      session: null,
    },
  });
});

// Middleware: Require doctor role
export const requireDoctor = createMiddleware().server(async ({ next }) => {
  // Check session exists
  // Check user.role === 'medico'
  return next({
    context: {
      session: null,
    },
  });
});

// Middleware: Require recepcionista role
export const requireRecepcionista = createMiddleware().server(async ({ next }) => {
  // Check session exists
  // Check user.role === 'recepcionista'
  return next({
    context: {
      session: null,
    },
  });
});

// Middleware: Require admin or recepcionista
export const requireAdminOrRecepcionista = createMiddleware().server(async ({ next }) => {
  // Check session exists
  // Check user.role === 'admin' || user.role === 'recepcionista'
  return next({
    context: {
      session: null,
    },
  });
});
```

### 5.2 Data Access Guards

Create `src/lib/api/guards.ts`:

```typescript
import { db } from "@/db";
import { doctors } from "@/db/schema";
import { eq } from "drizzle-orm";

// Check if user owns this doctor profile
export async function isDoctorOwner(userId: string, doctorId: string): Promise<boolean> {
  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.id, doctorId),
  });
  return doctor?.userId === userId;
}

// Check if user is the patient for this appointment
export async function isAppointmentPatient(
  userId: string,
  appointmentId: string,
): Promise<boolean> {
  // Query appointment and check patientId matches userId
  // Implementation depends on your appointment query
  return true; // Placeholder
}

// Check if user can access this patient's data
export async function canAccessPatientData(
  userId: string,
  userRole: string,
  patientUserId: string,
): Promise<boolean> {
  // Admin and recepcionista can access any patient
  if (userRole === "admin" || userRole === "recepcionista") {
    return true;
  }

  // Doctor can access patients with appointments to them
  if (userRole === "medico") {
    // Check if doctor has any appointments with this patient
    return true; // Placeholder - implement actual check
  }

  // Patient can only access their own data
  return userId === patientUserId;
}

// Check if user can modify this appointment
export async function canModifyAppointment(
  userId: string,
  userRole: string,
  appointmentId: string,
): Promise<boolean> {
  // Admin and recepcionista can modify any appointment
  if (userRole === "admin" || userRole === "recepcionista") {
    return true;
  }

  // Doctor can modify appointments assigned to them
  if (userRole === "medico") {
    // Check if appointment.doctorId matches user's doctor profile
    return true; // Placeholder
  }

  // Patient can only cancel their own appointments
  if (userRole === "paciente") {
    // Check if appointment.patientId === userId
    return true; // Placeholder
  }

  return false;
}
```

### 5.3 Apply Guards to Server Functions

Update each server function to include session validation:

**Example: Update `createDoctorAccount`**:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { auth } from "@/lib/auth";

export const createDoctorAccount = createServerFn({ method: "POST" })
  .validator(createDoctorSchema)
  .handler(async ({ data, headers }) => {
    // Validate session
    const session = await auth.api.getSession({ headers });
    if (!session) {
      throw new Error("No autorizado");
    }

    // Check role
    if (session.user.role !== "admin") {
      throw new Error("Solo los administradores pueden crear cuentas de médicos");
    }

    // Check password change requirement
    if (session.user.mustChangePassword) {
      throw new Error("Debes cambiar tu contraseña antes de realizar esta acción");
    }

    // ... rest of the function
  });
```

### 5.4 Client-Side Route Guards

Update `src/components/PasswordChangeGuard.tsx`:

```typescript
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

const PROTECTED_ROUTES = ["/admin", "/doctor", "/recepcionista"];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const currentPath = window.location.pathname;

    // Must change password check
    if (user?.mustChangePassword && currentPath !== "/change-password") {
      router.navigate({ to: "/change-password" });
      return;
    }

    // Role-based route protection
    if (PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
      if (!user) {
        router.navigate({ to: "/login" });
        return;
      }

      // Check specific role requirements
      if (currentPath.startsWith("/admin") && user.role !== "admin") {
        router.navigate({ to: "/dashboard" });
        return;
      }

      if (currentPath.startsWith("/doctor") && user.role !== "medico") {
        router.navigate({ to: "/dashboard" });
        return;
      }

      if (currentPath.startsWith("/recepcionista") && user.role !== "recepcionista") {
        router.navigate({ to: "/dashboard" });
        return;
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
```

### 5.5 Update Root Layout

Modify `src/routes/__root.tsx`:

```typescript
import { RouteGuard } from "@/components/PasswordChangeGuard";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouteGuard>
          <a href="#main-content" className="skip-link">
            Saltar al contenido
          </a>
          <Outlet />
          <Toaster richColors position="top-right" />
        </RouteGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### 5.6 Input Validation (Defense in Depth)

Create `src/lib/validation.ts`:

```typescript
import { z } from "zod";

// Common validation schemas
export const uuidSchema = z.string().uuid("ID inválido");

export const emailSchema = z.string().email("Email inválido");

export const phoneSchema = z.string().min(10, "Teléfono inválido");

export const nameSchema = z.string().min(1, "Nombre requerido").max(100);

export const dniSchema = z
  .string()
  .min(7, "DNI inválido")
  .max(10, "DNI inválido")
  .regex(/^\d+$/, "DNI debe ser numérico");

// Sanitize strings (trim, remove extra spaces)
export function sanitizeString(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

// Validate and sanitize before database operations
export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(firstError.message);
  }
  return result.data;
}
```

## Security Checklist

- [ ] All server functions validate session
- [ ] All server functions check user role
- [ ] Admin functions check `mustChangePassword === false`
- [ ] Data access is scoped to user's role
- [ ] Patients can only access their own data
- [ ] Doctors can only access their patients' data
- [ ] Recepcionistas can access most data (except user creation)
- [ ] Admin can access all data
- [ ] Input validation on all server functions
- [ ] SQL injection prevention (Drizzle ORM handles this)
- [ ] XSS prevention (React handles this by default)
- [ ] CSRF protection (better-auth handles this)
- [ ] Rate limiting (consider adding for auth endpoints)
- [ ] Audit logging for sensitive operations (admin actions)

## Common Vulnerabilities to Prevent

1. **Broken Access Control**: Always validate user role before data access
2. **Injection**: Use Drizzle ORM's parameterized queries (already handled)
3. **Sensitive Data Exposure**: Never return password hashes to client
4. **Broken Authentication**: Use better-auth's session management
5. **Security Misconfiguration**: Validate all environment variables
6. **Cross-Site Scripting**: React escapes by default, but sanitize user input
7. **Cross-Site Request Forgery**: better-auth handles this with CSRF tokens

## Verification Checklist

- [ ] Unauthenticated users cannot access protected routes
- [ ] Patients cannot access admin/doctor/recepcionista routes
- [ ] Doctors cannot access admin/recepcionista routes
- [ ] Recepcionistas cannot access admin routes
- [ ] Admin cannot access routes when `mustChangePassword` is true
- [ ] Server functions validate session before processing
- [ ] Server functions check role before data modification
- [ ] Input validation prevents malicious data
- [ ] Error messages don't leak sensitive information
