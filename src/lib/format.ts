export function formatScore(score: number): string {
  if (score > 0) return `+${score}`;
  return `${score}`;
}

type TimeInput = string | number | Date;

function toDate(ts: TimeInput): Date {
  return ts instanceof Date ? ts : new Date(ts);
}

export function formatDateTime(ts: TimeInput): string {
  const d = toDate(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(ts: TimeInput): string {
  const d = toDate(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 当天显示 HH:mm，否则显示 月-日 */
export function formatGameTime(ts: TimeInput): string {
  const d = toDate(ts);
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
