// Opening-hours logic. Pure functions, no DOM: shared by the page and the node:test suite.
//
// Hours format: { mon: [["11:00", "14:30"], ["17:00", "21:00"]], ..., sun: [] }
// A range whose end is not after its start runs past midnight ("20:00"-"02:00" closes 02:00 next day).
// Times are wall-clock times in the visitor's local time zone (demo data follows the visitor).

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MINUTES_PER_DAY = 24 * 60;

/** "HH:MM" -> minutes after midnight. Throws on malformed input. "24:00" is allowed as an end time. */
export function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value));
  if (!match) throw new Error(`Invalid time "${value}", expected HH:MM`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) {
    throw new Error(`Invalid time "${value}"`);
  }
  return hours * 60 + minutes;
}

/** Minutes after midnight -> "HH:MM" (24 h). */
export function formatTime(minutes) {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Normalise one day's ranges to [{start, end}] in minutes; end > start (overnight end gets +1440). */
function rangesFor(hours, dayIndex) {
  const list = hours?.[DAY_KEYS[dayIndex]] ?? [];
  return list.map(([from, to]) => {
    const start = parseTime(from);
    let end = parseTime(to);
    if (end <= start) end += MINUTES_PER_DAY;
    return { start, end };
  });
}

/** Validate a whole week; returns a list of problems (empty when valid). */
export function validateHours(hours) {
  const problems = [];
  if (!hours || typeof hours !== "object") return ["hours must be an object"];
  for (const key of Object.keys(hours)) {
    if (!DAY_KEYS.includes(key)) problems.push(`unknown day "${key}"`);
  }
  for (let d = 0; d < 7; d += 1) {
    try {
      const ranges = rangesFor(hours, d).sort((a, b) => a.start - b.start);
      for (let i = 1; i < ranges.length; i += 1) {
        if (ranges[i].start < ranges[i - 1].end) problems.push(`${DAY_KEYS[d]}: overlapping ranges`);
      }
    } catch (err) {
      problems.push(`${DAY_KEYS[d]}: ${err.message}`);
    }
  }
  return problems;
}

/**
 * Status at a given moment.
 * Open:   { open: true, closesAt: minutes (0-1439), closesInMinutes }
 * Closed: { open: false, opensAt: minutes, opensInDays: 0..7, opensDay: dayIndex } or
 *         { open: false, opensAt: null } when the truck has no hours at all.
 */
export function statusAt(hours, date = new Date()) {
  const day = date.getDay();
  const now = date.getHours() * 60 + date.getMinutes();

  // Today's ranges, plus yesterday's overnight ranges shifted back by one day.
  const candidates = [
    ...rangesFor(hours, day),
    ...rangesFor(hours, (day + 6) % 7)
      .filter((r) => r.end > MINUTES_PER_DAY)
      .map((r) => ({ start: r.start - MINUTES_PER_DAY, end: r.end - MINUTES_PER_DAY })),
  ];
  const current = candidates.find((r) => now >= r.start && now < r.end);
  if (current) {
    // Ranges that touch (e.g. 11:00-15:00 and 15:00-20:00) count as one stretch.
    let end = current.end;
    for (let extended = true; extended; ) {
      extended = false;
      for (const r of candidates) {
        if (r.start === end) { end = r.end; extended = true; }
      }
    }
    return { open: true, closesAt: end % MINUTES_PER_DAY, closesInMinutes: end - now };
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const d = (day + offset) % 7;
    const next = rangesFor(hours, d)
      .filter((r) => offset > 0 || r.start > now)
      .sort((a, b) => a.start - b.start)[0];
    if (next) return { open: false, opensAt: next.start, opensInDays: offset, opensDay: d };
  }
  return { open: false, opensAt: null };
}

export const isOpenAt = (hours, date) => statusAt(hours, date).open;

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Human label for a status. `fmt` formats minutes after midnight (defaults to 24 h "HH:MM"),
 * so the page can pass a locale-aware formatter while tests stay deterministic.
 */
export function describeStatus(status, fmt = formatTime, soonMinutes = 30) {
  if (status.open) {
    return status.closesInMinutes <= soonMinutes
      ? `Closing soon, at ${fmt(status.closesAt)}`
      : `Open now until ${fmt(status.closesAt)}`;
  }
  if (status.opensAt == null) return "No hours listed";
  if (status.opensInDays === 0) return `Closed, opens at ${fmt(status.opensAt)}`;
  if (status.opensInDays === 1) return `Closed, opens tomorrow at ${fmt(status.opensAt)}`;
  return `Closed, opens ${SHORT_DAYS[status.opensDay]} at ${fmt(status.opensAt)}`;
}

/** Rows for a weekly hours table, starting Monday: [{ day: "mon", label: "Mon", text: "11:00–14:30, 17:00–21:00" }] */
export function weekRows(hours, fmt = formatTime) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((d) => {
    const list = hours?.[DAY_KEYS[d]] ?? [];
    const text = list.length
      ? list.map(([a, b]) => `${fmt(parseTime(a))}–${fmt(parseTime(b))}`).join(", ")
      : "Closed";
    return { day: DAY_KEYS[d], index: d, label: SHORT_DAYS[d], text };
  });
}
