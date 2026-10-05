import 'api_service.dart';

class AnnouncementService {
  AnnouncementService._();

  static final AnnouncementService instance = AnnouncementService._();
  final ApiService _api = ApiService.instance;

  Future<List<Map<String, dynamic>>> list({
    String? program,
    String? audience,
    int? limit,
  }) async {
    final response = await _api.get('/announcements', query: {
      'program': program,
      'audience': audience,
      'limit': limit,
    });
    return ApiService.listOf(response);
  }

  Future<Map<String, dynamic>> get(String id) async {
    final response = await _api.get('/announcements/$id');
    return ApiService.mapOf(response);
  }

  Future<Map<String, dynamic>> create({
    required String title,
    required String content,
    String? program,
    String targetAudience = 'All',
    String location = '',
    String time = '',
    DateTime? date,
    bool isPinned = false,
    List<String> recipients = const [],
  }) async {
    final response = await _api.post('/announcements', body: {
      'title': title,
      'content': content,
      'program': ?program,
      'targetAudience': targetAudience,
      'location': location,
      'time': time,
      if (date != null) 'date': date.toIso8601String(),
      'isPinned': isPinned,
      if (recipients.isNotEmpty) 'recipients': recipients,
    });
    return ApiService.mapOf(response);
  }

  Future<Map<String, dynamic>> update(String id, Map<String, dynamic> body) async {
    final response = await _api.put('/announcements/$id', body: body);
    return ApiService.mapOf(response);
  }

  Future<void> delete(String id) => _api.delete('/announcements/$id');

  /// Re-sends notifications; pass [recipients] to target specific users.
  Future<int> send(String id, {List<String> recipients = const []}) async {
    final response = await _api.post('/announcements/$id/send', body: {
      if (recipients.isNotEmpty) 'recipients': recipients,
    });
    return (response['count'] as num?)?.toInt() ?? 0;
  }
}
