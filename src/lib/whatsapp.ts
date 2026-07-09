import { createRequire } from "module";

const _require = createRequire(import.meta.url);

let client: any = null;
let qrCodeString: string | null = null;
let isConnected = false;
let isStarting = false;
let startError: string | null = null;

const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || "./whatsapp-session";

function getWA() {
  return _require("whatsapp-web.js");
}

export function getWhatsAppStatus() {
  return {
    connected: isConnected,
    qrCode: qrCodeString,
    starting: isStarting,
    error: startError,
  };
}

export async function startWhatsAppClient(): Promise<void> {
  if (client || isStarting) return;
  isStarting = true;
  startError = null;

  try {
    const wa = getWA();
    const { Client, LocalAuth } = wa;

    const puppeteerOpts: Record<string, unknown> = {
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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
