import { createStart, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const authApiMiddleware = createMiddleware().server(async ({ request, next }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/auth/")) {
    const { auth } = await import("./lib/auth.server");
    return auth.handler(request);
  }
  if (url.pathname === "/api/whatsapp/status") {
    const { getWhatsAppStatus } = await import("./lib/whatsapp");
    return Response.json(getWhatsAppStatus());
  }
  if (url.pathname === "/api/whatsapp/init") {
    const { startWhatsAppClient } = await import("./lib/whatsapp");
    startWhatsAppClient().catch(() => {});
    return Response.json({ ok: true });
  }
  if (url.pathname === "/api/whatsapp/restart") {
    const { startWhatsAppClient, destroyWhatsAppClient } = await import("./lib/whatsapp");
    await destroyWhatsAppClient();
    startWhatsAppClient().catch(() => {});
    return Response.json({ ok: true });
  }
  if (url.pathname === "/api/whatsapp/qr-image") {
    const { getWhatsAppStatus } = await import("./lib/whatsapp");
    const status = getWhatsAppStatus();
    if (!status.qrCode) {
      return new Response("No QR available", { status: 404 });
    }
    const QRCode = await import("qrcode");
    const dataUrl = await QRCode.toDataURL(status.qrCode, { width: 300, margin: 2 });
    return Response.json({ qrDataUrl: dataUrl });
  }
  if (url.pathname === "/api/whatsapp/send-test" && request.method === "POST") {
    const body = await request.json();
    const { phone, message } = body as { phone?: string; message?: string };
    if (!phone || !message) {
      return Response.json({ error: "Faltan parámetros: phone y message" }, { status: 400 });
    }
    const { sendTextMessage, isWhatsAppConnected } = await import("./lib/whatsapp");
    if (!isWhatsAppConnected()) {
      return Response.json({ error: "WhatsApp no está conectado" }, { status: 400 });
    }
    try {
      await sendTextMessage(phone, message);
      return Response.json({ success: true });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Error al enviar" },
        { status: 500 },
      );
    }
  }
  return await next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, authApiMiddleware],
}));
