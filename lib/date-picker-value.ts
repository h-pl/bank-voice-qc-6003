// Date-only values stay in the user's calendar; avoid UTC parsing shifting a day.
export function parseCalendarDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2})?$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}
export function calendarDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
