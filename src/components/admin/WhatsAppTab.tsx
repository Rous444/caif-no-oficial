import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function WhatsAppTab() {
  const [status, setStatus] = useState<{
    connected: boolean;
    qrCode: string | null;
    starting: boolean;
    error: string | null;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      setStatus(data);
      if (data.qrCode) {
        const imgRes = await fetch("/api/whatsapp/qr-image");
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          setQrDataUrl(imgData.qrDataUrl);
        }
      } else {
        setQrDataUrl(null);
      }
    } catch {
      setStatus(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg">WhatsApp</h3>
            <p className="text-sm text-muted-foreground">
              Conexión con WhatsApp para enviar el turnero diario
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando estado...
        </div>
      ) : !status ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background p-10 text-muted-foreground">
          <XCircle className="h-5 w-5 text-destructive" /> No se pudo obtener el estado
        </div>
      ) : status.connected ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-background p-10">
          <CheckCircle2 className="h-8 w-8 text-teal" />
          <div>
            <p className="font-display text-xl text-foreground">WhatsApp conectado</p>
            <p className="text-sm text-muted-foreground">
              El turnero se enviará automáticamente a las 21:00 ARG
            </p>
          </div>
        </div>
      ) : status.starting ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Iniciando sesión de WhatsApp...
        </div>
      ) : qrDataUrl ? (
        <div className="rounded-2xl border border-border bg-background p-8 text-center">
          <h4 className="font-display text-xl text-foreground">Escaneá el código QR</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Abrí WhatsApp en el celular de la clínica, tocá los tres puntos (⋮) y seleccioná
            "Dispositivos vinculados" → "Vincular un dispositivo"
          </p>
          <div className="mt-6 flex justify-center">
            <img
              src={qrDataUrl}
              alt="WhatsApp QR Code"
              className="rounded-xl border border-border"
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            El código se actualiza automáticamente cada 5 segundos
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
          <p>Esperando código QR...</p>
          <p className="mt-2 text-xs">
            {status.error ? `Error: ${status.error}` : "Inicializando cliente de WhatsApp..."}
          </p>
          {status.error && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={async () => {
                setLoading(true);
                await fetch("/api/whatsapp/restart");
                setTimeout(fetchStatus, 2000);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground">
        <h4 className="mb-2 font-medium text-foreground">Configuración</h4>
        <ul className="space-y-1">
          <li>
            · Variable de entorno{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">WHATSAPP_TURNERO_TO</code>:
            número de teléfono que recibe el PDF (formato internacional, ej: 5491123456789)
          </li>
          <li>
            · El turnero se envía todos los días a las <strong>21:00 ARG</strong>
          </li>
          <li>
            · La sesión se guarda en{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">WHATSAPP_SESSION_PATH</code>{" "}
            (por defecto{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">./whatsapp-session</code>)
          </li>
          <li className="mt-3 border-t border-border pt-3">
            · <strong>Solución de problemas:</strong> si ves <em>"Could not find Chrome"</em>,
            instalá Chrome o ejecutá{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              npx puppeteer browsers install chrome
            </code>
            . En Render, definí{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">CHROMIUM_PATH</code>.
          </li>
        </ul>
      </div>
    </div>
  );
}
