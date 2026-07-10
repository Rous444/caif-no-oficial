let scheduled = false;

export function startDailyScheduler() {
  if (scheduled) return;
  scheduled = true;

  import("node-cron")
    .then(({ default: cron }) => {
      cron.schedule(
        "0 21 * * *",
        async () => {
          console.log("[scheduler] Ejecutando envío del turnero...");

          const { startWhatsAppClient, getWhatsAppStatus, sendTurneroPDF } =
            await import("./whatsapp");

          const status = getWhatsAppStatus();
          if (!status.connected) {
            console.log("[scheduler] WhatsApp no conectado, reintentando init...");
            await startWhatsAppClient().catch(() => {});
            const retry = getWhatsAppStatus();
            if (!retry.connected) {
              console.log("[scheduler] WhatsApp sigue sin conectar, se saltea el envío");
              return;
            }
          }

          try {
            const { getTomorrowAppointments, generateTurneroPDF } = await import("./pdf-turnero");
            const rows = await getTomorrowAppointments();
            const pdf = await generateTurneroPDF(rows);

            const toPhone = process.env.WHATSAPP_TURNERO_TO;
            if (!toPhone) {
              console.log("[scheduler] WHATSAPP_TURNERO_TO no configurado, no se envía el PDF");
              return;
            }

            const fileName = `turnero-${new Date().toISOString().slice(0, 10)}.pdf`;
            await sendTurneroPDF(pdf, fileName, toPhone);
            console.log("[scheduler] Turnero enviado ✓");
          } catch (err) {
            console.error("[scheduler] Error enviando turnero:", err);
          }
        },
        { timezone: "America/Argentina/Buenos_Aires" },
      );

      console.log("[scheduler] Programado: 21:00 ARG todos los días");
    })
    .catch((err) => {
      console.error("[scheduler] No se pudo cargar node-cron:", err);
    });

  import("./whatsapp")
    .then(({ startWhatsAppClient }) => {
      startWhatsAppClient().catch(() => {});
    })
    .catch(() => {});
}
