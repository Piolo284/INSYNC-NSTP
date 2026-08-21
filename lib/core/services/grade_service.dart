import 'api_service.dart';
import 'session.dart';

class GradeService {
  GradeService._();

  static final GradeService instance = GradeService._();
  final ApiService _api = ApiService.instance;

  /// Returns `{ stats: {...}, data: [...] }` for the instructor students screen.
  Future<Map<String, dynamic>> list({
    String? program,
    String? remarks,
    String? search,
  }) async {
    final response = await _api.get('/grades', query: {
      'program': program,
      'remarks': remarks,
      'search': search,
    });
    return {
      'stats': (response['stats'] as Map?)?.cast<String, dynamic>() ?? {},
      'data': ApiService.listOf(response),
    };
  }

  /// One trainee's grade, always recomputed server-side from source data.
  Future<Map<String, dynamic>> forStudent([String? studentId]) async {
    final id = studentId ?? Session.instance.userId;
    final response = await _api.get('/grades/$id');
    return ApiService.mapOf(response);
  }

  Future<Map<String, dynamic>> update(
    String id, {
    num? finalGrade,
    String? remarks,
  }) async {
    final response = await _api.put('/grades/$id', body: {
      if (finalGrade != null) 'finalGrade': finalGrade,
      if (remarks != null) 'remarks': remarks,
    });
    return ApiService.mapOf(response);
  }

  /// Forces a recalculation for one trainee or a whole program.
  Future<int> recalculate({String? studentId, String? program}) async {
    final response = await _api.post('/grades', body: {
      if (studentId != null) 'studentId': studentId,
      if (program != null) 'program': program,
    });
    return (response['count'] as num?)?.toInt() ?? 0;
  }
}
