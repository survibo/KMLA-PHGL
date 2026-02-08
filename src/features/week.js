export function startOfWeekMonday(base = new Date()) {
  const d = new Date(base);
  const day = d.getDay(); // 0=일,1=월...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toISODate(date) {
  // date -> 'YYYY-MM-DD' (로컬 기준)
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatKoreanMD(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatWeekRange(monday) {
  const sun = addDays(monday, 6);
  return `${formatKoreanMD(monday)} ~ ${formatKoreanMD(sun)}`;
}
