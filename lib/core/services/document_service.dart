import 'api_service.dart';

class DocumentService {
  DocumentService._();

  static final DocumentService instance = DocumentService._();
  final ApiService _api = ApiService.instance;

  /// Returns `{ uploaded: [...], pending: [...], all: [...] }`.
  Future<Map<String, dynamic>> mine() async {
    final response = await _api.get('/documents');
    final data = ApiService.mapOf(response);
    return {
      'uploaded': (data['uploaded'] as List? ?? []).cast<Map<String, dynamic>>(),
      'pending': (data['pending'] as List? ?? []).cast<Map<String, dynamic>>(),
      'all': (data['all'] as List? ?? []).cast<Map<String, dynamic>>(),
    };
  }

  Future<List<Map<String, dynamic>>> forUser(String userId) async {
    final response = await _api.get('/documents/user/$userId');
    return ApiService.listOf(response);
  }

  /// Officer/admin review queue — every document belonging to a trainee in
  /// the caller's own program/brigade, not the caller's own documents.
  Future<List<Map<String, dynamic>>> reviewQueue({String? status}) async {
    final response = await _api.get(
      '/documents/review',
      query: status != null ? {'status': status} : null,
    );
    return ApiService.listOf(response);
  }

  /// Officer/admin approve or reject one trainee's uploaded document.
  Future<Map<String, dynamic>> review(
    String id, {
    required String status,
  }) async {
    final response = await _api.put('/documents/$id', body: {'status': status});
    return ApiService.mapOf(response);
  }

  Future<Map<String, dynamic>> upload({
    required String title,
    String? filePath,
    List<int>? fileBytes,
    String? fileName,
  }) async {
    final response = await _api.upload(
      '/documents',
      fields: {'title': title},
      filePath: filePath,
      fileBytes: fileBytes,
      fileName: fileName,
    );
    return ApiService.mapOf(response);
  }

  Future<void> delete(String id) => _api.delete('/documents/$id');
}
