/** Today's calendar day in the browser's time zone as `AAAA-MM-DD` (the bound of a date picker: «not before today», «not after today»). */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
