import { store } from "../state.js";
import { escapeHtml, tagClass } from "../util.js";

const monthLabel = document.getElementById("cal-month-label");
const weekdayRow = document.getElementById("cal-weekday-row");
const gridEl = document.getElementById("cal-grid");
const dayDetailEl = document.getElementById("cal-day-detail");
const prevBtn = document.getElementById("cal-prev");
const nextBtn = document.getElementById("cal-next");

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"]; // Monday-start
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

let onOpenItem = () => {};
let selectedKey = null;

// All calendar math is anchored to Bogotá's calendar day (UTC-5, no DST),
// independent of the viewer's own device timezone — deadlines were computed
// in Bogotá time (see holidays-co.js), so the calendar that shows them has
// to agree with that, not with wherever the phone happens to be set.
function bogotaNow() {
  return new Date(Date.now() - 5 * 3600_000);
}
function bogotaDateKey(iso) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
  return dateKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function firstWeekdayOfMonth(year, month) {
  const day = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=Sun..6=Sat
  return (day + 6) % 7; // Mon=0..Sun=6
}
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const today = bogotaNow();
let viewYear = today.getUTCFullYear();
let viewMonth = today.getUTCMonth();
const todayKey = dateKey(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

export function initCalendario({ onOpenItem: openHandler }) {
  onOpenItem = openHandler;

  weekdayRow.innerHTML = WEEKDAYS.map((w) => `<span>${w}</span>`).join("");

  prevBtn.addEventListener("click", () => changeMonth(-1));
  nextBtn.addEventListener("click", () => changeMonth(1));

  gridEl.addEventListener("click", (e) => {
    const cell = e.target.closest(".cal-cell:not(.empty)");
    if (!cell) return;
    selectedKey = selectedKey === cell.dataset.key ? null : cell.dataset.key;
    render();
  });

  dayDetailEl.addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (card) onOpenItem(card.dataset.id);
  });

  store.subscribe(render);
  render();
}

function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
  if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
  selectedKey = null;
  render();
}

function itemsByDay() {
  const map = new Map();
  for (const item of store.items) {
    if (!item.deadline) continue;
    const key = bogotaDateKey(item.deadline);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function render() {
  monthLabel.textContent = capitalize(`${MONTH_NAMES[viewMonth]} ${viewYear}`);

  const map = itemsByDay();
  const leading = firstWeekdayOfMonth(viewYear, viewMonth);
  const total = daysInMonth(viewYear, viewMonth);

  let cells = "";
  for (let i = 0; i < leading; i++) cells += `<div class="cal-cell empty"></div>`;

  for (let day = 1; day <= total; day++) {
    const key = dateKey(viewYear, viewMonth, day);
    const dayItems = map.get(key) || [];
    const hasUrgent = dayItems.some((i) => i.urgency === "URGENTE" || i.urgency === "ALTA");
    const classes = ["cal-cell"];
    if (key === todayKey) classes.push("today");
    if (key === selectedKey) classes.push("selected");
    cells += `
      <button type="button" class="${classes.join(" ")}" data-key="${key}">
        <span>${day}</span>
        ${dayItems.length ? `<span class="cal-dot${hasUrgent ? " urgent" : ""}"></span>` : ""}
      </button>`;
  }

  gridEl.innerHTML = cells;
  renderDayDetail(map);
}

function renderDayDetail(map) {
  if (!selectedKey) {
    dayDetailEl.innerHTML = "";
    return;
  }
  const items = (map.get(selectedKey) || []).sort((a, b) => a.urgency.localeCompare(b.urgency));
  const [y, m, d] = selectedKey.split("-").map(Number);
  const label = capitalize(`${WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} de ${MONTH_NAMES[m - 1]}`);

  if (items.length === 0) {
    dayDetailEl.innerHTML = `<p class="cal-day-detail-title">${escapeHtml(label)}</p><div class="empty-state">No hay procesos pendientes este día.</div>`;
    return;
  }

  dayDetailEl.innerHTML = `
    <p class="cal-day-detail-title">${escapeHtml(label)}</p>
    <div class="process-list">
      ${items
        .map(
          (item) => `
        <article class="process-card" data-id="${escapeHtml(item.id)}">
          <div class="process-top-row">
            <span class="tag ${tagClass(item.urgency)}">${escapeHtml(item.urgency)} · ${escapeHtml(item.type)}</span>
          </div>
          <h4 class="process-title">${escapeHtml(item.counterparty)}</h4>
          <p class="process-summary">${escapeHtml(item.summary)}</p>
        </article>`
        )
        .join("")}
    </div>`;
}
