import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.server";
import { db } from "@/db";
import { doctors } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AppRole } from "@/lib/auth.tsx";

export class AuthError extends Error {
  code: "UNAUTHENTICATED" | "FORBIDDEN";

  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
    super(message);
    this.code = code;
  }
}

export async function requireSession() {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new AuthError("UNAUTHENTICATED", "No autenticado");
  return session;
}

export async function requireRole(...roles: AppRole[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role as AppRole)) {
    throw new AuthError("FORBIDDEN", "No autorizado");
  }
  return session;
}

export async function requireDoctor() {
  const session = await requireRole("medico");
  let doctor = await db.query.doctors.findFirst({ where: eq(doctors.userId, session.user.id) });
  if (!doctor) {
    const [created] = await db
      .insert(doctors)
      .values({ userId: session.user.id })
      .returning();
    doctor = created;
  }
  return { session, doctorId: doctor.id };
}
