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

module.exports = {
  requireFields,
  requireOneOf,
  assertEnum,
  assertObjectId,
  isValidEmail,
};
