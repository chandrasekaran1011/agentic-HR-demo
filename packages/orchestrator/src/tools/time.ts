export function getCurrentTime(): string {
  return new Date().toISOString();
}

export function computeDate(baseISO: string, offsetDays: number): string {
  const d = new Date(baseISO);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string, locale = "en-IN"): string {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
