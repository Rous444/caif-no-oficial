import { createRequire } from "module";
import { rm } from "fs/promises";
import path from "path";

const _require = createRequire(import.meta.url);

let client: any = null;
let qrCodeString: string | null = null;
let isConnected = false;
let isStarting = false;
let startError: string | null = null;

const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || "./whatsapp-session";

// whatsapp-web.js LocalAuth guarda el perfil de Chromium en `${dataPath}/session`
// (sin clientId). Los locks Singleton* viven directamente en ese directorio.
const PROFILE_DIR = path.join(SESSION_PATH, "session");

function getWA() {
  return _require("whatsapp-web.js");
}

// C8: en disco persistente (/var/data en Render), un contenedor que murió sin cerrar
// Chromium deja SingletonLock/Socket/Cookie apuntando a un hostname/PID viejo, y el
// contenedor nuevo se niega a arrancar (Code 21). Sólo se llama cuando client == null
// (startWhatsAppClient sale temprano si hay cliente activo), así que nunca borramos un
// lock en uso por un Chromium vivo.
async function cleanChromiumLocks(): Promise<void> {
  for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    await rm(path.join(PROFILE_DIR, f), { force: true }).catch(() => {});
  }
}

export function getWhatsAppStatus() {
  return {
    connected: isConnected,
    qrCode: qrCodeString,
    starting: isStarting,
    error: startError,
  };
}

export function isWhatsAppConnected(): boolean {
  return isConnected;
}

export async function startWhatsAppClient(): Promise<void> {
  if (client || isStarting) return;
  isStarting = true;
  startError = null;

  try {
    console.log(`[whatsapp] Perfil de Chromium: ${PROFILE_DIR}`);
    await cleanChromiumLocks();

    const wa = getWA();
    const { Client, LocalAuth } = wa;

    const puppeteerOpts: Record<string, unknown> = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--disable-translate",
        "--disable-default-apps",
        "--mute-audio",
        "--no-first-run",
        "--hide-scrollbars",
        "--disable-notifications",
        "--disable-infobars",
        "--js-flags=--max-old-space-size=256",
      ],
    };
    if (process.env.CHROMIUM_PATH) {
      puppeteerOpts.executablePath = process.env.CHROMIUM_PATH;
    }

    client = new Client({
      authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
      puppeteer: puppeteerOpts,
    });

    client.on("qr", (qr: string) => {
      qrCodeString = qr;
      console.log("WhatsApp QR recibido — escaneá con el celular de la clínica");
    });

    client.on("ready", () => {
      isConnected = true;
      qrCodeString = null;
      console.log("WhatsApp cliente listo ✓");
    });

    client.on("disconnected", (reason: string) => {
      isConnected = false;
      console.log("WhatsApp desconectado:", reason);
    });

    await client.initialize();
  } catch (err) {
    startError = err instanceof Error ? err.message : String(err);
    console.error("WhatsApp init error:", err);
    client = null;
  } finally {
    isStarting = false;
  }
}

export async function destroyWhatsAppClient(): Promise<void> {
  if (!client) return;

  try {
    // Remove all event listeners to prevent memory leaks
    client.removeAllListeners?.();
    await client.destroy();
  } catch (err) {
    console.error("WhatsApp destroy error (non-fatal):", err);
  } finally {
    client = null;
    qrCodeString = null;
    isConnected = false;
    isStarting = false;
    startError = null;

    // Force garbage collection hint (V8 will collect on next cycle)
    if (globalThis.gc) {
      try {
        globalThis.gc();
      } catch {
        // gc() not available (no --expose-gc flag)
      }
    }

    console.log("WhatsApp client destroyed — memory released");
  }
}

export async function sendTextMessage(toPhone: string, message: string): Promise<void> {
  if (!client || !isConnected) {
    throw new Error("WhatsApp no está conectado");
  }
  const chatId = toPhone.includes("@c.us") ? toPhone : `${toPhone}@c.us`;
  await client.sendMessage(chatId, message);
}

export async function sendTurneroPDF(
  pdfBuffer: Buffer,
  fileName: string,
  toPhone: string,
): Promise<void> {
  if (!client || !isConnected) {
    throw new Error("WhatsApp no está conectado");
  }
  const wa = getWA();
  const { MessageMedia } = wa;
  const chatId = toPhone.includes("@c.us") ? toPhone : `${toPhone}@c.us`;
  const media = new MessageMedia("application/pdf", pdfBuffer.toString("base64"), fileName);
  await client.sendMessage(chatId, media, { caption: "📋 Turnero del día de mañana" });
}
