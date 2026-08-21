import 'api_service.dart';

class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();
  final ApiService _api = ApiService.instance;

  /// Returns `{ unreadCount: int, data: [...] }`.
  Future<Map<String, dynamic>> mine({bool unreadOnly = false, int? limit}) async {
    final response = await _api.get('/notifications', query: {
      if (unreadOnly) 'unread': 'true',
      'limit': limit,
    });
    return {
      'unreadCount': (response['unreadCount'] as num?)?.toInt() ?? 0,
      'data': ApiService.listOf(response),
    };
  }

  Future<Map<String, dynamic>> forUser(String userId, {bool unreadOnly = false}) async {
    final response = await _api.get('/notifications/$userId', query: {
      if (unreadOnly) 'unread': 'true',
    });
    return {
      'unreadCount': (response['unreadCount'] as num?)?.toInt() ?? 0,
      'data': ApiService.listOf(response),
    };
  }

  Future<void> markRead(String id) => _api.put('/notifications/$id/read');

  Future<void> markAllRead() => _api.put('/notifications/read-all');

  Future<void> delete(String id) => _api.delete('/notifications/$id');
}
