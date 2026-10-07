import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

/// The signed-in user, cached in memory and mirrored to secure storage so a
/// restart does not force a fresh login.
class Session {
  Session._();

  static final Session instance = Session._();
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();

  Map<String, dynamic>? _user;
  Map<String, dynamic>? _profile;

  /// Bumped every time the cached user/profile changes (e.g. a new profile
  /// photo), so screens that stay alive — the dashboard header inside the
  /// shell's IndexedStack — can rebuild without a reload.
  final ValueNotifier<int> changes = ValueNotifier<int>(0);

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

  /// PWD / SK Chairperson / Medical Condition / None — collected at
  /// registration, only ever set on a trainee's profile.
  String get specialCategory =>
      (_profile?['specialCategory'] ?? 'None').toString();

  /// True for a cadet whose specialCategory means they physically cannot
  /// undergo field training/drills (PWD or Medical Condition — NOT SK
  /// Chairperson, which is a civic-duty exemption, not a physical one).
  /// Routes them to the dedicated Inclusive Learning Section shell
  /// (RotcSpecialMainShell) instead of the regular one. ROTC only — CWTS has
  /// no physically-demanding requirement this track was designed to exempt
  /// someone from, so a CWTS student is never routed there regardless of
  /// their specialCategory. See backend utils/specialClass.js, which
  /// enforces this same rule server-side.
  bool get isSpecialClassTrainee =>
      role == 'cadet' &&
      (specialCategory == 'PWD' || specialCategory == 'Medical Condition');

  /// True for the ROTC officer assigned to handle the Inclusive Learning
  /// Section — set on the Officer profile by admin_rotc/super_admin. Only
  /// meaningful when role == 'officer' && program == 'ROTC'; the backend
  /// never allows this to be set true for a CWTS officer.
  bool get isSpecialClassOfficer =>
      program == 'ROTC' && _profile?['isSpecialClassOfficer'] == true;

  bool get isTrainee => role == 'student' || role == 'cadet';
  bool get isStaff => role == 'officer';

  /// Brigade Commander / Platoon Leader / Attendance Officer — only
  /// meaningful when role == 'officer'. See backend/config/constants.js
  /// OFFICER_POSITIONS for the exact values per program.
  String get position => (_profile?['position'] ?? '').toString();

  /// True for an officer whose sole responsibility is Attendance — the app
  /// scopes their shell/drawer down to just that feature rather than the
  /// full officer menu, since they were never given management duties.
  bool get isAttendanceOnlyOfficer => role == 'officer' && position == 'Attendance Officer';

  Future<void> save({
    required Map<String, dynamic> user,
    Map<String, dynamic>? profile,
  }) async {
    _user = user;
    _profile = profile;
    changes.value++;

    await _secureStorage.write(
      key: AppConfig.userKey,
      value: jsonEncode(user),
    );
    if (profile != null) {
      await _secureStorage.write(
        key: AppConfig.profileKey,
        value: jsonEncode(profile),
      );
    } else {
      await _secureStorage.delete(key: AppConfig.profileKey);
    }
  }

  /// Restores a previous session from disk. Returns true when one was found.
  ///
  /// The cached user/profile now lives in secure storage. The first time
  /// this runs after that change, it may still find the old plaintext
  /// SharedPreferences copy — if so, it is moved over once and the
  /// plaintext copy is cleared.
  Future<bool> restore() async {
    var rawUser = await _secureStorage.read(key: AppConfig.userKey);
    var rawProfile = await _secureStorage.read(key: AppConfig.profileKey);

    if (rawUser == null) {
      final prefs = await SharedPreferences.getInstance();
      final legacyUser = prefs.getString(AppConfig.userKey);
      if (legacyUser == null) return false;

      rawUser = legacyUser;
      rawProfile = prefs.getString(AppConfig.profileKey);
      await _secureStorage.write(key: AppConfig.userKey, value: rawUser);
      if (rawProfile != null) {
        await _secureStorage.write(
          key: AppConfig.profileKey,
          value: rawProfile,
        );
      }
      await prefs.remove(AppConfig.userKey);
      await prefs.remove(AppConfig.profileKey);
    }

    try {
      _user = jsonDecode(rawUser) as Map<String, dynamic>;
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
    changes.value++;
    await _secureStorage.delete(key: AppConfig.userKey);
    await _secureStorage.delete(key: AppConfig.profileKey);
  }
}
