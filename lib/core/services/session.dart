import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

/// The signed-in user, cached in memory and mirrored to SharedPreferences so a
/// restart does not force a fresh login.
class Session {
  Session._();

  static final Session instance = Session._();

  Map<String, dynamic>? _user;
  Map<String, dynamic>? _profile;

  Map<String, dynamic>? get user => _user;
  Map<String, dynamic>? get profile => _profile;

  bool get isSignedIn => _user != null;

  String get userId => (_user?['_id'] ?? '').toString();
  String get name => (_user?['name'] ?? '').toString();
  String get email => (_user?['email'] ?? '').toString();
  String get role => (_user?['role'] ?? '').toString();
  String get program => (_user?['program'] ?? 'CWTS').toString();

  /// Student number / cadet number / employee number.
  String get idNumber => (_user?['studentId'] ?? '').toString();

  String get yearLevel =>
      (_profile?['yearLevel'] ?? _user?['yearLevel'] ?? '').toString();
  String get section =>
      (_profile?['section'] ?? _user?['section'] ?? '').toString();
  String get course => (_profile?['course'] ?? '').toString();
  String get brigade => (_profile?['brigade'] ?? '').toString();
  String get profileImage =>
      (_profile?['profileImage'] ?? _user?['profileImage'] ?? '').toString();

  bool get isTrainee => role == 'student' || role == 'cadet';
  bool get isStaff => role == 'officer' || role == 'instructor' || role == 'admin';

  Future<void> save({
    required Map<String, dynamic> user,
    Map<String, dynamic>? profile,
  }) async {
    _user = user;
    _profile = profile;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConfig.userKey, jsonEncode(user));
    if (profile != null) {
      await prefs.setString(AppConfig.profileKey, jsonEncode(profile));
    } else {
      await prefs.remove(AppConfig.profileKey);
    }
  }

  /// Restores a previous session from disk. Returns true when one was found.
  Future<bool> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final rawUser = prefs.getString(AppConfig.userKey);
    if (rawUser == null) return false;

    try {
      _user = jsonDecode(rawUser) as Map<String, dynamic>;
      final rawProfile = prefs.getString(AppConfig.profileKey);
      _profile = rawProfile == null
          ? null
          : jsonDecode(rawProfile) as Map<String, dynamic>;
      return true;
    } catch (_) {
      await clear();
      return false;
    }
  }

  Future<void> clear() async {
    _user = null;
    _profile = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConfig.userKey);
    await prefs.remove(AppConfig.profileKey);
  }
}
