// Colombian public holidays and business-day arithmetic.
//
// Hybrid source: tries a live public holidays API first (to automatically
// pick up any future law change), falls back to an algorithmic computation
// (Easter + Ley 51/1983 "Emiliani" Monday-shifts) if offline or the API is
// unreachable. Entries from the API matching KNOWN_BAD_HOLIDAY_NAMES are
// dropped — cross-checking the API against the algorithm found it reports a
// "Día de la Virgen de Chiquinquirá" for Colombia that isn't one of the
// country's 18 official holidays; everything else matched exactly.
//
// All calendar-day math happens in Bogotá local time (UTC-5, no DST) so a
// judicial email that lands at 11pm UTC on a Friday is still correctly
// treated as Friday, not Saturday.

const BOGOTA_OFFSET_MS = 5 * 3600_000;
const API_URL = (year) => `https://date.nager.at/api/v3/publicholidays/${year}/CO`;
const CACHE_PREFIX = "crediorbe.holidays.co.";
const CACHE_TTL_MS = 30 * 86_400_000; // 30 days
const KNOWN_BAD_HOLIDAY_NAMES = [/chiquinquir[aá]/i];

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
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  if (day === 1) return date;
  const diff = (8 - day) % 7;
  return addDays(date, diff);
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

// Meeus/Jones/Butcher Gregorian Easter algorithm.
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
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Algorithmic fallback — verified against Ley 51/1983 (18 official holidays). */
function computeAlgorithmic(year) {
  const easter = easterSunday(year);

  const fixed = [
    [1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25],
  ].map(([m, d]) => new Date(Date.UTC(year, m - 1, d)));

  const holyWeek = [addDays(easter, -3), addDays(easter, -2)]; // Jueves y Viernes Santo

  const emiliani = [
    new Date(Date.UTC(year, 0, 6)), // Reyes Magos
    new Date(Date.UTC(year, 2, 19)), // San José
    addDays(easter, 39), // Ascensión del Señor
    addDays(easter, 60), // Corpus Christi
    addDays(easter, 68), // Sagrado Corazón
    new Date(Date.UTC(year, 5, 29)), // San Pedro y San Pablo
    new Date(Date.UTC(year, 7, 15)), // Asunción de la Virgen
    new Date(Date.UTC(year, 9, 12)), // Día de la Raza
    new Date(Date.UTC(year, 10, 1)), // Todos los Santos
    new Date(Date.UTC(year, 10, 11)), // Independencia de Cartagena
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

  const cacheKey = CACHE_PREFIX + year;
  try {
    const stored = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (stored && Date.now() - stored.ts < CACHE_TTL_MS) {
      const merged = new Set([...algorithmic, ...stored.dates]);
      memoryCache.set(year, merged);
      return merged;
    }
  } catch {
    // corrupt cache entry — ignore and refetch
  }

  let merged;
  try {
    const apiDates = await fetchApiHolidayDates(year);
    merged = new Set([...algorithmic, ...apiDates]);
    localStorage.setItem(cacheKey, JSON.stringify({ dates: apiDates, ts: Date.now() }));
  } catch {
    // offline or API unreachable — the verified algorithmic set alone is
    // still correct for the current 18 official holidays.
    merged = algorithmic;
  }

  memoryCache.set(year, merged);
  return merged;
}

export async function isColombianHoliday(date) {
  const day = toBogotaCalendarDay(date);
  const set = await getHolidaySet(day.getUTCFullYear());
  return set.has(ymd(day));
}

export async function isBusinessDay(date) {
  const day = toBogotaCalendarDay(date);
  const weekday = day.getUTCDay();
  if (weekday === 0 || weekday === 6) return false; // Sun/Sat
  const set = await getHolidaySet(day.getUTCFullYear());
  return !set.has(ymd(day));
}

/**
 * Colombian judicial-term rule: the term starts running the day AFTER the
 * triggering event, counting only business days (skips weekends and
 * holidays), and lands on the Nth business day. Returns that day at 5:00pm
 * Bogotá time (17:00 -05:00), the conventional end-of-business-day cutoff.
 */
export async function addBusinessDays(fromDate, n) {
  let day = addDays(toBogotaCalendarDay(fromDate), 1);
  while (await isWeekendOrHoliday(day)) day = addDays(day, 1);

  let remaining = n - 1; // the first business day found above counts as day 1
  while (remaining > 0) {
    day = addDays(day, 1);
    if (!(await isWeekendOrHoliday(day))) remaining--;
  }

  // day is a Bogotá-midnight UTC marker; convert to 5:00pm Bogotá (=22:00 UTC).
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 22, 0, 0));
}

async function isWeekendOrHoliday(bogotaCalendarDay) {
  const weekday = bogotaCalendarDay.getUTCDay();
  if (weekday === 0 || weekday === 6) return true;
  const set = await getHolidaySet(bogotaCalendarDay.getUTCFullYear());
  return set.has(ymd(bogotaCalendarDay));
}
