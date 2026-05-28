export function formatDateTimeRu(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("ru-RU");
}

export function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function filenameFromContentDisposition(headers, fallback) {
  const raw = headers && (headers["content-disposition"] || headers["Content-Disposition"]);
  if (raw) {
    const star = /filename\*\s*=\s*([^']*)''([^;]+)/i.exec(raw);
    if (star) {
      try { return decodeURIComponent(star[2].trim().replace(/^"|"$/g, "")); } catch {}
    }
    const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(raw);
    if (plain) return plain[1].trim();
  }
  return fallback;
}
