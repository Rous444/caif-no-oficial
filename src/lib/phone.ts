const AR_COUNTRY_CODE = "54";
const AR_MOBILE_PREFIX = "9";
const LOCAL_DIGITS = 10;

// Área de Buenos Aires/GBA: único código de 2 dígitos.
const TWO_DIGIT_AREA_CODES = new Set(["11"]);

// Códigos de área de 3 dígitos más comunes (capitales de provincia y ciudades
// grandes). Los planes de numeración argentinos son "libres de prefijo"
// (ningún código de 3 dígitos es el inicio de uno de 4), así que esta lista
// no genera ambigüedad con los códigos de 4 dígitos — pero no es exhaustiva:
// cualquier prefijo no reconocido acá se asume de 4 dígitos por defecto.
const THREE_DIGIT_AREA_CODES = new Set([
  "220", "221", "223", "230", "236", "249",
  "260", "261", "262", "263", "264", "265", "266",
  "280", "291", "292", "293", "294", "297", "298", "299",
  "336", "337", "338", "339",
  "341", "342", "343", "345", "346", "347", "348", "349",
  "351", "353", "358",
  "362", "364",
  "370", "376", "379",
  "380", "381", "383", "385", "387", "388",
]);

export function normalizeArPhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith(AR_COUNTRY_CODE)) digits = digits.slice(AR_COUNTRY_CODE.length);
  if (digits.startsWith(AR_MOBILE_PREFIX)) digits = digits.slice(AR_MOBILE_PREFIX.length);
  return digits.slice(0, LOCAL_DIGITS);
}

export function isValidArPhone(raw: string): boolean {
  return normalizeArPhoneDigits(raw).length === LOCAL_DIGITS;
}

export function toWaPhone(raw: string): string {
  return `${AR_COUNTRY_CODE}${AR_MOBILE_PREFIX}${normalizeArPhoneDigits(raw)}`;
}

function detectAreaCodeLength(local: string): number {
  if (TWO_DIGIT_AREA_CODES.has(local.slice(0, 2))) return 2;
  if (THREE_DIGIT_AREA_CODES.has(local.slice(0, 3))) return 3;
  return 4;
}

export function formatArPhone(raw: string): string {
  const local = normalizeArPhoneDigits(raw);
  if (!local) return "";
  const areaLen = detectAreaCodeLength(local);
  const area = local.slice(0, areaLen);
  const remainder = local.slice(areaLen);
  const mid = remainder.length > 4 ? remainder.slice(0, remainder.length - 4) : "";
  const last = remainder.length > 4 ? remainder.slice(-4) : remainder;

  let out = `+${AR_COUNTRY_CODE} ${AR_MOBILE_PREFIX} ${area}`;
  if (mid) out += ` ${mid}`;
  if (last) out += mid ? `-${last}` : ` ${last}`;
  return out;
}

export function toWaLink(raw: string, text: string): string {
  return `https://wa.me/${toWaPhone(raw)}?text=${encodeURIComponent(text)}`;
}
