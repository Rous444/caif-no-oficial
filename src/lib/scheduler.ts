let scheduled = false;

const INIT_CRON = "45 20 * * *"; // 20:45 ARG — warm up WhatsApp client
const SEND_CRON = "0 21 * * *"; // 21:00 ARG — send messages
const DESTROY_CRON = "5 21 * * *"; // 21:05 ARG — destroy client, free memory
const MEMORY_LOG_CRON = "0 * * * *"; // every hour — log memory usage

export function startDailyScheduler() {
  if (scheduled) return;
  scheduled = true;

  import("node-cron")
    .then(({ default: cron }) => {
      // ── Warm up WhatsApp at 20:45 ──
      cron.schedule(
        INIT_CRON,
        async () => {
          console.log("[scheduler] Iniciando cliente WhatsApp para el turnero...");
          const { startWhatsAppClient } = await import("./whatsapp");
          await startWhatsAppClient().catch((err: unknown) => {
            console.error("[scheduler] Error iniciando WhatsApp:", err);
          });
        },
        { timezone: "America/Argentina/Buenos_Aires" },
      );

      // ── Send per-doctor messages at 21:00 ──
      cron.schedule(
        SEND_CRON,
        async () => {
          console.log("[scheduler] Enviando turneros por WhatsApp...");

          const { isWhatsAppConnected, startWhatsAppClient } = await import("./whatsapp");
          const { sendAllDoctorTurneros } = await import("./whatsapp-messages");
          const { getTomorrowAppointmentsByDoctor } = await import("./pdf-turnero");

          // Ensure client is connected (it should be, since we started at 20:45)
          if (!isWhatsAppConnected()) {
            console.log("[scheduler] WhatsApp no conectado, intentando iniciar...");
            await startWhatsAppClient().catch(() => {});
            // Give it a few seconds to connect
            await new Promise((r) => setTimeout(r, 5000));
          }

          if (!isWhatsAppConnected()) {
            console.log("[scheduler] WhatsApp no disponible, se saltea el envío");
            return;
          }

          try {
            const groups = await getTomorrowAppointmentsByDoctor();
            console.log(`[scheduler] ${groups.length} médicos con notificaciones activas`);

            if (groups.length > 0) {
              const result = await sendAllDoctorTurneros(groups);
              console.log(
                `[scheduler] Envío completado: ${result.sent} enviados, ${result.failed} fallidos`,
              );
            } else {
              console.log("[scheduler] No hay médicos con turnos y notificaciones activas");
            }
          } catch (err) {
            console.error("[scheduler] Error durante el envío:", err);
          }
        },
        { timezone: "America/Argentina/Buenos_Aires" },
      );

      // ── Destroy WhatsApp client at 21:05 to free memory ──
      cron.schedule(
        DESTROY_CRON,
        async () => {
          console.log("[scheduler] Destruyendo cliente WhatsApp para liberar memoria...");
          const { destroyWhatsAppClient } = await import("./whatsapp");
          await destroyWhatsAppClient();
        },
        { timezone: "America/Argentina/Buenos_Aires" },
      );

      // ── Memory health check every hour ──
      cron.schedule(
        MEMORY_LOG_CRON,
        () => {
          const usage = process.memoryUsage();
          const rssMB = (usage.rss / 1024 / 1024).toFixed(1);
          const heapMB = (usage.heapUsed / 1024 / 1024).toFixed(1);
          console.log(`[memory] RSS: ${rssMB} MB | Heap: ${heapMB} MB`);
        },
        { timezone: "America/Argentina/Buenos_Aires" },
      );

      console.log("[scheduler] Programado: 20:45 init → 21:00 envío → 21:05 destroy (ARG)");
      console.log("[scheduler] Memory log cada hora");
    })
    .catch((err) => {
      console.error("[scheduler] No se pudo cargar node-cron:", err);
    });
}
