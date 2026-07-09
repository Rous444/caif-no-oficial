import PDFDocument from "pdfkit";
import { db } from "@/db";
import { appointments, doctors, user, specialties } from "@/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";

export type TurneroRow = {
  hora: string;
  paciente: string;
  medico: string;
  especialidad: string;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function getArgentinaTomorrow(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const today = new Date(year, month, day);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

export async function getTomorrowAppointments(): Promise<TurneroRow[]> {
  const tomorrow = getArgentinaTomorrow();
  const startOfDay = new Date(tomorrow);
  const endOfDay = new Date(tomorrow);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const rows = await db
    .select({
      scheduledAt: appointments.scheduledAt,
      patientName: user.name,
      patientFirstName: user.firstName,
      patientLastName: user.lastName,
      doctorName: user.name,
      specialtyName: specialties.name,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .innerJoin(user, eq(appointments.patientId, user.id))
    .innerJoin(specialties, eq(appointments.specialtyId, specialties.id))
    .where(
      and(
        gte(appointments.scheduledAt, startOfDay),
        lt(appointments.scheduledAt, endOfDay),
        eq(appointments.status, "pendiente"),
      ),
    )
    .orderBy(appointments.scheduledAt);

  return rows.map((r) => ({
    hora: r.scheduledAt.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    }),
    paciente: `${r.patientFirstName} ${r.patientLastName}`,
    medico: r.doctorName ?? "",
    especialidad: r.specialtyName,
  }));
}

export async function generateTurneroPDF(rows: TurneroRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const buffers: Buffer[] = [];
    doc.on("data", (b: Buffer) => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const title = "Turnero";
    const sub = formatDate(getArgentinaTomorrow());

    doc.font("Helvetica-Bold").fontSize(22).text(title, { align: "center" });
    doc.font("Helvetica").fontSize(12).text(sub, { align: "center" });
    doc.moveDown(1.5);

    if (rows.length === 0) {
      doc.fontSize(14).text("No hay turnos agendados para mañana.", { align: "center" });
    } else {
      const tableTop = doc.y;
      const colX = [40, 100, 280, 420];
      const colW = [55, 175, 135, 150];

      const drawHeader = () => {
        doc.font("Helvetica-Bold").fontSize(10);
        const headers = ["Hora", "Paciente", "Médico", "Especialidad"];
        headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: colW[i] }));
        doc.moveDown(0.5);
      };

      doc.x = 40;
      drawHeader();

      doc.font("Helvetica").fontSize(9);
      for (const row of rows) {
        if (doc.y > 720) {
          doc.addPage();
          doc.x = 40;
          drawHeader();
        }
        const y = doc.y;
        doc.text(row.hora, colX[0], y, { width: colW[0] });
        doc.text(row.paciente, colX[1], y, { width: colW[1] });
        doc.text(row.medico, colX[2], y, { width: colW[2] });
        doc.text(row.especialidad, colX[3], y, { width: colW[3] });
        doc.moveDown(0.8);
      }
    }

    const now = new Date();
    const footerText = `Generado el ${now.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`;
    doc.fontSize(8).fillColor("#888").text(footerText, 40, 780, { align: "center" });

    doc.end();
  });
}
