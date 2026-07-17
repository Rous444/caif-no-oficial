const DATA_URL_RE = /^data:([^;,]+);base64,([\s\S]*)$/;

export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw new Error("Formato de data URL inválido");
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

export function toDataUrl(mime: string, buffer: Buffer): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
