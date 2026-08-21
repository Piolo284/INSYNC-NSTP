import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// The app's single [ThemeData], built to mirror the web admin panel's
/// design tokens (`admin/src/index.css`) — Poppins typography, the same
/// maroon/gold brand colors, and the same 16 / 12px corner-radius system —
/// so the mobile app and the web portal read as one product.
ThemeData buildAppTheme() {
  final base = ThemeData(useMaterial3: true, brightness: Brightness.light);

  final colorScheme = base.colorScheme.copyWith(
    primary: AppColors.primaryMaroon,
    onPrimary: AppColors.white,
    primaryContainer: AppColors.primaryLight,
    onPrimaryContainer: AppColors.white,
    secondary: AppColors.gold,
    onSecondary: AppColors.primaryDark,
    secondaryContainer: AppColors.goldLight,
    onSecondaryContainer: AppColors.primaryDark,
    surface: AppColors.cardBg,
    onSurface: AppColors.textPrimary,
    error: AppColors.error,
    onError: AppColors.white,
    outline: AppColors.border,
  );

  final textTheme = GoogleFonts.poppinsTextTheme(base.textTheme).apply(
    bodyColor: AppColors.textPrimary,
    displayColor: AppColors.textPrimary,
  );

  return base.copyWith(
    colorScheme: colorScheme,
    primaryColor: AppColors.primaryMaroon,
    scaffoldBackgroundColor: AppColors.scaffoldBg,
    textTheme: textTheme,
    primaryTextTheme: textTheme,

    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.white,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.poppins(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
      iconTheme: const IconThemeData(color: AppColors.textPrimary),
    ),

    cardTheme: CardThemeData(
      color: AppColors.cardBg,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radius),
        side: const BorderSide(color: AppColors.border),
      ),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primaryMaroon,
        foregroundColor: AppColors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
        textStyle: GoogleFonts.poppins(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
        ),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primaryMaroon,
        side: const BorderSide(color: AppColors.primaryMaroon),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
        textStyle: GoogleFonts.poppins(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
        ),
      ),
    ),

    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primaryMaroon,
        textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600),
      ),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.white,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      hintStyle: GoogleFonts.poppins(color: AppColors.textSecondary),
      labelStyle: GoogleFonts.poppins(color: AppColors.textSecondary),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        borderSide: const BorderSide(color: AppColors.primaryMaroon, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        borderSide: const BorderSide(color: AppColors.error),
      ),
    ),

    chipTheme: base.chipTheme.copyWith(
      backgroundColor: AppColors.grey100,
      labelStyle: GoogleFonts.poppins(fontSize: 12, color: AppColors.textPrimary),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
      ),
    ),

    dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1),

    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.primaryMaroon
            : AppColors.white,
      ),
    ),

    radioTheme: const RadioThemeData(
      fillColor: WidgetStatePropertyAll(AppColors.primaryMaroon),
    ),

    switchTheme: SwitchThemeData(
      thumbColor: const WidgetStatePropertyAll(AppColors.white),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.primaryMaroon
            : AppColors.grey300,
      ),
    ),

    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.primaryMaroon,
    ),

    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.textPrimary,
      contentTextStyle: GoogleFonts.poppins(color: AppColors.white),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
      ),
    ),

    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.white,
      selectedItemColor: AppColors.primaryMaroon,
      unselectedItemColor: AppColors.textSecondary,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),

    tabBarTheme: TabBarThemeData(
      labelColor: AppColors.primaryMaroon,
      unselectedLabelColor: AppColors.textSecondary,
      labelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600),
      indicatorColor: AppColors.primaryMaroon,
    ),
  );
}
