import 'api_service.dart';
import 'session.dart';
import '../utils/formatters.dart';

class AttendanceService {
  AttendanceService._();

  static final AttendanceService instance = AttendanceService._();
  final ApiService _api = ApiService.instance;

  // ---------------------------------------------------------------
  // Trainee side
  // ---------------------------------------------------------------

  /// My own attendance history (filter is 'All' / 'Present' / 'Absent' / 'Late').
  Future<List<Map<String, dynamic>>> myRecords({String filter = 'All'}) async {
    final id = Session.instance.userId;
    final path = Session.instance.role == 'cadet'
        ? '/cadets/$id/attendance'
        : '/students/$id/attendance';

    final response = await _api.get(path, query: {
      if (filter != 'All') 'status': filter,
    });
    return ApiService.listOf(response);
  }

  /// Step 1 of the QR flow. Returns the pending record plus, in development
  /// mode, the verification code so the flow can be tested without email.
  Future<Map<String, dynamic>> scan(String sessionCode) async {
    final response = await _api.post('/attendance/scan', body: {
      'sessionCode': sessionCode,
    });
    return {
      ...ApiService.mapOf(response),
      'message': response['message']?.toString() ?? '',
    };
  }

  /// Step 2 of the QR flow.
  Future<Map<String, dynamic>> verify({
    required String verificationCode,
    String? attendanceId,
    String? sessionId,
  }) async {
    final response = await _api.post('/attendance/verify', body: {
      'verificationCode': verificationCode,
      if (attendanceId != null) 'attendanceId': attendanceId,
      if (sessionId != null) 'sessionId': sessionId,
    });
    return {
      ...ApiService.mapOf(response),
      'message': response['message']?.toString() ?? '',
    };
  }

  // ---------------------------------------------------------------
  // Officer side
  // ---------------------------------------------------------------

  Future<List<Map<String, dynamic>>> list({
    String? program,
    String? status,
    String? search,
    String? sessionId,
    String? activityId,
    String? studentId,
    DateTime? date,
    int? limit,
  }) async {
    final response = await _api.get('/attendance', query: {
      'program': program,
      'status': status,
      'search': search,
      'sessionId': sessionId,
      'activityId': activityId,
      'studentId': studentId,
      'limit': limit,
      if (date != null) 'date': Fmt.apiDate(date),
    });
    return ApiService.listOf(response);
  }

  /// Daily counters + monthly trend for the officer attendance screen.
  Future<Map<String, dynamic>> summary({String? program, DateTime? date}) async {
    final response = await _api.get('/attendance/summary', query: {
      'program': program ?? Session.instance.program,
      if (date != null) 'date': Fmt.apiDate(date),
    });
    return ApiService.mapOf(response);
  }

  /// Creates the QR attendance session an officer shows to the class.
  Future<Map<String, dynamic>> createSession({
    required DateTime date,
    required String startTime,
    required String endTime,
    String? program,
    String brigade = '',
    String notes = '',
    String? activityId,
    String? title,
  }) async {
    final response = await _api.post('/attendance/sessions', body: {
      'date': Fmt.apiDate(date),
      'startTime': startTime,
      'endTime': endTime,
      if (program != null) 'program': program,
      'brigade': brigade,
      'notes': notes,
      if (activityId != null) 'activityId': activityId,
      if (title != null) 'title': title,
    });
    return ApiService.mapOf(response);
  }

  Future<List<Map<String, dynamic>>> sessions({
    String? program,
    String? status,
    DateTime? date,
  }) async {
    final response = await _api.get('/attendance/sessions', query: {
      'program': program,
      'status': status,
      if (date != null) 'date': Fmt.apiDate(date),
    });
    return ApiService.listOf(response);
  }

  Future<Map<String, dynamic>> closeSession(String id) async {
    final response = await _api.put('/attendance/sessions/$id/close');
    return ApiService.mapOf(response);
  }

  /// Manual attendance — one call marks the whole selected list.
  Future<int> markManual({
    required List<String> studentIds,
    required DateTime date,
    String status = 'Present',
    String? program,
    String brigade = '',
    String remarks = '',
    String? sessionId,
    String? activityId,
    String? title,
  }) async {
    final response = await _api.post('/attendance', body: {
      'studentIds': studentIds,
      'date': Fmt.apiDate(date),
      'status': status,
      if (program != null) 'program': program,
      'brigade': brigade,
      'remarks': remarks,
      if (sessionId != null) 'sessionId': sessionId,
      if (activityId != null) 'activityId': activityId,
      if (title != null) 'title': title,
    });
    return (response['count'] as num?)?.toInt() ?? 0;
  }

  Future<Map<String, dynamic>> update(
    String id, {
    String? status,
    String? remarks,
  }) async {
    final response = await _api.put('/attendance/$id', body: {
      if (status != null) 'status': status,
      if (remarks != null) 'remarks': remarks,
    });
    return ApiService.mapOf(response);
  }

  Future<void> delete(String id) => _api.delete('/attendance/$id');

  /// Trainees with 3+ absences, for the "near absence limit" widget.
  Future<List<Map<String, dynamic>>> atRisk({String? program, int threshold = 3}) async {
    final response = await _api.get('/students/at-risk', query: {
      'program': program ?? Session.instance.program,
      'threshold': threshold,
    });
    return ApiService.listOf(response);
  }
}
