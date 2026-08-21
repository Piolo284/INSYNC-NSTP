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

  Future<Map<String, dynamic>> upload({
    required String title,
    String? filePath,
  }) async {
    final response = await _api.upload(
      '/documents',
      fields: {'title': title},
      filePath: filePath,
    );
    return ApiService.mapOf(response);
  }

  Future<void> delete(String id) => _api.delete('/documents/$id');
}
