import 'package:flutter/services.dart';

/// Contact numbers are digits 0–9 only, at most 11 of them
/// (e.g. 09123456789) — same rule the backend enforces
/// (backend/utils/validate.js assertContactNumber).
const int contactNumberMaxLength = 11;

/// Stops anything but digits from being typed or pasted, and caps the
/// length at 11 — so most invalid input can't even be entered.
final List<TextInputFormatter> contactNumberInputFormatters = [
  FilteringTextInputFormatter.digitsOnly,
  LengthLimitingTextInputFormatter(contactNumberMaxLength),
];

/// Returns an error message, or null when [value] is valid. Empty is
/// allowed unless [required] is true.
String? validateContactNumber(String? value, {bool required = false}) {
  final raw = value ?? '';
  if (raw.isEmpty) return required ? 'Contact number is required.' : null;
  if (!RegExp(r'^[0-9]+$').hasMatch(raw)) {
    return 'Use numbers only (0–9) — no letters, spaces, dashes or symbols.';
  }
  if (raw.length > contactNumberMaxLength) {
    return 'Contact number must not be longer than $contactNumberMaxLength digits.';
  }
  return null;
}
