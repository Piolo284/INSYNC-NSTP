/** Date/time helpers shared by attendance and dashboard queries. */

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Combines a calendar date with an "HH:mm" string into a Date. */
function combineDateAndTime(date, hhmm) {
  const d = startOfDay(date);
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

/** "10:20 AM" — matches the format the attendance cards already display. */
function formatTime12h(date = new Date()) {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

module.exports = {
  startOfDay,
  endOfDay,
  combineDateAndTime,
  formatTime12h,
  addMinutes,
};
