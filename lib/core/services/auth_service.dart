import 'api_service.dart';
import 'session.dart';

/// Login / register / profile. Everything that used to be a fake
/// `Navigator.pushReplacement` now goes through here.
class AuthService {
  AuthService._();

  static final AuthService instance = AuthService._();
  final ApiService _api = ApiService.instance;

  /// [identifier] is a student/cadet ID or an email address.
  /// [expectedRole] guards each portal (a trainee cannot enter the officer shell).
  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
    String? expectedRole,
  }) async {
    final response = await _api.post('/auth/login', body: {
      'identifier': identifier.trim(),
      'password': password,
      if (expectedRole != null) 'role': expectedRole,
    });

    return _persist(response);
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
  }) async {
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

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _api.put('/auth/password', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

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
