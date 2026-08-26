/** 서비스 기준 시간대는 한국 표준시로 고정한다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKst(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

export function kstDateKey(date: Date | string): string {
  const d = toKst(typeof date === "string" ? new Date(date) : date);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function kstTimeLabel(date: Date | string): string {
  const d = toKst(typeof date === "string" ? new Date(date) : date);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function kstDateLabel(date: Date | string): string {
  const d = toKst(typeof date === "string" ? new Date(date) : date);
  return `${d.getUTCFullYear()}. ${pad(d.getUTCMonth() + 1)}. ${pad(d.getUTCDate())}`;
}

export function kstDateTimeLabel(date: Date | string): string {
  const d = toKst(typeof date === "string" ? new Date(date) : date);
  return `${d.getUTCFullYear()}. ${pad(d.getUTCMonth() + 1)}. ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function kstDayOfWeek(date: Date | string): number {
  const d = toKst(typeof date === "string" ? new Date(date) : date);
  return d.getUTCDay();
}

/** KST 기준 연·월·일·시·분으로 UTC Date를 만든다. */
export function fromKst(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - KST_OFFSET_MS);
}

/** KST 기준 오늘 00:00에 해당하는 시각 */
export function startOfKstToday(now: Date = new Date()): Date {
  const d = toKst(now);
  return fromKst(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function isSameKstDay(a: Date | string, b: Date | string): boolean {
  return kstDateKey(a) === kstDateKey(b);
}

export function daysAgoKst(days: number, now: Date = new Date()): Date {
  const start = startOfKstToday(now);
  return new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
}

export function relativeDayLabel(date: Date | string, now: Date = new Date()): string {
  const key = kstDateKey(date);
  if (key === kstDateKey(now)) return "오늘";
  if (key === kstDateKey(daysAgoKst(1, now))) return "어제";
  const [, month, day] = key.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
