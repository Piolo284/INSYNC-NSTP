import 'dart:io' show Platform;

import 'api_service.dart';
import 'session.dart';

/// Login / register / profile. Everything that used to be a fake
/// `Navigator.pushReplacement` now goes through here.
class AuthService {
  AuthService._();

  static final AuthService instance = AuthService._();
  final ApiService _api = ApiService.instance;

  /// A rough device label/platform sent at login/register so the "Login
  /// Devices"/"Active Sessions" list has something meaningful to show —
  /// this app has no device-info plugin, so it's derived from [Platform]
  /// alone (falls back to "Web Browser" if [Platform] itself is unavailable,
  /// e.g. on a web build).
  Map<String, String> _deviceInfo() {
    try {
      if (Platform.isAndroid) return const {'platform': 'android', 'deviceLabel': 'Android Device'};
      if (Platform.isIOS) return const {'platform': 'ios', 'deviceLabel': 'iOS Device'};
      if (Platform.isWindows) return const {'platform': 'windows', 'deviceLabel': 'Windows Device'};
      if (Platform.isMacOS) return const {'platform': 'macos', 'deviceLabel': 'Mac Device'};
      if (Platform.isLinux) return const {'platform': 'linux', 'deviceLabel': 'Linux Device'};
    } catch (_) {
      // dart:io Platform isn't available on a web build.
    }
    return const {'platform': 'web', 'deviceLabel': 'Web Browser'};
  }

  /// [identifier] is a student/cadet ID or an email address.
  /// [expectedRole] guards each portal (a trainee cannot enter the officer shell).
  ///
  /// Returns the response's `data` map either way. When the account has
  /// two-factor login on, no token is issued yet — the map instead comes
  /// back as `{requiresTwoFactor: true, identifier: ...}` and the caller
  /// must route to the code-entry screen and call [verifyTwoFactor] next,
  /// rather than treating this call itself as a completed login.
  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
    String? expectedRole,
  }) async {
    final device = _deviceInfo();
    final response = await _api.post('/auth/login', body: {
      'identifier': identifier.trim(),
      'password': password,
      'role': ?expectedRole,
      'deviceLabel': device['deviceLabel'],
      'platform': device['platform'],
    });

    final data = ApiService.mapOf(response);
    if (data['requiresTwoFactor'] == true) return data;
    return _persist(response);
  }

  /// Second step of a two-factor login — the code [login] just emailed.
  Future<Map<String, dynamic>> verifyTwoFactor({
    required String identifier,
    required String code,
  }) async {
    final device = _deviceInfo();
    final response = await _api.post('/auth/2fa/verify', body: {
      'identifier': identifier.trim(),
      'code': code.trim(),
      'deviceLabel': device['deviceLabel'],
      'platform': device['platform'],
    });
    return _persist(response);
  }

  /// Step-1 registration pre-check: verifies Student Number/Name/Course
  /// against the official NSTP masterlist WITHOUT creating an account, so
  /// the registration screen can block "Next" immediately on a mismatch
  /// instead of only failing after every later step is filled in. Throws
  /// an [ApiException] (via ApiService) on a mismatch — same error surface
  /// as every other call here.
  Future<void> validateEnrollment({
    required String studentId,
    required String name,
    required String course,
    required String program,
  }) async {
    await _api.post('/auth/validate-enrollment', body: {
      'studentId': studentId.trim(),
      'name': name.trim(),
      'course': course,
      'program': program,
    });
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    required String studentId,
    required String program,
    String course = '',
    String yearLevel = '',
    String section = '',
    String contactNumber = '',
    String specialCategory = 'None',
    String campus = '',
  }) async {
    final device = _deviceInfo();
    final response = await _api.post('/auth/register', body: {
      'name': name.trim(),
      'email': email.trim(),
      'password': password,
      'studentId': studentId.trim(),
      'program': program,
      'course': course,
      'yearLevel': yearLevel,
      'section': section,
      'contactNumber': contactNumber,
      'specialCategory': specialCategory,
      'campus': campus,
      'deviceLabel': device['deviceLabel'],
      'platform': device['platform'],
    });

    return _persist(response);
  }

  /// Re-reads the signed-in user from the API (used after profile edits).
  Future<Map<String, dynamic>> refresh() async {
    final response = await _api.get('/auth/me');
    final data = ApiService.mapOf(response);
    final user = (data['user'] as Map?)?.cast<String, dynamic>();
    final profile = (data['profile'] as Map?)?.cast<String, dynamic>();
    if (user != null) {
      await Session.instance.save(user: user, profile: profile);
    }
    return data;
  }

  /// Files a forgot-password request. This does NOT reset anything by
  /// itself — a system_maintenance_admin manually reviews and approves it
  /// in the admin panel before a reset code is emailed (see
  /// [resetPassword] below). Returns the raw response so the screen can
  /// show the server's own confirmation message.
  Future<Map<String, dynamic>> forgotPassword({
    required String identifier,
    required String reason,
  }) {
    return _api.post('/auth/forgot-password', body: {
      'identifier': identifier.trim(),
      'reason': reason.trim(),
    });
  }

  /// Final step once the trainee has the code emailed after admin approval.
  Future<Map<String, dynamic>> resetPassword({
    required String identifier,
    required String resetCode,
    required String newPassword,
  }) {
    return _api.post('/auth/reset-password', body: {
      'identifier': identifier.trim(),
      'resetCode': resetCode.trim(),
      'newPassword': newPassword,
    });
  }

  /// Admin-panel-style one-step password change (kept for completeness; the
  /// mobile trainee/officer flow uses [requestPasswordChange] +
  /// [confirmPasswordChange] instead so an emailed code is required first).
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _api.put('/auth/password', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  /// Step 1 of the mobile app's self-service password change — a code is
  /// emailed to the account's registered address to confirm it's really the
  /// owner before the new password takes effect (see [confirmPasswordChange]).
  /// Returns the server's own confirmation message to show the user.
  Future<String> requestPasswordChange({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await _api.post('/auth/password/request-change', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
    return (response['message'] ?? '').toString();
  }

  Future<void> confirmPasswordChange(String code) async {
    await _api.post('/auth/password/confirm', body: {'code': code.trim()});
  }

  /// Applies an update to the locally cached user map (e.g. after changing
  /// email/contact number/2FA) without touching the cached profile map.
  Future<void> _saveUserUpdate(Map<String, dynamic> response) async {
    final data = ApiService.mapOf(response);
    final user = (data['user'] as Map?)?.cast<String, dynamic>();
    if (user != null) {
      await Session.instance.save(user: user, profile: Session.instance.profile);
    }
  }

  /// Step 1 of changing the account's email — a code is emailed to the NEW
  /// address to confirm ownership of it (see [confirmEmailChange]). Returns
  /// the server's own confirmation message to show the trainee.
  Future<String> requestEmailChange(String newEmail) async {
    final response = await _api.post('/auth/email/request-change', body: {'newEmail': newEmail.trim()});
    return (response['message'] ?? '').toString();
  }

  Future<void> confirmEmailChange(String code) async {
    final response = await _api.post('/auth/email/confirm', body: {'code': code.trim()});
    await _saveUserUpdate(response);
  }

  /// Step 1 of changing the account's contact number. There's no SMS
  /// provider in this app, so the new number can't itself be verified —
  /// the code instead goes to the trainee's current registered email, to
  /// confirm it's really the account owner making the request.
  Future<String> requestContactNumberChange(String newContactNumber) async {
    final response = await _api.post('/auth/contact-number/request-change', body: {
      'newContactNumber': newContactNumber.trim(),
    });
    return (response['message'] ?? '').toString();
  }

  Future<void> confirmContactNumberChange(String code) async {
    final response = await _api.post('/auth/contact-number/confirm', body: {'code': code.trim()});
    await _saveUserUpdate(response);
  }

  /// Toggling two-factor re-checks the current password — a security-
  /// sensitive setting shouldn't flip just because a phone was left unlocked.
  Future<void> setTwoFactorEnabled({required bool enable, required String currentPassword}) async {
    final response = await _api.put('/auth/2fa', body: {
      'enable': enable,
      'currentPassword': currentPassword,
    });
    await _saveUserUpdate(response);
  }

  /// Backs both "Login Devices" and "Active Sessions" — the same list.
  Future<List<Map<String, dynamic>>> listSessions() async {
    final response = await _api.get('/auth/sessions');
    return ApiService.listOf(response);
  }

  /// Logs out one specific device (not necessarily this one).
  Future<void> revokeSession(String id) => _api.delete('/auth/sessions/$id');

  /// "Logout All Devices" — including this one; the caller is expected to
  /// clear the local session and return to the login screen right after.
  Future<void> revokeAllSessions() => _api.post('/auth/sessions/logout-all');

  Future<void> logout() async {
    await _api.setToken(null);
    await Session.instance.clear();
  }

  /// Restores a saved session at start-up. Returns the role, or '' if none.
  Future<String> restoreSession() async {
    await _api.loadToken();
    if (!_api.isAuthenticated) return '';
    final restored = await Session.instance.restore();
    return restored ? Session.instance.role : '';
  }

  Future<Map<String, dynamic>> _persist(Map<String, dynamic> response) async {
    final data = ApiService.mapOf(response);
    final token = data['token']?.toString();
    final user = (data['user'] as Map?)?.cast<String, dynamic>();
    final profile = (data['profile'] as Map?)?.cast<String, dynamic>();

    if (token != null && token.isNotEmpty) {
      await _api.setToken(token);
    }
    if (user != null) {
      await Session.instance.save(user: user, profile: profile);
    }
    return data;
  }
}
