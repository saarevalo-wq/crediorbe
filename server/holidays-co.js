// Server-side port of ../js/holidays-co.js — same hybrid API+algorithm logic,
// but caches in-memory only (no localStorage in Node; the process stays
// running between polls anyway, so this is refetched at most once per year
// per process lifetime). Keep both in sync if you tune the holiday rules.

const API_URL = (year) => `https://date.nager.at/api/v3/publicholidays/${year}/CO`;
const KNOWN_BAD_HOLIDAY_NAMES = [/chiquinquir[aá]/i];
const BOGOTA_OFFSET_MS = 5 * 3600_000;

function toBogotaCalendarDay(date) {
  const shifted = new Date(date.getTime() - BOGOTA_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function nextMonday(date) {
  const day = date.getUTCDay();
  if (day === 1) return date;
  return addDays(date, (8 - day) % 7);
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * i + 2 * e - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function computeAlgorithmic(year) {
  const easter = easterSunday(year);
  const fixed = [
    [1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25],
  ].map(([m, d]) => new Date(Date.UTC(year, m - 1, d)));
  const holyWeek = [addDays(easter, -3), addDays(easter, -2)];
  const emiliani = [
    new Date(Date.UTC(year, 0, 6)),
    new Date(Date.UTC(year, 2, 19)),
    addDays(easter, 39),
    addDays(easter, 60),
    addDays(easter, 68),
    new Date(Date.UTC(year, 5, 29)),
    new Date(Date.UTC(year, 7, 15)),
    new Date(Date.UTC(year, 9, 12)),
    new Date(Date.UTC(year, 10, 1)),
    new Date(Date.UTC(year, 10, 11)),
  ].map(nextMonday);
  return new Set([...fixed, ...holyWeek, ...emiliani].map(ymd));
}

async function fetchApiHolidayDates(year) {
  const res = await fetch(API_URL(year));
  if (!res.ok) throw new Error(`holidays API returned ${res.status}`);
  const data = await res.json();
  return data
    .filter((h) => !KNOWN_BAD_HOLIDAY_NAMES.some((re) => re.test(h.localName || h.name || "")))
    .map((h) => h.date);
}

const memoryCache = new Map();

async function getHolidaySet(year) {
  if (memoryCache.has(year)) return memoryCache.get(year);
  const algorithmic = computeAlgorithmic(year);
  let merged;
  try {
    const apiDates = await fetchApiHolidayDates(year);
    merged = new Set([...algorithmic, ...apiDates]);
  } catch {
    merged = algorithmic;
  }
  memoryCache.set(year, merged);
  return merged;
}

async function isWeekendOrHoliday(bogotaCalendarDay) {
  const weekday = bogotaCalendarDay.getUTCDay();
  if (weekday === 0 || weekday === 6) return true;
  const set = await getHolidaySet(bogotaCalendarDay.getUTCFullYear());
  return set.has(ymd(bogotaCalendarDay));
}

export async function addBusinessDays(fromDate, n) {
  let day = addDays(toBogotaCalendarDay(fromDate), 1);
  while (await isWeekendOrHoliday(day)) day = addDays(day, 1);
  let remaining = n - 1;
  while (remaining > 0) {
    day = addDays(day, 1);
    if (!(await isWeekendOrHoliday(day))) remaining--;
  }
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 22, 0, 0));
}
