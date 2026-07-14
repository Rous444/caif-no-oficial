import { db } from "@/db";
import { whatsappLog } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Registro de intentos de envío del turnero (Plan 02, P1). Toda la escritura/lectura
// es tolerante a fallos: un problema de logging NUNCA debe tumbar el envío en sí.

export type TurneroLogEntry = {
  doctorId: string;
  targetDate: string; // YYYY-MM-DD (ARG), de getArgentinaTomorrowISO()
  status: "sent" | "failed";
  error?: string | null;
};

export async function logTurneroAttempt(entry: TurneroLogEntry): Promise<void> {
  try {
    await db.insert(whatsappLog).values({
      doctorId: entry.doctorId,
      targetDate: entry.targetDate,
      status: entry.status,
      error: entry.error ?? null,
    });
  } catch (err) {
    console.error("[whatsapp-log] No se pudo registrar el intento:", err);
  }
}

// IDs de médicos que ya recibieron el turnero con éxito para esa fecha.
// El reintento de las 21:15 los saltea para no mandar duplicados.
export async function getSentDoctorIds(targetDate: string): Promise<Set<string>> {
  try {
    const rows = await db
      .select({ doctorId: whatsappLog.doctorId })
      .from(whatsappLog)
      .where(and(eq(whatsappLog.targetDate, targetDate), eq(whatsappLog.status, "sent")));
    return new Set(rows.map((r) => r.doctorId).filter((id): id is string => id != null));
  } catch (err) {
    console.error("[whatsapp-log] No se pudieron leer los envíos previos:", err);
    return new Set();
  }
}
