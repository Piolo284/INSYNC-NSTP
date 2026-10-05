import 'api_service.dart';
import '../utils/formatters.dart';

class ActivityService {
  ActivityService._();

  static final ActivityService instance = ActivityService._();
  final ApiService _api = ApiService.instance;

  /// [specialClass] is only for the assigned ROTC Special Class officer,
  /// requesting their own alternative-track activities instead of their
  /// regular brigade ones — a plain cadet's own Special Class membership is
  /// already applied automatically server-side, no flag needed here.
  Future<List<Map<String, dynamic>>> list({
    String? program,
    String? status,
    String? search,
    bool upcomingOnly = false,
    bool specialClass = false,
  }) async {
    final response = await _api.get('/activities', query: {
      'program': program,
      'status': status,
      'search': search,
      if (upcomingOnly) 'upcoming': 'true',
      if (specialClass) 'specialClass': 'true',
    });
    return ApiService.listOf(response);
  }

  Future<Map<String, dynamic>> get(String id) async {
    final response = await _api.get('/activities/$id');
    return ApiService.mapOf(response);
  }

  /// Officer "Add New Activity". [photoPath] is optional; when present the file
  /// is uploaded and becomes the activity cover image.
  Future<Map<String, dynamic>> create({
    required String title,
    required String description,
    required DateTime date,
    required String location,
    String? program,
    String startTime = '',
    String endTime = '',
    String objectives = '',
    String brigade = '',
    String? photoPath,
    List<int>? photoBytes,
    String? photoName,
    bool isSpecialClass = false,
  }) async {
    final fields = {
      'title': title,
      'description': description,
      'date': Fmt.apiDate(date),
      'location': location,
      'program': ?program,
      'startTime': startTime,
      'endTime': endTime,
      'objectives': objectives,
      'brigade': brigade,
      if (isSpecialClass) 'isSpecialClass': 'true',
    };

    final response = await _api.upload(
      '/activities',
      fields: fields,
      filePath: photoPath,
      fileBytes: photoBytes,
      fileName: photoName,
      fileField: 'photos',
    );
    return ApiService.mapOf(response);
  }

  Future<Map<String, dynamic>> update(
    String id,
    Map<String, dynamic> body, {
    String? photoPath,
    List<int>? photoBytes,
    String? photoName,
  }) async {
    if ((photoPath != null && photoPath.isNotEmpty) ||
        (photoBytes != null && photoBytes.isNotEmpty)) {
      final response = await _api.upload(
        '/activities/$id',
        method: 'PUT',
        fields: body.map((k, v) => MapEntry(k, v.toString())),
        filePath: photoPath,
        fileBytes: photoBytes,
        fileName: photoName,
        fileField: 'photos',
      );
      return ApiService.mapOf(response);
    }
    final response = await _api.put('/activities/$id', body: body);
    return ApiService.mapOf(response);
  }

  Future<void> delete(String id) => _api.delete('/activities/$id');

  /// Returns `{ stats: {...}, data: [...] }` for the participants screen.
  Future<Map<String, dynamic>> participants(String id) async {
    final response = await _api.get('/activities/$id/participants');
    return {
      'stats': (response['stats'] as Map?)?.cast<String, dynamic>() ?? {},
      'data': ApiService.listOf(response),
    };
  }
}
