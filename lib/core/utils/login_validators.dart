class LoginValidators {
  static bool isValidEmail(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return false;
    }

    final emailRegex = RegExp(
      r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$",
    );

    return emailRegex.hasMatch(trimmed);
  }

  /// Stricter check used specifically wherever a NEW email is being set
  /// (registration, "change email") — every account in this system must be
  /// on the official MARSU domain. Deliberately separate from
  /// [isValidEmail], which login screens use and must keep accepting
  /// whatever domain an already-existing account was created with.
  static bool isMarsuEmail(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return false;
    return RegExp(r'^[^\s@]+@marsu\.edu\.ph$', caseSensitive: false).hasMatch(trimmed);
  }

  static bool isStrongPassword(String value) {
    final trimmed = value.trim();
    if (trimmed.length < 8) {
      return false;
    }

    if (!trimmed.contains(RegExp(r'[A-Z]'))) {
      return false;
    }

    if (!trimmed.contains(RegExp(r'[0-9]'))) {
      return false;
    }

    if (!trimmed.contains(RegExp(r'[^A-Za-z0-9]'))) {
      return false;
    }

    return true;
  }
}
