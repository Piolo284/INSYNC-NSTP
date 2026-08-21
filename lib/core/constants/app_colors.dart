import 'package:flutter/material.dart';

/// Colors here intentionally mirror the CSS variables in
/// `admin/src/index.css` (the web admin panel) value-for-value, so the
/// mobile app and the web portal read as one system. Field *names* were kept
/// stable across the rebrand — only the hex values changed — so this file
/// stays the single place to retouch the palette without hunting through
/// every screen that already references `AppColors.xxx`.
class AppColors {
  AppColors._();

  // Brand — matches --maroon / --maroon-dark / --sidebar-active.
  static const Color primaryMaroon = Color(0xFF7B1F1F);
  static const Color primaryDark = Color(0xFF4A0404);
  static const Color primaryLight = Color(0xFF5D1A1A);

  // --gold / --gold-light.
  static const Color gold = Color(0xFFD4AF37);
  static const Color goldLight = Color(0xFFF4E4BC);

  static const Color cwtsAccent = Color(0xFFF5C518);
  static const Color cwtsCardBg = Color(0xFFFFF3E0);

  static const Color rotcGold = Color(0xFFC9A227);

  // --bg / --card-bg / --text-primary / --text-secondary / --border.
  static const Color scaffoldBg = Color(0xFFF3F4F6);
  static const Color textPrimary = Color(0xFF111827);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color border = Color(0xFFE5E7EB);

  static const Color white = Color(0xFFFFFFFF);
  static const Color black = Color(0xFF000000);
  static const Color grey50 = Color(0xFFFAFAFA);
  static const Color grey100 = Color(0xFFF5F5F5);
  static const Color grey200 = Color(0xFFEEEEEE);
  static const Color grey300 = Color(0xFFE0E0E0);
  static const Color grey400 = Color(0xFFBDBDBD);
  static const Color grey500 = Color(0xFF9E9E9E);
  static const Color grey600 = Color(0xFF757575);
  static const Color grey700 = Color(0xFF616161);
  static const Color grey800 = Color(0xFF424242);
  static const Color grey900 = Color(0xFF8B7E72);

  // --orange-text / --orange-banner / --orange-border (the admin panel's
  // "warning"/at-risk styling).
  static const Color warning = Color(0xFF9A3412);
  static const Color cardBg = Color(0xFFFFFFFF);
  // --red-status.
  static const Color error = Color(0xFF991B1B);
  static const Color errorLight = Color(0xFFFEE2E2);

  static const Color success = Color(0xFF4CAF50);
  static const Color greenLight = Color(0xFFE8F5E9);

  static const Color blue = Color(0xFF1565C0);
  static const Color blueLight = Color(0xFFE3F2FD);

  static const Color orange = Color(0xFFF57C00);
  static const Color orangeLight = Color(0xFFFFF7ED);

  static const Color cyan = Color(0xFF00ACC1);
  static const Color cyanLight = Color(0xFFE0F7FA);

  static const Color purple = Color(0xFFAB47BC);
  static const Color purpleLight = Color(0xFFF3E5F5);

  static const Color pink = Color(0xFFC2185B);
  static const Color pinkLight = Color(0xFFFCE4EC);

  // --radius / --radius-sm.
  static const double radius = 16;
  static const double radiusSm = 12;
}