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
      'attendanceId': ?attendanceId,
      'sessionId': ?sessionId,
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

  /// Creates the QR attendance session an officer shows to the class. The
  /// session's brigade is never sent — the backend auto-assigns it from the
  /// officer's own brigade (see backend/utils/brigadeScope.js).
  Future<Map<String, dynamic>> createSession({
    required DateTime date,
    required String startTime,
    required String endTime,
    String? program,
    String notes = '',
    String? activityId,
    String? title,
    bool isSpecialClass = false,
    /// 'IN' (default) or 'OUT'. An 'OUT' session must also pass
    /// [pairedSessionId] — the IN session it closes out.
    String checkType = 'IN',
    String? pairedSessionId,
  }) async {
    final response = await _api.post('/attendance/sessions', body: {
      'date': Fmt.apiDate(date),
      'startTime': startTime,
      'endTime': endTime,
      'program': ?program,
      'notes': notes,
      'activityId': ?activityId,
      'title': ?title,
      if (isSpecialClass) 'isSpecialClass': true,
      'checkType': checkType,
      'pairedSessionId': ?pairedSessionId,
    });
    return ApiService.mapOf(response);
  }

  /// The ROTC officer attendance/activities screens pass [specialClass]:
  /// true only when the caller IS the assigned Special Class officer,
  /// requesting their own alternative-track sessions instead of their
  /// regular brigade ones (the backend rejects it otherwise).
  Future<List<Map<String, dynamic>>> sessions({
    String? program,
    String? status,
    DateTime? date,
    bool specialClass = false,
  }) async {
    final response = await _api.get('/attendance/sessions', query: {
      'program': program,
      'status': status,
      if (date != null) 'date': Fmt.apiDate(date),
      if (specialClass) 'specialClass': 'true',
    });
    return ApiService.listOf(response);
  }

  Future<Map<String, dynamic>> closeSession(String id) async {
    final response = await _api.put('/attendance/sessions/$id/close');
    return ApiService.mapOf(response);
  }

  /// Manual attendance — one call marks the whole selected list. The
  /// backend rejects any student outside the officer's own brigade, so no
  /// brigade needs to be sent here either.
  ///
  /// [checkType] 'IN' (default) marks [status] as usual. 'OUT' instead stamps
  /// a check-out time onto each student's existing check-in row — [status]
  /// is ignored — and any student with no check-in row yet is reported back
  /// in the returned `failed` count instead of being marked.
  Future<Map<String, int>> markManual({
    required List<String> studentIds,
    required DateTime date,
    String status = 'Present',
    String? program,
    String remarks = '',
    String? sessionId,
    String? activityId,
    String? title,
    bool isSpecialClass = false,
    String checkType = 'IN',
  }) async {
    final response = await _api.post('/attendance', body: {
      'studentIds': studentIds,
      'date': Fmt.apiDate(date),
      'status': status,
      'program': ?program,
      'remarks': remarks,
      'sessionId': ?sessionId,
      'activityId': ?activityId,
      'title': ?title,
      if (isSpecialClass) 'isSpecialClass': true,
      'checkType': checkType,
    });
    return {
      'count': (response['count'] as num?)?.toInt() ?? 0,
      'failed': (response['failed'] as num?)?.toInt() ?? 0,
    };
  }

  /// "Finalize the day" for manual/ad hoc attendance with no QR session to
  /// close — marks Absent anyone in scope who checked in but never checked
  /// out. Mirrors what closing an OUT session does for the QR flow.
  Future<int> finalizeDay({
    required DateTime date,
    String? title,
    String? program,
  }) async {
    final response = await _api.post('/attendance/finalize', body: {
      'date': Fmt.apiDate(date),
      'title': ?title,
      'program': ?program,
    });
    return (response['markedAbsentCount'] as num?)?.toInt() ?? 0;
  }

  Future<Map<String, dynamic>> update(
    String id, {
    String? status,
    String? remarks,
  }) async {
    final response = await _api.put('/attendance/$id', body: {
      'status': ?status,
      'remarks': ?remarks,
    });
    return ApiService.mapOf(response);
  }

  Future<void> delete(String id) => _api.delete('/attendance/$id');

  /// Trainees with 3+ absences, for the "near absence limit" widget.
  /// The assigned officer confirms dropping a trainee who reached the
  /// absence limit (reaching it only flags them — see `pendingDrop` on
  /// [atRisk] rows). Returns the server's message.
  Future<String> confirmDrop(String userId) async {
    final response = await _api.post('/drop-reviews/$userId/confirm');
    return (response['message'] ?? 'Trainee dropped.').toString();
  }

  /// The assigned officer keeps a flagged trainee enrolled; they're only
  /// flagged again after another absence. Returns the server's message.
  Future<String> keepEnrolled(String userId) async {
    final response = await _api.post('/drop-reviews/$userId/keep');
    return (response['message'] ?? 'Trainee kept.').toString();
  }

  Future<List<Map<String, dynamic>>> atRisk({String? program, int threshold = 3}) async {
    final response = await _api.get('/students/at-risk', query: {
      'program': program ?? Session.instance.program,
      'threshold': threshold,
    });
    return ApiService.listOf(response);
  }

  // ---------------------------------------------------------------
  // Attendance contests (absence disputes)
  // ---------------------------------------------------------------

  /// Trainee disputes one of their own Absent records. [filePath] is
  /// optional (e.g. a photographed medical certificate).
  Future<Map<String, dynamic>> fileContest({
    required String attendanceId,
    required String reason,
    String? filePath,
    List<int>? fileBytes,
    String? fileName,
  }) async {
    final response = await _api.upload(
      '/attendance-contests',
      fields: {
        'attendanceId': attendanceId,
        'reason': reason,
      },
      filePath: filePath,
      fileBytes: fileBytes,
      fileName: fileName,
    );
    return ApiService.mapOf(response);
  }

  /// The trainee's own filed contests, for overlaying status onto their
  /// attendance history (Pending / Approved / Rejected instead of Absent).
  Future<List<Map<String, dynamic>>> myContests() async {
    final response = await _api.get('/attendance-contests/mine');
    return ApiService.listOf(response);
  }

  /// Officer review queue — program/brigade-scoped server-side, same as
  /// every other officer list.
  Future<List<Map<String, dynamic>>> listContests({String? status}) async {
    final response = await _api.get('/attendance-contests', query: {
      'status': ?status,
    });
    return ApiService.listOf(response);
  }

  Future<Map<String, dynamic>> getContest(String id) async {
    final response = await _api.get('/attendance-contests/$id');
    return ApiService.mapOf(response);
  }

  /// Officer approves or rejects a pending contest.
  Future<Map<String, dynamic>> reviewContest(
    String id, {
    required String status,
    String reviewNote = '',
  }) async {
    final response = await _api.put('/attendance-contests/$id', body: {
      'status': status,
      'reviewNote': reviewNote,
    });
    return ApiService.mapOf(response);
  }
}
