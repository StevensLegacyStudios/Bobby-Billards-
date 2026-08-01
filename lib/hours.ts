/**
 * Defensive parser for the venues.hours jsonb blob into "open right now"
 * status. Real-world shapes seen in the data:
 *
 *   { "mon-thu": "12pm-12am", "fri-sat": "12pm-2am", "sun": "12pm-10pm" }
 *   { "daily": "2pm-11pm" }
 *   { "mon-sun": "10am-12am" }
 *   { "monday": "11am-1am", ... }   (Google-Places-style keys)
 *
 * Anything unrecognized returns null (unknown hours) — never throws.
 */

export interface OpenStatus {
  isOpen: boolean;
  /** Display time like "2am" or "11:30pm" — present when currently open. */
  closesAt?: string;
  /** Display time like "4pm" (or "11am Sat" when not today) — present when closed. */
  opensAt?: string;
}

/** 0 = Sunday .. 6 = Saturday, matching Date.getDay(). */
const DAY_ABBREVIATIONS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "12pm" → 720, "2am" → 120, "11:30am" → 690. Null when unparseable. */
function parseClockMinutes(raw: string): number | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(raw.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const meridiem = match[3].toLowerCase();
  if (hour === 12) hour = 0;
  if (meridiem === "pm") hour += 12;
  return hour * 60 + minute;
}

/** 720 → "12pm", 690 → "11:30am". Minutes may exceed 1440 (past midnight). */
function formatClockMinutes(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const meridiem = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minute === 0 ? `${hour12}${meridiem}` : `${hour12}:${String(minute).padStart(2, "0")}${meridiem}`;
}

/** "mon" / "monday" / "tues" → weekday index, or null. */
function parseDayToken(raw: string): number | null {
  const key = raw.trim().toLowerCase().slice(0, 3);
  return key in DAY_ABBREVIATIONS ? DAY_ABBREVIATIONS[key] : null;
}

/** "mon-thu" → [1,2,3,4]; "fri-sun" → [5,6,0]; "daily" → all seven. */
function parseDayKey(raw: string): number[] | null {
  const key = raw.trim().toLowerCase();
  if (key === "daily" || key === "everyday" || key === "every day") {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  const parts = key.split("-").map((p) => p.trim());
  if (parts.length === 1) {
    const day = parseDayToken(parts[0]);
    return day === null ? null : [day];
  }
  if (parts.length === 2) {
    const start = parseDayToken(parts[0]);
    const end = parseDayToken(parts[1]);
    if (start === null || end === null) return null;
    const days: number[] = [];
    for (let d = start; ; d = (d + 1) % 7) {
      days.push(d);
      if (d === end || days.length >= 7) break;
    }
    return days;
  }
  return null;
}

interface DayInterval {
  /** Minutes from midnight, [open, close). close may exceed 1440 past midnight. */
  open: number;
  close: number;
}

/**
 * Expand the hours blob into per-weekday intervals. Returns null when any
 * entry fails to parse — a partially-understood schedule would misreport
 * "closed" for the days we could not read.
 */
function buildSchedule(hours: Record<string, unknown>): DayInterval[][] | null {
  const schedule: DayInterval[][] = Array.from({ length: 7 }, () => []);
  const entries = Object.entries(hours);
  if (entries.length === 0) return null;

  for (const [rawKey, rawValue] of entries) {
    const days = parseDayKey(rawKey);
    if (!days) return null;
    if (typeof rawValue !== "string") return null;
    const value = rawValue.trim().toLowerCase();
    if (value === "closed") continue;

    const [openRaw, closeRaw, extra] = value.split("-").map((p) => p.trim());
    if (!openRaw || !closeRaw || extra !== undefined) return null;
    const open = parseClockMinutes(openRaw);
    let close = parseClockMinutes(closeRaw);
    if (open === null || close === null) return null;
    // "12pm-2am" closes past midnight into the next day.
    if (close <= open) close += 1440;
    for (const day of days) schedule[day].push({ open, close });
  }
  return schedule;
}

/**
 * Open-now status for a venue at `now` (the user's local time). Returns null
 * when the hours are missing or in a format we do not understand.
 */
export function getOpenStatus(
  hours: Record<string, string> | null | undefined,
  now: Date = new Date()
): OpenStatus | null {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  const schedule = buildSchedule(hours);
  if (!schedule) return null;

  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  // Open via one of today's intervals?
  for (const interval of schedule[day]) {
    if (minutes >= interval.open && minutes < interval.close) {
      return { isOpen: true, closesAt: formatClockMinutes(interval.close) };
    }
  }
  // Open via yesterday's interval spilling past midnight (e.g. 12pm-2am)?
  const yesterday = (day + 6) % 7;
  for (const interval of schedule[yesterday]) {
    if (interval.close > 1440 && minutes + 1440 < interval.close) {
      return { isOpen: true, closesAt: formatClockMinutes(interval.close) };
    }
  }

  // Closed — find the next opening, starting later today then scanning ahead.
  for (const interval of [...schedule[day]].sort((a, b) => a.open - b.open)) {
    if (interval.open > minutes) {
      return { isOpen: false, opensAt: formatClockMinutes(interval.open) };
    }
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const nextDay = (day + ahead) % 7;
    const intervals = [...schedule[nextDay]].sort((a, b) => a.open - b.open);
    if (intervals.length > 0) {
      const time = formatClockMinutes(intervals[0].open);
      return {
        isOpen: false,
        opensAt: ahead === 1 ? `${time} tomorrow` : `${time} ${DAY_LABELS[nextDay]}`,
      };
    }
  }
  // Every day parsed as closed.
  return { isOpen: false };
}
