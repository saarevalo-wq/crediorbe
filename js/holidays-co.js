// Colombian public holidays and business-day arithmetic — computed
// algorithmically (Easter + Ley 51/1983 "Emiliani" Monday-shifts), no
// external API or yearly data file to maintain.
//
// All calendar-day math happens in Bogotá local time (UTC-5, no DST) so a
// judicial email that lands at 11pm UTC on a Friday is still correctly
// treated as Friday, not Saturday.

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

const holidayCache = new Map();

function colombianHolidays(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);

  const easter = easterSunday(year);

  // Fixed dates — never shifted.
  const fixed = [
    [1, 1], // Año Nuevo
    [5, 1], // Día del Trabajo
    [7, 20], // Independencia
    [8, 7], // Batalla de Boyacá
    [12, 8], // Inmaculada Concepción
    [12, 25], // Navidad
  ].map(([m, d]) => new Date(Date.UTC(year, m - 1, d)));

  // Tied to Easter, but not shifted to Monday.
  const holyWeek = [addDays(easter, -3), addDays(easter, -2)]; // Jueves y Viernes Santo

  // "Ley Emiliani" — shifted to the following Monday if not already one.
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

  const set = new Set([...fixed, ...holyWeek, ...emiliani].map(ymd));
  holidayCache.set(year, set);
  return set;
}

export function isColombianHoliday(date) {
  const day = toBogotaCalendarDay(date);
  return colombianHolidays(day.getUTCFullYear()).has(ymd(day));
}

export function isBusinessDay(date) {
  const day = toBogotaCalendarDay(date);
  const weekday = day.getUTCDay();
  if (weekday === 0 || weekday === 6) return false; // Sun/Sat
  return !colombianHolidays(day.getUTCFullYear()).has(ymd(day));
}

/**
 * Colombian judicial-term rule: the term starts running the day AFTER the
 * triggering event, counting only business days (skips weekends and
 * holidays), and lands on the Nth business day. Returns that day at 5:00pm
 * Bogotá time (17:00 -05:00), the conventional end-of-business-day cutoff.
 */
export function addBusinessDays(fromDate, n) {
  let day = addDays(toBogotaCalendarDay(fromDate), 1);
  while (isWeekendOrHoliday(day)) day = addDays(day, 1);

  let remaining = n - 1; // the first business day found above counts as day 1
  while (remaining > 0) {
    day = addDays(day, 1);
    if (!isWeekendOrHoliday(day)) remaining--;
  }

  // day is a Bogotá-midnight UTC marker; convert to 5:00pm Bogotá (=22:00 UTC).
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 22, 0, 0));
}

function isWeekendOrHoliday(bogotaCalendarDay) {
  const weekday = bogotaCalendarDay.getUTCDay();
  if (weekday === 0 || weekday === 6) return true;
  return colombianHolidays(bogotaCalendarDay.getUTCFullYear()).has(ymd(bogotaCalendarDay));
}
