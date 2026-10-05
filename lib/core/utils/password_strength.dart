import 'package:flutter/material.dart';

/// Five-tier read of how strong a password is, plus the individual
/// requirement checklist and an optional security warning — everything the
/// registration screen's live strength indicator needs in one call.
///
/// This is UI feedback only. It never persists or transmits the password
/// anywhere by itself, and it is not the source of truth for whether a
/// password is accepted — the backend re-validates independently (see
/// `backend/utils/passwordStrength.js`) since client-side checks can always
/// be bypassed.
class PasswordStrengthResult {
  const PasswordStrengthResult({
    required this.score,
    required this.label,
    required this.color,
    required this.hasMinLength,
    required this.hasUppercase,
    required this.hasLowercase,
    required this.hasNumber,
    required this.hasSpecialChar,
    required this.warning,
  });

  /// 0-6, already clamped down when [warning] is set.
  final int score;
  final String label;
  final Color color;

  final bool hasMinLength;
  final bool hasUppercase;
  final bool hasLowercase;
  final bool hasNumber;
  final bool hasSpecialChar;

  /// Set when the password is on a common-password list or looks derived
  /// from the trainee's own personal info — null when neither applies.
  final String? warning;

  bool get meetsAllRequirements =>
      hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  /// Registration is blocked unless every checklist item is met AND there's
  /// no active security warning.
  bool get isAcceptable => meetsAllRequirements && warning == null;
}

/// The ~60 most commonly used passwords (per widely published breach
/// compilations), checked both as an exact match and as a "stem" match once
/// trailing digits/symbols are stripped — so "password123" and "Password1!"
/// are caught the same as plain "password".
const _kCommonPasswords = {
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
};

String _stem(String lower) => lower.replaceAll(RegExp(r'[0-9!@#\$%^&*]+$'), '');

bool _isCommonPassword(String password) {
  final lower = password.toLowerCase();
  if (_kCommonPasswords.contains(lower)) return true;
  final stem = _stem(lower);
  return stem.length >= 4 && _kCommonPasswords.contains(stem);
}

/// True if `password` is clearly derived from one of the trainee's own
/// personal details — a 4+ character chunk shared either direction, or an
/// exact (case-insensitive) match against a whole field.
bool _isSimilarToPersonalInfo(String password, List<String> personalInfo) {
  final lower = password.toLowerCase();
  if (lower.isEmpty) return false;

  for (final raw in personalInfo) {
    final cleaned = raw.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    if (cleaned.length < 4) continue;
    if (lower == cleaned) return true;
    if (lower.contains(cleaned) || cleaned.contains(lower)) return true;
  }

  // Also check each individual word of e.g. a full name / email local-part,
  // not just the whole string glued together.
  for (final raw in personalInfo) {
    for (final word in raw.split(RegExp(r'[^a-zA-Z0-9]+'))) {
      final cleaned = word.toLowerCase();
      if (cleaned.length < 4) continue;
      if (lower.contains(cleaned)) return true;
    }
  }

  return false;
}

/// Evaluates `password` for the live strength meter. `personalInfo` should
/// be whatever the trainee has already typed elsewhere in the form (name,
/// student ID, email) so the similarity check has something to compare
/// against — pass an empty list to skip that check.
PasswordStrengthResult evaluatePasswordStrength(
  String password, {
  List<String> personalInfo = const [],
}) {
  final hasMinLength = password.length >= 8;
  final hasLongLength = password.length >= 12;
  final hasUppercase = password.contains(RegExp(r'[A-Z]'));
  final hasLowercase = password.contains(RegExp(r'[a-z]'));
  final hasNumber = password.contains(RegExp(r'[0-9]'));
  final hasSpecialChar = password.contains(RegExp(r'[^A-Za-z0-9]'));

  var score = 0;
  if (hasMinLength) score++;
  if (hasLongLength) score++;
  if (hasUppercase) score++;
  if (hasLowercase) score++;
  if (hasNumber) score++;
  if (hasSpecialChar) score++;

  String? warning;
  if (password.isNotEmpty) {
    if (_isSimilarToPersonalInfo(password, personalInfo)) {
      warning = 'This password is too similar to your personal information. '
          'Please choose a more secure password.';
    } else if (_isCommonPassword(password)) {
      warning = 'This password is commonly used. Please choose a stronger password.';
    }
  }

  // A flagged password never reads as more than "Weak" on the meter, even
  // if it happens to tick every character-class box.
  if (warning != null && score > 2) score = 2;

  final String label;
  final Color color;
  if (password.isEmpty) {
    label = '';
    color = Colors.grey;
  } else if (score <= 1) {
    label = 'Very Weak';
    color = const Color(0xFFDC2626);
  } else if (score == 2) {
    label = 'Weak';
    color = const Color(0xFFEA580C);
  } else if (score <= 4) {
    label = 'Moderate';
    color = const Color(0xFFD97706);
  } else if (score == 5) {
    label = 'Strong';
    color = const Color(0xFF65A30D);
  } else {
    label = 'Very Strong';
    color = const Color(0xFF059669);
  }

  return PasswordStrengthResult(
    score: score,
    label: label,
    color: color,
    hasMinLength: hasMinLength,
    hasUppercase: hasUppercase,
    hasLowercase: hasLowercase,
    hasNumber: hasNumber,
    hasSpecialChar: hasSpecialChar,
    warning: warning,
  );
}
