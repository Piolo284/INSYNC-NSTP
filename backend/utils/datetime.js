/**
 * Date/time helpers shared by attendance and dashboard queries.
 *
 * Every helper here works in Philippine Standard Time (Asia/Manila, UTC+8,
 * no DST) explicitly, instead of the server process's own timezone. The
 * backend runs both on a PC set to PHT and on Vercel (always UTC) against
 * the same database — with server-local math the same "08:00" session or
 * scan time came out 8 hours apart depending on which one handled it.
 */

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** IANA name for MongoDB `$dateToString`/`$dateTrunc` timezone options. */
const APP_TIMEZONE = 'Asia/Manila';

/** Shifts an instant so its UTC fields read as Philippine wall-clock time. */
function toPh(date) {
  return new Date(new Date(date).getTime() + PH_OFFSET_MS);
}

/** Midnight (00:00 PHT) of the Philippine calendar day containing `date`. */
function startOfDay(date) {
  const ph = toPh(date);
  return new Date(Math.floor(ph.getTime() / DAY_MS) * DAY_MS - PH_OFFSET_MS);
}

/** 23:59:59.999 PHT of the Philippine calendar day containing `date`. */
function endOfDay(date) {
  return new Date(startOfDay(date).getTime() + DAY_MS - 1);
}

/** Combines a calendar date with an "HH:mm" string (Philippine time) into a Date. */
function combineDateAndTime(date, hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return new Date(
    startOfDay(date).getTime() +
      (Number.isFinite(h) ? h : 0) * 60 * 60 * 1000 +
      (Number.isFinite(m) ? m : 0) * 60 * 1000
  );
}

/** "10:20 AM" in Philippine time — the format the attendance cards display. */
function formatTime12h(date = new Date()) {
  const ph = toPh(date);
  let hours = ph.getUTCHours();
  const minutes = String(ph.getUTCMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

module.exports = {
  APP_TIMEZONE,
  startOfDay,
  endOfDay,
  combineDateAndTime,
  formatTime12h,
  addMinutes,
};
