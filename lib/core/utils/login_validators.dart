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
