import 'dart:convert';

import 'api_service.dart';

class SubmissionService {
  SubmissionService._();

  static final SubmissionService instance = SubmissionService._();
  final ApiService _api = ApiService.instance;

  Future<List<Map<String, dynamic>>> list({
    String? moduleId,
    String? activityId,
    String? studentId,
    String? status,
    String? search,
  }) async {
    final response = await _api.get('/submissions', query: {
      'moduleId': moduleId,
      'activityId': activityId,
      'studentId': studentId,
      'status': status,
      'search': search,
    });
    return ApiService.listOf(response);
  }

  Future<Map<String, dynamic>> get(String id) async {
    final response = await _api.get('/submissions/$id');
    return ApiService.mapOf(response);
  }

  /// The trainee "Turn In" button.
  Future<Map<String, dynamic>> submit({
    String? moduleId,
    String? activityId,
    String? filePath,
    List<int>? fileBytes,
    String? fileName,
    String comment = '',
  }) async {
    final response = await _api.upload(
      '/submissions',
      fields: {
        'moduleId': ?moduleId,
        'activityId': ?activityId,
        'comment': comment,
      },
      filePath: filePath,
      fileBytes: fileBytes,
      fileName: fileName,
    );
    return ApiService.mapOf(response);
  }

  /// Officer grading. Pass [rubricScores] to let the server total
  /// them, or a flat [score] when there is no rubric.
  Future<Map<String, dynamic>> grade(
    String id, {
    List<Map<String, dynamic>>? rubricScores,
    num? score,
    num? totalPoints,
    String feedback = '',
  }) async {
    final response = await _api.post('/submissions/$id/grade', body: {
      if (rubricScores != null) 'rubricScores': jsonEncode(rubricScores),
      'score': ?score,
      'totalPoints': ?totalPoints,
      'feedback': feedback,
    });
    return ApiService.mapOf(response);
  }

  Future<void> delete(String id) => _api.delete('/submissions/$id');
}
