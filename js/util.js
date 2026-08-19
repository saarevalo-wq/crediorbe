export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function relativeTime(iso) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export function deadlineLabel(iso) {
  if (!iso) return "Sin plazo detectado";
  const deadline = new Date(iso);
  const now = new Date();
  const isToday = deadline.toDateString() === now.toDateString();
  if (isToday) {
    return `Hoy · ${deadline.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`;
  }
  const days = Math.round((deadline.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / 86_400_000);
  if (days < 0) return "Vencido";
  if (days === 0) return "Hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
}

/** "Cuántos días faltan" countdown for the Procesos tab. */
export function daysRemainingLabel(iso) {
  if (!iso) return "Sin plazo detectado";
  const deadlineDay = new Date(iso);
  deadlineDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((deadlineDay - today) / 86_400_000);
  if (days < 0) return days === -1 ? "Vencido hace 1 día" : `Vencido hace ${-days} días`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Falta 1 día";
  return `Faltan ${days} días`;
}

export function tagClass(urgency) {
  return { URGENTE: "tag-accent", ALTA: "tag-accent-2", MEDIA: "tag-neutral", BAJA: "tag-outline" }[urgency] || "tag-neutral";
}
