import 'dart:convert';

import 'api_service.dart';
import '../utils/formatters.dart';

class ModuleService {
  ModuleService._();

  static final ModuleService instance = ModuleService._();
  final ApiService _api = ApiService.instance;

  /// For trainees each item carries `myStatus` and `mySubmission`; for staff it
  /// carries `submittedCount` / `totalTrainees` / `percentage`.
  Future<List<Map<String, dynamic>>> list({
    String? program,
    String? status,
    String? moduleCode,
    String? search,
    bool withDeadlineOnly = false,
  }) async {
    final response = await _api.get('/modules', query: {
      'program': program,
      'status': status,
      'moduleCode': moduleCode,
      'search': search,
      if (withDeadlineOnly) 'withDeadline': 'true',
    });
    return ApiService.listOf(response);
  }

  Future<Map<String, dynamic>> get(String id) async {
    final response = await _api.get('/modules/$id');
    return ApiService.mapOf(response);
  }

  Future<Map<String, dynamic>> create({
    required String title,
    required String description,
    String? program,
    String moduleCode = '',
    String section = '',
    String instructions = '',
    DateTime? deadline,
    int totalPoints = 100,
    List<Map<String, dynamic>> rubrics = const [],
    String? filePath,
    List<int>? fileBytes,
    String? fileName,
    // A YouTube/video link instead of an uploaded file — mutually exclusive
    // with filePath/fileBytes; ignored if either of those is also set.
    String? fileUrl,
  }) async {
    final fields = {
      'title': title,
      'description': description,
      'program': ?program,
      'moduleCode': moduleCode,
      'section': section,
      'instructions': instructions,
      if (deadline != null) 'deadline': Fmt.apiDate(deadline),
      'totalPoints': '$totalPoints',
      if (rubrics.isNotEmpty) 'rubrics': jsonEncode(rubrics),
      if (fileUrl != null && fileUrl.isNotEmpty) ...{
        'fileUrl': fileUrl,
        'fileName': fileName ?? 'Video Link',
      },
    };

    final response = await _api.upload(
      '/modules',
      fields: fields,
      filePath: filePath,
      fileBytes: fileBytes,
      fileName: fileName,
    );
    return ApiService.mapOf(response);
  }

  Future<Map<String, dynamic>> update(
    String id,
    Map<String, dynamic> body, {
    String? filePath,
    List<int>? fileBytes,
    String? fileName,
  }) async {
    if ((filePath != null && filePath.isNotEmpty) ||
        (fileBytes != null && fileBytes.isNotEmpty)) {
      final response = await _api.upload(
        '/modules/$id',
        method: 'PUT',
        fields: body.map((k, v) => MapEntry(k, v.toString())),
        filePath: filePath,
        fileBytes: fileBytes,
        fileName: fileName,
      );
      return ApiService.mapOf(response);
    }
    final response = await _api.put('/modules/$id', body: body);
    return ApiService.mapOf(response);
  }

  Future<void> delete(String id) => _api.delete('/modules/$id');

  /// Submissions for one module, for the officer assignment-detail screen.
  Future<List<Map<String, dynamic>>> submissions(String id, {String? status}) async {
    final response = await _api.get('/modules/$id/submissions', query: {
      'status': status,
    });
    return ApiService.listOf(response);
  }
}
