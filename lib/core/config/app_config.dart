import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// Central place for every environment-dependent value.
///
/// Nothing else in the app hard-codes a host or port. To point the app at a
/// deployed API (or a MongoDB Atlas-backed server), either:
///
///   flutter run --dart-define=API_BASE_URL=https://your-api.example.com/api
///
/// or change [_defaultHost] below.
class AppConfig {
  AppConfig._();

  /// Temporary development values.
  static const String _defaultHost = 'localhost';
  static const int _defaultPort = 5000;

  /// Overridable at build time: --dart-define=API_BASE_URL=...
  static const String _apiBaseUrlOverride =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  /// Base URL of the REST API, e.g. http://localhost:5000/api
  static String get apiBaseUrl {
    if (_apiBaseUrlOverride.isNotEmpty) return _apiBaseUrlOverride;
    return '$serverBaseUrl/api';
  }

  /// Root of the server (used for /uploads/... file links).
  static String get serverBaseUrl {
    if (_apiBaseUrlOverride.isNotEmpty) {
      final uri = Uri.parse(_apiBaseUrlOverride);
      return '${uri.scheme}://${uri.authority}';
    }
    return 'http://$_host:$_defaultPort';
  }

  /// The Android emulator reaches the host machine at 10.0.2.2, not localhost.
  static String get _host {
    if (kIsWeb) return _defaultHost;
    try {
      if (Platform.isAndroid) return '10.0.2.2';
    } catch (_) {
      // Platform is unavailable on some targets; fall through to the default.
    }
    return _defaultHost;
  }

  /// Turns a relative "/uploads/..." path from the API into an absolute URL.
  static String resolveFileUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '$serverBaseUrl${path.startsWith('/') ? '' : '/'}$path';
  }

  static const Duration requestTimeout = Duration(seconds: 20);

  /// SharedPreferences keys.
  static const String tokenKey = 'auth_token';
  static const String userKey = 'auth_user';
  static const String profileKey = 'auth_profile';
}
