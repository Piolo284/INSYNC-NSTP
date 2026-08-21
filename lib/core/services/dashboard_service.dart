import 'api_service.dart';
import 'session.dart';

/// One call per dashboard, so the home screens do not fan out to six endpoints.
class DashboardService {
  DashboardService._();

  static final DashboardService instance = DashboardService._();
  final ApiService _api = ApiService.instance;

  /// Trainee (CWTS student) home screen.
  Future<Map<String, dynamic>> student([String? studentId]) async {
    final id = studentId ?? Session.instance.userId;
    final response = await _api.get('/students/$id/dashboard');
    return ApiService.mapOf(response);
  }

  /// Cadet (ROTC) home screen.
  Future<Map<String, dynamic>> cadet([String? cadetId]) async {
    final id = cadetId ?? Session.instance.userId;
    final response = await _api.get('/cadets/$id/dashboard');
    return ApiService.mapOf(response);
  }

  Future<Map<String, dynamic>> officer({String? program}) async {
    final response = await _api.get('/dashboard/officer', query: {
      'program': program ?? Session.instance.program,
    });
    return ApiService.mapOf(response);
  }

  Future<Map<String, dynamic>> admin() async {
    final response = await _api.get('/dashboard/admin');
    return ApiService.mapOf(response);
  }
}
