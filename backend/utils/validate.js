const mongoose = require('mongoose');
const ApiError = require('./ApiError');

function requireFields(body, fields) {
  const missing = fields.filter((f) => {
    const value = body[f];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missing.length) {
    throw ApiError.badRequest(
      `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
      { missing }
    );
  }
}

function requireOneOf(body, fields) {
  const present = fields.some((f) => body[f] !== undefined && String(body[f]).trim() !== '');
  if (!present) {
    throw ApiError.badRequest(`Provide at least one of: ${fields.join(', ')}.`);
  }
}

function assertEnum(value, allowed, fieldName) {
  if (value === undefined || value === null || value === '') return;
  if (!allowed.includes(value)) {
    throw ApiError.badRequest(
      `${fieldName} must be one of: ${allowed.join(', ')}.`
    );
  }
}

function assertObjectId(value, fieldName = 'id') {
  if (!mongoose.isValidObjectId(value)) {
    throw ApiError.badRequest(`${fieldName} is not a valid id.`);
  }
  return value;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/**
 * Stricter check used specifically wherever a NEW email is being set
 * (registration, admin-created accounts, email-change requests) — every
 * account in this system must be on the official MARSU domain. Deliberately
 * NOT used for login validation, which only checks that the typed text
 * looks like an email at all; restricting login by domain too would lock
 * out any already-existing account (including seed/test accounts) whose
 * email predates this rule.
 */
function isMarsuEmail(value) {
  return /^[^\s@]+@marsu\.edu\.ph$/i.test(String(value || '').trim());
}

/** Digits 0–9 only, at most 11 of them (e.g. 09123456789). */
const CONTACT_NUMBER_PATTERN = /^[0-9]{1,11}$/;

/**
 * Throws 400 unless `value` is a valid contact number. An empty value is
 * allowed (the field is optional) unless `required` is set. Only call this
 * where a contact number is actually being SET, so a record saved before
 * this rule existed stays editable for its other fields.
 */
function assertContactNumber(value, { required = false } = {}) {
  const raw = value === undefined || value === null ? '' : String(value);
  if (raw === '') {
    if (required) throw ApiError.badRequest('Contact number is required.');
    return;
  }
  if (!/^[0-9]+$/.test(raw)) {
    throw ApiError.badRequest(
      'Contact number must contain numbers only (0–9) — no letters, spaces, dashes or other symbols.'
    );
  }
  if (!CONTACT_NUMBER_PATTERN.test(raw)) {
    throw ApiError.badRequest('Contact number must not be longer than 11 digits.');
  }
}

module.exports = {
  assertContactNumber,
  requireFields,
  requireOneOf,
  assertEnum,
  assertObjectId,
  isValidEmail,
  isMarsuEmail,
};
