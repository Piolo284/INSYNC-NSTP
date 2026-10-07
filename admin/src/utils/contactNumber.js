// Contact numbers are digits 0–9 only, at most 11 of them (e.g. 09123456789)
// — the same rule the backend enforces (backend/utils/validate.js).
export const CONTACT_NUMBER_MAX_LENGTH = 11;

/** Strips anything that isn't a digit and caps the length, so invalid
 * characters can't be typed or pasted into the field. */
export function sanitizeContactNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, CONTACT_NUMBER_MAX_LENGTH);
}

/** Error message, or '' when valid. Empty is allowed (optional field). */
export function contactNumberError(value) {
  const raw = String(value || '');
  if (!raw) return '';
  if (!/^[0-9]+$/.test(raw)) {
    return 'Contact number must contain numbers only (0–9) — no letters, spaces, dashes or symbols.';
  }
  if (raw.length > CONTACT_NUMBER_MAX_LENGTH) {
    return `Contact number must not be longer than ${CONTACT_NUMBER_MAX_LENGTH} digits.`;
  }
  return '';
}
