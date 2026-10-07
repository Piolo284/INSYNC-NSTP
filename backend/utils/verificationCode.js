const crypto = require('crypto');
const ApiError = require('./ApiError');

/** Wrong guesses allowed per code before it is thrown away. */
const MAX_CODE_ATTEMPTS = 5;

/** Cryptographically random 6-digit code ("000000"–"999999"). */
const sixDigit = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * The API message after a code has been emailed. The code itself is NEVER
 * part of any response — it only ever travels by email.
 *
 * With no SMTP configured (SMTP_HOST empty in backend/.env) nothing can be
 * delivered: in production that's an error the user must hear about; on a
 * local development server the mailer prints the email to the backend
 * console instead, so the developer can still test the flow from there.
 */
function codeSentMessage(mail, destination = 'your registered email') {
  if (mail && mail.delivered) return `A verification code was sent to ${destination}.`;
  if (isProduction()) {
    throw new ApiError(
      503,
      'Verification emails cannot be sent right now because the email service is not configured. Please contact your administrator.'
    );
  }
  return (
    `Email is not configured on this server yet (SMTP_HOST is empty), so the code for ${destination} ` +
    'was only printed in the backend console for development testing.'
  );
}

/**
 * Checks `input` against a code stored on `doc` under `codeField`, with an
 * expiry under `expiresField` and a wrong-guess counter under
 * `attemptsField`. After MAX_CODE_ATTEMPTS wrong guesses the code is wiped,
 * so it can't be brute-forced — the user must request a new one.
 *
 * On success the code, expiry and counter are cleared (not saved — the
 * caller saves along with whatever else it changes). On failure the
 * counter is saved here before throwing.
 */
async function checkCode(doc, { codeField, expiresField, attemptsField, input, restartHint = 'Please request a new one.' }) {
  const stored = doc[codeField];
  if (!stored) {
    throw ApiError.badRequest(`There is no pending verification code. ${restartHint}`);
  }

  const clear = () => {
    doc[codeField] = null;
    doc[expiresField] = null;
    if (attemptsField) doc[attemptsField] = 0;
  };

  if (doc[expiresField] && doc[expiresField] < new Date()) {
    clear();
    await doc.save();
    throw ApiError.badRequest(`This code has expired. ${restartHint}`);
  }

  const given = Buffer.from(String(input || '').trim());
  const expected = Buffer.from(String(stored));
  const matches = given.length === expected.length && crypto.timingSafeEqual(given, expected);

  if (!matches) {
    const attempts = (doc[attemptsField] || 0) + 1;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      clear();
      await doc.save();
      throw new ApiError(429, `Too many incorrect attempts. ${restartHint}`);
    }
    doc[attemptsField] = attempts;
    await doc.save();
    const left = MAX_CODE_ATTEMPTS - attempts;
    throw ApiError.badRequest(`Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`);
  }

  clear();
}

module.exports = { MAX_CODE_ATTEMPTS, sixDigit, codeSentMessage, checkCode };
