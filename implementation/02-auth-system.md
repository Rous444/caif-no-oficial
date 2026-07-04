# Phase 2: Auth System

**Goal**: Implement authentication with better-auth, including login, register, session management, and password change.

**Estimated time**: 3-4 hours

**Depends on**: [Phase 1](./01-infrastructure-cicd.md)

## Tasks

### 2.1 better-auth Configuration

Create `src/lib/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "postgresql",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    password: {
      hash: async (password) => {
        const bcrypt = await import("bcryptjs");
        return bcrypt.hash(password, 12);
      },
      verify: async ({ password, hash }) => {
        const bcrypt = await import("bcryptjs");
        return bcrypt.compare(password, hash);
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "paciente",
      },
      firstName: {
        type: "string",
        required: true,
      },
      middleName: {
        type: "string",
        required: false,
      },
      lastName: {
        type: "string",
        required: true,
      },
      phone: {
        type: "string",
        required: true,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    },
  },
  pages: {
    signIn: "/login",
    signUp: "/register",
  },
});
```

### 2.2 Auth Client (Browser)

Create `src/lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

### 2.3 Auth API Route

Create `src/routes/api/auth/$.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handler: async ({ request }) => {
      return auth.handler(request);
    },
  },
});
```

### 2.4 Password Utilities

Create `src/lib/password.ts`:

```typescript
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getDefaultPassword(): string {
  return process.env.DEFAULT_DOCTOR_PASSWORD || "MediCare2026!";
}

export function getAdminDefaultPassword(): string {
  return process.env.DEFAULT_ADMIN_PASSWORD || "AdminMediCare2026!";
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "La contraseña debe tener al menos 8 caracteres" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "La contraseña debe tener al menos una mayúscula" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "La contraseña debe tener al menos una minúscula" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "La contraseña debe tener al menos un número" };
  }
  return { valid: true };
}
```

### 2.5 Email Service (Gmail SMTP)

Add `nodemailer` dependency:

```bash
bun add nodemailer
bun add -D @types/nodemailer
```

Create `src/lib/email.ts`:

```typescript
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWelcomeEmail(email: string, firstName: string, tempPassword: string) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "MediCare - Tu cuenta ha sido creada",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f766e;">Bienvenido a MediCare</h2>
          <p>Hola ${firstName},</p>
          <p>Tu cuenta ha sido creada por el administrador.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 8px 0 0 0;"><strong>Contraseña temporal:</strong> ${tempPassword}</p>
          </div>
          <p style="color: #dc2626;"><strong>Importante:</strong> Por favor, inicia sesión y cambia tu contraseña inmediatamente.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">© ${new Date().getFullYear()} MediCare</p>
        </div>
      `,
    });
    console.log(`[Email] Welcome email sent to ${email}`);
  } catch (error) {
    console.error(`[Email] Failed to send welcome email to ${email}:`, error);
    // Don't throw - account creation should succeed even if email fails
  }
}

export async function sendPasswordChangeNotification(email: string, firstName: string) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "MediCare - Tu contraseña ha sido cambiada",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f766e;">Contraseña cambiada</h2>
          <p>Hola ${firstName},</p>
          <p>Tu contraseña ha sido cambiada exitosamente.</p>
          <p>Si no realizaste este cambio, contacta al administrador inmediatamente.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">© ${new Date().getFullYear()} MediCare</p>
        </div>
      `,
    });
  } catch (error) {
    console.error(`[Email] Failed to send password change notification to ${email}:`, error);
  }
}
```

### 2.6 Auth Provider (Client-Side)

Rewrite `src/lib/auth.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient } from "./auth-client";

export type AppRole = "paciente" | "medico" | "recepcionista" | "admin";

interface AuthContextValue {
  user: any | null;
  session: any | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    try {
      const { data } = await authClient.getSession();
      if (data) {
        setUser(data.user);
        setSession(data.session);
        setRoles([data.user.role as AppRole]);
      } else {
        setUser(null);
        setSession(null);
        setRoles([]);
      }
    } catch (error) {
      console.error("[Auth] Failed to load session:", error);
      setUser(null);
      setSession(null);
      setRoles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSession();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    roles,
    loading,
    signOut: async () => {
      await authClient.signOut();
      setUser(null);
      setSession(null);
      setRoles([]);
    },
    hasRole: (role) => roles.includes(role),
    refreshUser: loadSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

### 2.7 Login Page

Rewrite `src/routes/login.tsx`:

- Use `authClient.signIn.email()` instead of Supabase
- After successful login, check `user.mustChangePassword`
- If true, redirect to `/change-password`
- If false, redirect based on role:
  - admin → `/admin`
  - medico → `/doctor`
  - recepcionista → `/recepcionista`
  - paciente → `/dashboard`

Key implementation notes:

- Remove all Supabase imports
- Remove Google OAuth (can add later if needed)
- Add loading state during auth check
- Show error toast on failed login

### 2.8 Register Page

Rewrite `src/routes/register.tsx`:

Fields:

- firstName (Nombre) — required
- middleName (Segundo nombre) — optional
- lastName (Apellido) — required
- email (Email) — required
- phone (Teléfono) — required
- documentNumber (DNI) — required
- password (Contraseña) — required, min 8 chars

Use `authClient.signUp.email()` with user metadata.

### 2.9 Password Change Page

Create `src/routes/change-password.tsx`:

- Full-screen, not dismissible
- Form: current password, new password, confirm password
- Zod validation:
  - Current password required
  - New password min 8 chars, must have uppercase, lowercase, number
  - New password must differ from default password
  - Confirm password must match
- On success: refresh auth state, redirect based on role
- Shows warning: "Debes cambiar tu contraseña antes de continuar"
- Cannot be closed or bypassed

### 2.10 Password Change Guard

Create `src/components/PasswordChangeGuard.tsx`:

```typescript
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (user?.mustChangePassword) {
      const currentPath = window.location.pathname;
      if (currentPath !== "/change-password") {
        router.navigate({ to: "/change-password" });
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

  if (user?.mustChangePassword && window.location.pathname !== "/change-password") {
    return null;
  }

  return <>{children}</>;
}
```

### 2.11 Update Root Layout

Modify `src/routes/__root.tsx`:

- Import `AuthProvider` from `@/lib/auth` (new version)
- Wrap app with `PasswordChangeGuard`
- Remove any Supabase-related imports

### 2.12 Server Middleware

Create `src/middleware.ts`:

```typescript
import { createMiddleware } from "@tanstack/react-start";
import { auth } from "@/lib/auth";

export const requireAuth = createMiddleware().server(async ({ next }) => {
  // better-auth handles session validation via cookies
  // This middleware can be extended to attach user context
  return next();
});
```

## Verification Checklist

- [ ] `bun run db:push` creates auth tables
- [ ] Better-auth API route responds at `/api/auth/*`
- [ ] Login page renders and submits form
- [ ] Register page creates new user
- [ ] After login, `mustChangePassword` flag is checked
- [ ] Password change page works and updates password
- [ ] Role-based redirect works after login
- [ ] Session persists across page reloads
- [ ] Sign out clears session
- [ ] Welcome email sends on account creation (check console if SMTP not configured)

## API Routes (auto-generated by better-auth)

| Method | Path                        | Description          |
| ------ | --------------------------- | -------------------- |
| POST   | `/api/auth/sign-in/email`   | Email/password login |
| POST   | `/api/auth/sign-up/email`   | Register new user    |
| POST   | `/api/auth/sign-out`        | Sign out             |
| GET    | `/api/auth/get-session`     | Get current session  |
| POST   | `/api/auth/change-password` | Change password      |
