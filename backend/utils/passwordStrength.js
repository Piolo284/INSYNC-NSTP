const ApiError = require('./ApiError');

/**
 * Server-side mirror of lib/core/utils/password_strength.dart's rules. The
 * mobile app's live strength meter is UI feedback only and can always be
 * bypassed (a modified client, a direct API call) — this is the actual
 * enforcement point. Every password-setting endpoint (register,
 * change-password, reset-password) must call `assertStrongPassword` before
 * persisting anything.
 */

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  '1234567890', 'qwerty', 'qwerty123', 'qwertyuiop', 'letmein', 'welcome',
  'welcome1', 'admin', 'admin123', 'iloveyou', 'sunshine', 'princess',
  'football', 'baseball', 'basketball', 'dragon', 'monkey', 'shadow',
  'master', 'superman', 'trustno1', 'abc123', 'abcd1234', 'passw0rd',
  '11111111', '00000000', 'starwars', 'freedom', 'whatever', '666666',
  '123123', '1q2w3e4r', 'zaq12wsx', 'michael', 'jennifer', 'jordan23',
  'hunter2', 'batman', 'ninja', 'mustang', 'access', 'flower', 'summer',
  'winter', 'chicken', 'george', 'charlie', 'donald', 'password12',
  'p@ssword', 'p@ssw0rd', 'qazwsx', 'zxcvbnm', 'asdfghjk', 'iloveyou1',
]);

function stem(lower) {
  return lower.replace(/[0-9!@#$%^&*]+$/, '');
}

function isCommonPassword(password) {
  const lower = String(password).toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  const s = stem(lower);
  return s.length >= 4 && COMMON_PASSWORDS.has(s);
}

/**
 * True if `password` is clearly derived from one of `personalInfo`'s
 * strings (name, student ID, email, etc.) — a 4+ character chunk shared
 * either direction, or an exact case-insensitive match.
 */
function isSimilarToPersonalInfo(password, personalInfo = []) {
  const lower = String(password).toLowerCase();
  if (!lower) return false;

  for (const raw of personalInfo) {
    const cleaned = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleaned.length < 4) continue;
    if (lower === cleaned) return true;
    if (lower.includes(cleaned) || cleaned.includes(lower)) return true;
  }

  for (const raw of personalInfo) {
    for (const word of String(raw || '').split(/[^a-zA-Z0-9]+/)) {
      const cleaned = word.toLowerCase();
      if (cleaned.length < 4) continue;
      if (lower.includes(cleaned)) return true;
    }
  }

  return false;
}

function meetsCharacterRequirements(password) {
  const p = String(password);
  return (
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^A-Za-z0-9]/.test(p)
  );
}

/**
 * Throws a 400 with the same wording the mobile app already shows inline,
 * so a validation failure that somehow reaches the server still reads as
 * one consistent message rather than a generic "bad request".
 */
function assertStrongPassword(password, personalInfo = []) {
  if (!meetsCharacterRequirements(password)) {
    throw ApiError.badRequest(
      'Password must be at least 8 characters and include an uppercase letter, ' +
        'a lowercase letter, a number, and a special character.'
    );
  }
  if (isSimilarToPersonalInfo(password, personalInfo)) {
    throw ApiError.badRequest(
      'This password is too similar to your personal information. Please choose a more secure password.'
    );
  }
  if (isCommonPassword(password)) {
    throw ApiError.badRequest('This password is commonly used. Please choose a stronger password.');
  }
}

module.exports = {
  meetsCharacterRequirements,
  isCommonPassword,
  isSimilarToPersonalInfo,
  assertStrongPassword,
};
