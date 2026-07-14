let scheduled = false;

const INIT_CRON = "45 20 * * *"; // 20:45 ARG — warm up WhatsApp client
const SEND_CRON = "0 21 * * *"; // 21:00 ARG — send messages
const RETRY_CRON = "15 21 * * *"; // 21:15 ARG — retry failed/missing (M10)
const DESTROY_CRON = "20 21 * * *"; // 21:20 ARG — destroy client, free memory
const MEMORY_LOG_CRON = "0 * * * *"; // every hour — log memory usage

// Rutina de envío compartida por el envío de las 21:00 y el reintento de las 21:15.
// En modo reintento saltea los médicos que ya recibieron el turnero (según whatsapp_log),
// para no mandar duplicados. Cada intento (éxito o fallo) queda registrado.
async function sendTurneros(opts: { isRetry: boolean }): Promise<void> {
  const label = opts.isRetry ? "reintento" : "envío";

  const { isWhatsAppConnected, startWhatsAppClient } = await import("./whatsapp");
  const { sendAllDoctorTurneros } = await import("./whatsapp-messages");
  const { getTomorrowAppointmentsByDoctor, getArgentinaTomorrowISO } =
    await import("./pdf-turnero");
  const { logTurneroAttempt, getSentDoctorIds } = await import("./whatsapp-log");

  // Ensure client is connected (it should be, since we started at 20:45)
  if (!isWhatsAppConnected()) {
    console.log(`[scheduler] WhatsApp no conectado, intentando iniciar (${label})...`);
    await startWhatsAppClient().catch(() => {});
    // Give it a few seconds to connect
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (!isWhatsAppConnected()) {
    console.log(`[scheduler] WhatsApp no disponible, se saltea el ${label}`);
    return;
  }

  const targetDate = getArgentinaTomorrowISO();
  let groups = await getTomorrowAppointmentsByDoctor();

  if (opts.isRetry) {
    const alreadySent = await getSentDoctorIds(targetDate);
    const before = groups.length;
    groups = groups.filter((g) => !alreadySent.has(g.doctorId));
    console.log(`[scheduler] Reintento: ${groups.length}/${before} médicos pendientes`);
  } else {
    console.log(`[scheduler] ${groups.length} médicos con notificaciones activas`);
  }

  if (groups.length === 0) {
    console.log(`[scheduler] Nada para ${label}`);
    return;
  }

  const { sent, failed, results } = await sendAllDoctorTurneros(groups);

  for (const r of results) {
    await logTurneroAttempt({
      doctorId: r.doctorId,
      targetDate,
      status: r.ok ? "sent" : "failed",
      error: r.error,
    });
  }

  console.log(`[scheduler] ${label} completado: ${sent} enviados, ${failed} fallidos`);
}

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
          try {
            await sendTurneros({ isRetry: false });
          } catch (err) {
            console.error("[scheduler] Error durante el envío:", err);
          }
        },
        { timezone: "America/Argentina/Buenos_Aires" },
      );

      // ── Retry failed/missing at 21:15 (M10) ──
      cron.schedule(
        RETRY_CRON,
        async () => {
          console.log("[scheduler] Reintentando turneros fallidos/faltantes...");
          try {
            await sendTurneros({ isRetry: true });
          } catch (err) {
            console.error("[scheduler] Error durante el reintento:", err);
          }
        },
        { timezone: "America/Argentina/Buenos_Aires" },
      );

      // ── Destroy WhatsApp client at 21:20 to free memory ──
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

      console.log(
        "[scheduler] Programado: 20:45 init → 21:00 envío → 21:15 reintento → 21:20 destroy (ARG)",
      );
      console.log("[scheduler] Memory log cada hora");
    })
    .catch((err) => {
      console.error("[scheduler] No se pudo cargar node-cron:", err);
    });
}
