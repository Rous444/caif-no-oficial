# Phase 4: UI Components

**Goal**: Build all dashboard pages and update existing UI to work with new auth system.

**Estimated time**: 5-6 hours

**Depends on**: [Phase 3](./03-server-functions.md)

## Tasks

### 4.1 Remove Supabase Integration

**Delete these directories**:

```
src/integrations/supabase/
src/integrations/lovable/
```

**Update imports** in all files that reference:

- `@/integrations/supabase/client` → remove or replace with `@/db`
- `@/integrations/supabase/types` → remove (Drizzle handles types)
- `@/integrations/lovable` → remove

### 4.2 Doctor Dashboard Layout

Create `src/components/layout/DoctorDashboardLayout.tsx`:

```typescript
import { Link } from "@tanstack/react-router";
import { Activity, LogOut, Calendar, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getMySchedule } from "@/lib/api/doctor-schedule.functions";

interface DoctorDashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function DoctorDashboardLayout({ children, title, description }: DoctorDashboardLayoutProps) {
  const { user, signOut } = useAuth();

  const { data: schedule } = useQuery({
    queryKey: ["doctor-schedule", user?.id],
    enabled: !!user,
    queryFn: () => getMySchedule({ data: { userId: user!.id } }),
  });

  const hasSchedule = schedule && schedule.length > 0;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </span>
            <span className="font-display text-lg">MediCare</span>
          </Link>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Dr. {user.lastName}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Schedule completion banner */}
      {!hasSchedule && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800">
              <strong>Importante:</strong> Debes configurar tu horario disponible para que los pacientes puedan agendar turnos.
            </p>
            <Link to="/doctor" search={{ tab: "schedule" }}>
              <Button size="sm" variant="outline" className="border-amber-300">
                <Calendar className="mr-2 h-4 w-4" /> Configurar horario
              </Button>
            </Link>
          </div>
        </div>
      )}

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl text-foreground">{title}</h1>
            {description && <p className="mt-1 text-muted-foreground">{description}</p>}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
```

### 4.3 Doctor Dashboard Route

Create `src/routes/doctor.tsx`:

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Users, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { DoctorDashboardLayout } from "@/components/layout/DoctorDashboardLayout";
import { getDoctorAppointments } from "@/lib/api/appointments.functions";
import { getMySchedule, updateMySchedule } from "@/lib/api/doctor-schedule.functions";

export const Route = createFileRoute("/doctor")({
  head: () => ({ meta: [{ title: "Panel del Médico · MediCare" }] }),
  component: DoctorDashboard,
});

function DoctorDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("appointments");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <DoctorDashboardLayout
      title="Panel del Médico"
      description="Gestioná tus turnos y horarios"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="appointments" className="gap-2">
            <Calendar className="h-4 w-4" /> Mis Turnos
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Clock className="h-4 w-4" /> Mi Horario
          </TabsTrigger>
          <TabsTrigger value="patients" className="gap-2">
            <Users className="h-4 w-4" /> Pacientes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments">
          <AppointmentsTab userId={user.id} />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleTab userId={user.id} />
        </TabsContent>
        <TabsContent value="patients">
          <PatientsTab userId={user.id} />
        </TabsContent>
      </Tabs>
    </DoctorDashboardLayout>
  );
}

function AppointmentsTab({ userId }: { userId: string }) {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["doctor-appointments", userId],
    queryFn: () => getDoctorAppointments({ data: { userId } }),
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Cargando turnos...</div>;

  const upcoming = appointments?.filter(
    (a) => new Date(a.scheduledAt) > new Date() && a.status !== "cancelado"
  ) ?? [];

  const past = appointments?.filter(
    (a) => new Date(a.scheduledAt) <= new Date() || a.status === "cancelado"
  ) ?? [];

  return (
    <div className="mt-6 space-y-8">
      <section>
        <h2 className="font-display text-2xl text-foreground">Próximos turnos</h2>
        <div className="mt-4 space-y-3">
          {upcoming.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
              No tenés turnos próximos.
            </div>
          )}
          {upcoming.map((a) => (
            <AppointmentRow key={a.id} appointment={a} />
          ))}
        </div>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="font-display text-2xl text-foreground">Historial</h2>
          <div className="mt-4 space-y-3">
            {past.map((a) => (
              <AppointmentRow key={a.id} appointment={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: any }) {
  const date = new Date(appointment.scheduledAt);
  const statusColors: Record<string, string> = {
    pendiente: "bg-amber-100 text-amber-800",
    confirmado: "bg-teal-100 text-teal-800",
    cancelado: "bg-red-100 text-red-800",
    completado: "bg-green-100 text-green-800",
    ausente: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium text-foreground">
            {appointment.patient?.firstName} {appointment.patient?.lastName}
          </div>
          <div className="text-sm text-muted-foreground">
            {date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusColors[appointment.status]}`}>
          {appointment.status}
        </span>
      </div>
    </div>
  );
}

function ScheduleTab({ userId }: { userId: string }) {
  const { data: schedule, isLoading } = useQuery({
    queryKey: ["doctor-schedule", userId],
    queryFn: () => getMySchedule({ data: { userId } }),
  });

  const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Cargando horario...</div>;

  return (
    <div className="mt-6">
      <p className="text-muted-foreground mb-4">
        Configurá los horarios en los que atendés. Los pacientes podrán agendar turnos dentro de estos horarios.
      </p>
      {/* Schedule editor component would go here */}
      <div className="rounded-2xl border border-border bg-background p-6">
        <p className="text-sm text-muted-foreground">
          Editor de horarios - implementar con time pickers para cada día de la semana.
        </p>
      </div>
    </div>
  );
}

function PatientsTab({ userId }: { userId: string }) {
  return (
    <div className="mt-6">
      <p className="text-muted-foreground">
        Lista de pacientes con turnos próximos - implementar.
      </p>
    </div>
  );
}
```

### 4.4 Recepcionista Dashboard Route

Create `src/routes/recepcionista.tsx`:

Similar to admin but without:

- Cannot create doctor accounts
- Cannot create recepcionista accounts

Can manage:

- Specialties (CRUD)
- Doctors (view/edit schedules)
- Appointments (view/manage)
- Patient lookup

### 4.5 Enhanced Admin Page

Rewrite `src/routes/admin.tsx`:

Tabs:

- **Usuarios**: Full user management with search, filter by role
- **Especialidades**: Same as current (CRUD)
- **Médicos**: Enhanced with user account linking
- **Galería**: Same as current

Key features:

- Search bar with debounce
- Filter by role (paciente, medico, recepcionista, admin)
- User cards showing: name, email, role, status, must_change_password indicator
- "Crear Usuario" dialog with toggle: Doctor / Recepcionista
- Action buttons: Edit role, Deactivate, Delete

### 4.6 Updated Patient Dashboard

Rewrite `src/routes/dashboard.tsx`:

- Remove all Supabase imports
- Use `authClient` for session
- Use server functions for data fetching
- Add conditional links:
  - "Panel de Médico" (if has medico role)
  - "Panel de Recepcionista" (if has recepcionista role)
  - "Panel de Admin" (if has admin role)

### 4.7 Updated Login Page

Rewrite `src/routes/login.tsx`:

- Use `authClient.signIn.email()` instead of Supabase
- After successful login, check `user.mustChangePassword`
- If true, redirect to `/change-password`
- If false, redirect based on role

### 4.8 Updated Register Page

Rewrite `src/routes/register.tsx`:

Fields:

- firstName (Nombre) — required
- middleName (Segundo nombre) — optional
- lastName (Apellido) — required
- email (Email) — required
- phone (Teléfono) — required
- documentNumber (DNI) — required
- password (Contraseña) — required, min 8 chars

### 4.9 Update Root Layout

Modify `src/routes/__root.tsx`:

- Import `AuthProvider` from `@/lib/auth` (new version)
- Wrap app with `PasswordChangeGuard`
- Remove any Supabase-related imports

### 4.10 Update SiteHeader

Modify `src/components/layout/SiteHeader.tsx`:

- Add navigation links based on user role
- Show user name and role
- Add sign out button

### 4.11 Update SiteFooter

Modify `src/components/layout/SiteFooter.tsx`:

- Remove any Supabase references
- Update copyright year

## Verification Checklist

- [ ] Login page works with better-auth
- [ ] Register page creates new patient account
- [ ] Password change page works and blocks until changed
- [ ] Patient dashboard shows appointments and role-based links
- [ ] Doctor dashboard shows appointments, schedule, patients
- [ ] Recepcionista dashboard shows admin-like interface
- [ ] Admin dashboard shows enhanced user management
- [ ] All pages use server functions instead of Supabase client
- [ ] Role-based routing works correctly
- [ ] No Supabase imports remain in codebase
