/** YYYY-MM for the current month, in local time. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** YYYY-MM-DD for today, in local time. */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(value + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

export function isValidMonth(value: string): boolean {
  if (!MONTH_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/**
 * The due date for `month` (YYYY-MM), derived from the member's join date:
 * same day-of-month as joined_on, clamped to the last day of `month` for
 * shorter months (e.g. joined on the 31st is due the 28th/29th in Feb).
 */
export function dueDateForMonth(joinedOn: string, month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const joinDay = Number(joinedOn.slice(8, 10));
  const lastDayOfMonth = new Date(year, mon, 0).getDate();
  const day = Math.min(joinDay, lastDayOfMonth);
  return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(year, mon - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Most recent `count` months up to and including the current month, newest first. */
export function recentMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/** Whole days between `dateStr` (YYYY-MM-DD) and today, in local time. */
export function daysSince(dateStr: string): number {
  const then = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = startOfToday.getTime() - then.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
