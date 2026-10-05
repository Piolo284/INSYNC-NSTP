import 'api_service.dart';
import 'session.dart';

/// The Special Class track (CWTS and ROTC each have their own) — PWD/
/// Medical-Condition trainees exempt from field training / physically
/// demanding community work, and the single per-program officer
/// admin_cwts/admin_rotc assigns to handle them. Activities/sessions
/// themselves still go through ActivityService/AttendanceService (with
/// isSpecialClass: true) since they reuse the same underlying data/grading
/// pipeline; this service only covers what's genuinely new: who the
/// officer is, who's on the roster, and an admin's assignment action.
class SpecialClassService {
  SpecialClassService._();

  static final SpecialClassService instance = SpecialClassService._();
  final ApiService _api = ApiService.instance;

  /// The currently assigned officer for [program] (defaults to the caller's
  /// own program), or null if the admin hasn't assigned one yet. Any
  /// signed-in user may call this (a Special Class trainee needs it to see
  /// who to contact).
  Future<Map<String, dynamic>?> officer({String? program}) async {
    final response = await _api.get('/officers/special-class', query: {
      'program': program ?? Session.instance.program,
    });
    final data = response['data'];
    if (data is Map) return data.cast<String, dynamic>();
    return null;
  }

  /// Every Active PWD/Medical-Condition trainee for [program] (defaults to
  /// the caller's own program) — students for CWTS, cadets for ROTC,
  /// cutting across brigades/companies. Only the assigned officer or an
  /// admin_cwts/admin_rotc/super_admin may call this successfully.
  Future<List<Map<String, dynamic>>> roster({String? program}) async {
    final resolvedProgram = program ?? Session.instance.program;
    final path = resolvedProgram == 'ROTC' ? '/cadets/special-class' : '/students/special-class';
    final response = await _api.get(path);
    return ApiService.listOf(response);
  }

  /// admin_cwts/admin_rotc/super_admin assigns (or clears) the single
  /// per-program Special Class officer — assigning a new one automatically
  /// clears whoever held it before, for that same program.
  Future<Map<String, dynamic>> assignOfficer(
    String officerId, {
    required bool isSpecialClassOfficer,
  }) async {
    final response = await _api.put('/officers/$officerId/special-class', body: {
      'isSpecialClassOfficer': isSpecialClassOfficer,
    });
    return ApiService.mapOf(response);
  }
}
