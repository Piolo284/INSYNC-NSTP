import 'package:flutter/foundation.dart';

/// Lets a student shell tell its Attendance tab which status filter to show
/// (e.g. tapping "Late" on the dashboard opens Attendance on the Late tab).
///
/// A plain ValueNotifier won't fire when the same status is requested twice
/// in a row (tap Late → switch tab to All → back Home → tap Late again), so
/// every [open] call notifies regardless of the previous value.
class AttendanceFilterRequest extends ChangeNotifier {
  String _filter = 'All';

  String get filter => _filter;

  void open(String filter) {
    _filter = filter;
    notifyListeners();
  }
}
