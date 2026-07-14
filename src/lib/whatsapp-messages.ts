import { sendTextMessage } from "./whatsapp";

const DELAY_BETWEEN_MESSAGES = 4000; // 4 seconds between messages to avoid bans

export type DoctorTurnero = {
  doctorId: string;
  doctorName: string;
  phone: string;
  appointments: { hora: string; paciente: string }[];
};

export function formatTurneroForDoctor(
  doctorName: string,
  dateLabel: string,
  appointments: { hora: string; paciente: string }[],
): string {
  const lines: string[] = [];
  lines.push(`📋 *Turnero del ${dateLabel}*`);
  lines.push("");
  lines.push(`Dr/a. ${doctorName}`);
  lines.push("");

  if (appointments.length === 0) {
    lines.push("No tenés turnos agendados para mañana.");
  } else {
    for (const appt of appointments) {
      lines.push(`${appt.hora} - ${appt.paciente}`);
    }
  }

  lines.push("");
  lines.push("CAIF - Centro de Atención Integral Familiar");

  return lines.join("\n");
}

export function getArgentinaDateLabel(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatter.format(tomorrow);
}

export type DoctorSendResult = {
  doctorId: string;
  phone: string;
  ok: boolean;
  error?: string;
};

export async function sendDoctorTurnero(
  phone: string,
  doctorName: string,
  appointments: { hora: string; paciente: string }[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const dateLabel = getArgentinaDateLabel();
    const message = formatTurneroForDoctor(doctorName, dateLabel, appointments);
    await sendTextMessage(phone, message);
    console.log(`[whatsapp] Turnero enviado a ${doctorName} (${phone})`);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp] Error enviando turnero a ${doctorName}:`, err);
    return { ok: false, error };
  }
}

export async function sendAllDoctorTurneros(
  doctors: DoctorTurnero[],
): Promise<{ sent: number; failed: number; results: DoctorSendResult[] }> {
  let sent = 0;
  let failed = 0;
  const results: DoctorSendResult[] = [];

  for (const doc of doctors) {
    const { ok, error } = await sendDoctorTurnero(doc.phone, doc.doctorName, doc.appointments);
    results.push({ doctorId: doc.doctorId, phone: doc.phone, ok, error });
    if (ok) {
      sent++;
    } else {
      failed++;
    }

    // Rate limiting: wait between messages
    if (doctors.length > 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MESSAGES));
    }
  }

  return { sent, failed, results };
}
