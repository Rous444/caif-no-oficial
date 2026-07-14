import PDFDocument from "pdfkit";
import { getArgentinaTomorrow, type TurneroRow } from "./pdf-turnero";

// Aislado en su propio módulo (P0.3): las queries del turnero (pdf-turnero.ts) NO deben
// importar pdfkit, así el path del cron nocturno no falla si pdfkit no está disponible.

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
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
