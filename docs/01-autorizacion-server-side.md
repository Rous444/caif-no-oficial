# Plan 01 — Autorización server-side + hardening de endpoints

> **Leé primero [`00-RELEVAMIENTO.md`](00-RELEVAMIENTO.md).** Este plan resuelve **C1** y **C2** (críticos).
> Autocontenido. No requiere ningún otro plan.

## Objetivo

Que ninguna operación sensible pueda ejecutarse sin sesión válida y rol adecuado. Hoy **toda** la API (`src/lib/api/*`) y los endpoints `/api/whatsapp/*` son públicos: cualquiera con `curl` resetea contraseñas, lee/borra fichas médicas y dumpea datos de pacientes.

## Restricciones confirmadas (leer antes de empezar)

Este plan es sobre **autorización** (verificar sesión/rol en el servidor), **NO** sobre endurecer el login. Decisiones del cliente (§4.6 del relevamiento):

- **NO agregar** verificación de email, confirmación de cuenta, 2FA ni ninguna fricción de login/registro. El email no se comprueba a propósito; email + DNI son un "usuario glorificado". El público incluye adultos mayores: complicarlo los aleja.
- **La autenticación del paciente queda igual que hoy.**
- Las cuentas de **paciente son de bajo riesgo** (solo sacan turnos). No son la prioridad de este plan.
- **Dónde está el valor real** (priorizar en este orden): (1) funciones de **admin** (`resetUserPassword`, `deleteUser`, alta de usuarios); (2) **fichas médicas** (datos de salud); (3) endpoints **`/api/whatsapp/*`** (secuestro del número de la clínica); (4) evitar que un paciente lea/modifique turnos o datos de **otro** paciente. Lo de patient-vs-patient es deseable pero de sensibilidad baja; no invertir esfuerzo desproporcionado ahí.
- **Sin cambios de schema** en este plan (no toca la DB — respeta el congelamiento de datos §4.7).

## Por qué

Ver §2 C1 y C2 del relevamiento. Es la exposición más grave del sistema (datos de salud + toma de control de cuentas + secuestro del WhatsApp de la clínica). Prioridad máxima junto con el Plan 02.

## Archivos afectados

- **Nuevo**: `src/lib/api/_guards.ts` (helpers de auth para server functions).
- Todos los `src/lib/api/*.functions.ts` (envolver handlers).
- [`src/start.ts`](../src/start.ts) (proteger `/api/whatsapp/*`).
- [`src/lib/auth.server.ts`](../src/lib/auth.server.ts) (verificar que expone `auth.api.getSession`).

## Diseño de la solución

### 1. Helper de sesión (server-side, desde la cookie — nunca del input)

better-auth expone `auth.api.getSession({ headers })`. En una server function de TanStack Start, obtené los headers de la request con `getWebRequest()` de `@tanstack/react-start/server`.

```ts
// src/lib/api/_guards.ts
import { getWebRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.server";

export async function requireSession() {
  const { headers } = getWebRequest();
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new AuthError("No autenticado");
  return session; // { user, session }
}

export async function requireRole(...roles: AppRole[]) {
  const s = await requireSession();
  if (!roles.includes(s.user.role)) throw new AuthError("No autorizado");
  return s;
}
```

`AuthError` debe serializar un código estable (ej. `code: "UNAUTHENTICATED" | "FORBIDDEN"`) para que el cliente pueda redirigir a `/login` (relacionado con M7 y con el Plan 07 de errores tipados — pero acá basta un `Error` con mensaje reconocible).

### 2. Derivar identidad de la sesión, no del input

Regla dura: **eliminar `userId`/`patientId` de los input validators cuando representan "el usuario actual"** y tomarlos de `requireSession()`.

- `getMyAppointments`, `getMySchedule`, `getMyDoctorProfile`, `getDoctorIdByUserId`, `updateMy*`, `getDoctorAppointments`: quitar `userId` del input; usar `session.user.id`.
- `bookAppointment` desde el dashboard del paciente: `patientId = session.user.id` (staff/médico sí pueden pasar `patientId` de otro, pero requieren rol).

### 3. Matriz de autorización por función

| Función | Regla |
|---------|-------|
| `getMyAppointments` | sesión; `patientId = session.user.id` |
| `getDoctorAppointments`, `getMySchedule`, `updateMySchedule`, `updateMy*`, `getMyDoctorProfile` | rol `medico`; doctor derivado de la sesión |
| `getStaffAppointments`, `searchPatients`, `createPatientByStaff` | rol `recepcionista` o `admin` |
| `bookAppointment` | sesión; si `patientId ≠ session.user.id` ⇒ requiere `recepcionista`/`medico`/`admin` |
| `cancelAppointment` | dueño del turno **o** staff |
| `rescheduleAppointment`, `updateAppointmentStatus` | `medico` dueño del turno, `recepcionista` o `admin` |
| `getRecordFile`, `getMyPatientRecords`, `uploadMedicalRecord`, `deleteMedicalRecord` | rol `medico` **y** chequeo de pertenencia (`medicalRecords.doctorId` == doctor de la sesión) |
| `createDoctorAccount`, `createRecepcionistaAccount`, `getUsers`, `resetUserPassword`, `updateUserActive`, `deleteUser` | rol `admin` |
| `getActiveSpecialties`, `getAllSpecialties`, `getDoctorsBySpecialty` | público OK (datos de catálogo) |

**Chequeo de pertenencia** en `getRecordFile`/`deleteMedicalRecord`: hoy solo reciben `recordId`. Cargar el record, resolver el `doctorId` de la sesión y comparar antes de devolver/borrar.

### 4. Endpoints `/api/whatsapp/*` ([`start.ts`](../src/start.ts))

Envolver el bloque `authApiMiddleware` (excepto `/api/auth/*`) con un chequeo de rol admin usando `auth.api.getSession({ headers: request.headers })`. Si no es admin → `401`. Cubre `status`, `init`, `restart`, `qr-image`, `send-test`.

## Pasos de implementación

1. Crear `_guards.ts` con `requireSession`/`requireRole`/`AuthError`. Verificar el import correcto de `getWebRequest` para la versión de TanStack Start instalada.
2. Confirmar que `auth.api.getSession` funciona server-side con los headers (test manual con una cookie válida).
3. Aplicar guards función por función según la matriz. Ir por archivo, empezando por `admin-users.functions.ts` (el más peligroso: `resetUserPassword`).
4. Quitar los `userId` redundantes de inputs y de las llamadas en los componentes (`dashboard.tsx`, `doctor.tsx`, `staff.tsx`). **Ojo**: esto toca el cliente; hacerlo función por función y probar cada pantalla.
5. Proteger `/api/whatsapp/*` en `start.ts`.
6. En el cliente, mapear `AuthError` (código `UNAUTHENTICATED`) a `signOut()` + redirect a `/login`.

## Consideraciones de despliegue

- Cambio **aditivo** en el server; el riesgo es romper una llamada del cliente que dependía de pasar `userId`. Probar los 4 paneles (paciente, médico, recepción, admin) antes de deployar.
- Deploy en ventana 21:00–08:00 ARG.
- No hay migración de DB.

## Criterios de aceptación

- `curl -X POST .../resetUserPassword` sin cookie ⇒ 401/error de auth.
- `curl .../api/whatsapp/qr-image` sin sesión admin ⇒ 401.
- Un paciente autenticado no puede leer la ficha médica ni los turnos de otro (probar cambiando ids en el payload).
- Los 4 flujos felices siguen funcionando logueado con el rol correcto.

## Riesgos y rollback

- **Riesgo**: romper una pantalla por quitar `userId`. Mitigación: incremental por función; feature no atómica.
- **Rollback**: revertir el commit; no hay estado persistente afectado.

## Qué NO tocar

- La lógica de turnos/estados (Plan 03) y de slots (Plan 06). Este plan solo agrega la capa de autorización.
