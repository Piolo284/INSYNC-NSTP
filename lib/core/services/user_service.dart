import 'api_service.dart';
import 'session.dart';

/// Users, students and cadets — the rosters the officer/admin
/// screens read from.
class UserService {
  UserService._();

  static final UserService instance = UserService._();
  final ApiService _api = ApiService.instance;

  // ---- Students (CWTS) ----

  /// Returns `{ stats: {...}, data: [...] }`.
  Future<Map<String, dynamic>> students({
    String? search,
    String? status,
    String? section,
    String? brigade,
  }) async {
    final response = await _api.get('/students', query: {
      'search': search,
      'status': status,
      'section': section,
      'brigade': brigade,
    });
    return {
      'stats': (response['stats'] as Map?)?.cast<String, dynamic>() ?? {},
      'data': ApiService.listOf(response),
    };
  }

  Future<Map<String, dynamic>> student([String? id]) async {
    final response = await _api.get('/students/${id ?? Session.instance.userId}');
    return ApiService.mapOf(response);
  }

  // ---- Cadets (ROTC) ----

  Future<Map<String, dynamic>> cadets({String? search, String? status}) async {
    final response = await _api.get('/cadets', query: {
      'search': search,
      'status': status,
    });
    return {
      'stats': (response['stats'] as Map?)?.cast<String, dynamic>() ?? {},
      'data': ApiService.listOf(response),
    };
  }

  /// Registered ROTC cadets no officer has handled yet (no company).
  Future<List<Map<String, dynamic>>> unassignedCadets({String? search}) async {
    final response = await _api.get('/cadets/unassigned', query: {
      'search': search,
    });
    return ApiService.listOf(response);
  }

  /// Adds a cadet to the signed-in officer's handled cadets; the server sets
  /// the cadet's company to the officer's. Returns the server's message.
  Future<String> assignCadetToMe(String cadetId) async {
    final response = await _api.post('/cadets/$cadetId/assign');
    return (response['message'] ?? 'Cadet added.').toString();
  }

  Future<Map<String, dynamic>> cadet([String? id]) async {
    final response = await _api.get('/cadets/${id ?? Session.instance.userId}');
    return ApiService.mapOf(response);
  }

  /// Roster for whichever program is active — used by manual attendance search.
  Future<List<Map<String, dynamic>>> roster({String? program, String? search}) async {
    final p = program ?? Session.instance.program;
    final result = p == 'ROTC'
        ? await cadets(search: search, status: 'Active')
        : await students(search: search, status: 'Active');
    return (result['data'] as List).cast<Map<String, dynamic>>();
  }

  // ---- Users ----

  Future<List<Map<String, dynamic>>> users({
    String? role,
    String? program,
    String? status,
    String? search,
  }) async {
    final response = await _api.get('/users', query: {
      'role': role,
      'program': program,
      'status': status,
      'search': search,
    });
    return ApiService.listOf(response);
  }

  Future<Map<String, dynamic>> user(String id) async {
    final response = await _api.get('/users/$id');
    return ApiService.mapOf(response);
  }

  /// Updates the User and its role profile in one request.
  Future<Map<String, dynamic>> updateUser(String id, Map<String, dynamic> body) async {
    final response = await _api.put('/users/$id', body: body);
    return ApiService.mapOf(response);
  }

  Future<void> deleteUser(String id) => _api.delete('/users/$id');

  /// Updates the signed-in user's own profile — routed to the collection
  /// that actually matches their role (previously this always fell through
  /// to `/students/:id` for anyone who wasn't a cadet, so an officer editing
  /// their own contact number would 404 against the Student collection).
  Future<Map<String, dynamic>> updateMyProfile(Map<String, dynamic> body) async {
    final id = Session.instance.userId;
    final String path;
    switch (Session.instance.role) {
      case 'cadet':
        path = '/cadets/$id';
      case 'officer':
        path = '/officers/$id';
      default:
        path = '/students/$id';
    }
    final response = await _api.put(path, body: body);
    return ApiService.mapOf(response);
  }

  /// Replaces the signed-in user's own profile photo (PUT /users/me/avatar —
  /// png/jpg/jpeg/webp, max 5 MB, checked again on the server). Pass the
  /// picked file's bytes ([fileBytes]; required on web) or its [filePath].
  Future<void> uploadAvatar({
    List<int>? fileBytes,
    String? filePath,
    required String fileName,
  }) async {
    await _api.upload(
      '/users/me/avatar',
      method: 'PUT',
      fields: const {},
      fileField: 'photo',
      fileBytes: fileBytes,
      filePath: filePath,
      fileName: fileName,
    );
  }

  Future<Map<String, dynamic>> stats() async {
    final response = await _api.get('/users/stats/overview');
    return ApiService.mapOf(response);
  }
}
