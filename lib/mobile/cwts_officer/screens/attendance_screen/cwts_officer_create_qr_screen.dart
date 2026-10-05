import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';

/// Officer QR attendance session builder.
///
/// Two steps: **Setup** creates a real `AttendanceSession` in MongoDB, then
/// **Monitor** shows the QR for its `sessionCode` (trainees scan this — no
/// external service call, works offline) alongside a live check-in list that
/// polls `GET /attendance?sessionId=` every 5 seconds while the session is
/// open, mirroring the web admin's `MonitorModal`. There is no separate
/// "Activate" step — the backend has no such state, a session is scannable
/// the moment it's created — and no Pause/Regenerate, since the
/// `AttendanceSession` model has no Paused status and no endpoint to reissue
/// a session's code.
///
/// Pass [existingSession] to resume monitoring a session an officer already
/// started (e.g. from the dashboard's "Manage Attendance" card) instead of
/// building a new one.
class CwtsOfficerCreateQrScreen extends StatefulWidget {
  const CwtsOfficerCreateQrScreen({super.key, this.existingSession});

  final Map<String, dynamic>? existingSession;

  @override
  State<CwtsOfficerCreateQrScreen> createState() =>
      _CwtsOfficerCreateQrScreenState();
}

class _CwtsOfficerCreateQrScreenState extends State<CwtsOfficerCreateQrScreen> {
  int _currentStep = 0;
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 8, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 8, minute: 30);
  final TextEditingController _notesController = TextEditingController();

  bool _isSaving = false;

  /// 'IN' (default) generates a regular check-in QR. 'OUT' generates a
  /// check-out QR paired to one of today's check-in sessions — closing it
  /// marks Absent anyone who checked in there but never checked out.
  String _checkType = 'IN';
  Map<String, dynamic>? _pairedSession;
  List<Map<String, dynamic>> _availableInSessions = const [];
  bool _loadingInSessions = false;

  /// The active session; drives the QR image and the Monitor step.
  Map<String, dynamic>? _session;

  Timer? _pollTimer;
  List<Map<String, dynamic>> _liveRecords = const [];
  bool _isPolling = false;

  final List<String> _steps = ['Setup', 'Monitor'];

  @override
  void initState() {
    super.initState();

    final existing = widget.existingSession;
    if (existing != null) {
      _session = existing;
      _currentStep = 1;
      _startPolling();
    }
  }

  Future<void> _loadInSessions() async {
    setState(() => _loadingInSessions = true);
    try {
      final sessions = await AttendanceService.instance.sessions(
        program: Session.instance.program,
        date: _selectedDate,
        specialClass: Session.instance.isSpecialClassOfficer,
      );
      if (!mounted) return;
      final inSessions =
          sessions.where((s) => Fmt.str(s['checkType'], 'IN') == 'IN').toList();
      setState(() {
        _availableInSessions = inSessions;
        if (_pairedSession != null &&
            !inSessions.any((s) => s['_id'] == _pairedSession!['_id'])) {
          _pairedSession = null;
        }
      });
    } catch (_) {
      // Silent — the picker just shows "No check-in sessions" instead.
    } finally {
      if (mounted) setState(() => _loadingInSessions = false);
    }
  }

  void _onCheckTypeChanged(String value) {
    setState(() => _checkType = value);
    if (value == 'OUT') _loadInSessions();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _notesController.dispose();
    super.dispose();
  }

  String get _sessionCode => Fmt.str(_session?['sessionCode']);
  String get _sessionId => Fmt.str(_session?['_id']);

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2024),
      lastDate: DateTime(2030),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme:
              const ColorScheme.light(primary: AppColors.primaryMaroon),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      if (_checkType == 'OUT') _loadInSessions();
    }
  }

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme:
              const ColorScheme.light(primary: AppColors.primaryMaroon),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  String _apiTime(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  String _displayTime(TimeOfDay t) => Fmt.clock(_apiTime(t));

  int _minutesOf(TimeOfDay t) => t.hour * 60 + t.minute;

  /// Step 1 → 2: persists the session so the QR code maps to a real record,
  /// then starts monitoring it immediately — it's already scannable.
  Future<void> _generateSession() async {
    // The Special Class officer's sessions are always program-wide, not
    // tied to any personal brigade — only a regular brigade officer needs
    // one assigned before they can start a session.
    if (Session.instance.brigade.isEmpty && !Session.instance.isSpecialClassOfficer) {
      AppSnack.error(
        context,
        'Your officer account has no brigade assigned yet. Contact your administrator.',
      );
      return;
    }
    if (_minutesOf(_endTime) <= _minutesOf(_startTime)) {
      AppSnack.error(context, 'End time must be after the start time.');
      return;
    }
    if (_checkType == 'OUT' && _pairedSession == null) {
      AppSnack.error(context, 'Select which check-in session this check-out QR code closes out.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      final defaultTitle = _checkType == 'OUT'
          ? (Session.instance.isSpecialClassOfficer
              ? '${Session.instance.program} Inclusive Learning Section Check-Out'
              : '${Session.instance.brigade} Check-Out')
          : (Session.instance.isSpecialClassOfficer
              ? '${Session.instance.program} Inclusive Learning Section Attendance'
              : '${Session.instance.brigade} Attendance');
      final session = await AttendanceService.instance.createSession(
        date: _selectedDate,
        startTime: _apiTime(_startTime),
        endTime: _apiTime(_endTime),
        program: Session.instance.program,
        notes: _notesController.text.trim(),
        title: _notesController.text.trim().isEmpty
            ? defaultTitle
            : _notesController.text.trim(),
        checkType: _checkType,
        pairedSessionId: _checkType == 'OUT' ? Fmt.str(_pairedSession?['_id']) : null,
      );

      if (!mounted) return;
      setState(() {
        _session = session;
        _currentStep = 1;
      });
      _startPolling();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _refreshRecords();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _refreshRecords());
  }

  Future<void> _refreshRecords() async {
    final id = _sessionId;
    if (id.isEmpty || !mounted) return;
    setState(() => _isPolling = true);
    try {
      final records = await AttendanceService.instance.list(sessionId: id, limit: 500);
      if (!mounted) return;
      setState(() => _liveRecords = records);
    } catch (_) {
      // Silent — a transient failure just leaves the last known list on
      // screen; the next 5s tick will retry automatically.
    } finally {
      if (mounted) setState(() => _isPolling = false);
    }
  }

  Map<String, int> get _liveCounts {
    final counts = {'Present': 0, 'Late': 0, 'Absent': 0, 'Excused': 0};
    for (final record in _liveRecords) {
      final status = Fmt.str(record['status']);
      if (counts.containsKey(status)) counts[status] = counts[status]! + 1;
    }
    return counts;
  }

  Future<void> _closeSession() async {
    final id = _sessionId;
    if (id.isEmpty) return;

    final confirmed = await showConfirmDialog(
      context,
      title: 'Close Session?',
      message: 'The QR code will stop working immediately and trainees will '
          'no longer be able to scan it for attendance.',
      confirmLabel: 'Close Session',
    );
    if (!confirmed) return;

    try {
      _pollTimer?.cancel();
      await AttendanceService.instance.closeSession(id);
      if (!mounted) return;
      await _showSessionSummary();
      if (!mounted) return;
      Navigator.pop(context);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
      _startPolling();
    }
  }

  Future<void> _showSessionSummary() {
    final counts = _liveCounts;
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Session Closed'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${_liveRecords.length} student(s) checked in.'),
            const SizedBox(height: 12),
            _summaryRow('Present', counts['Present']!, AppColors.success),
            _summaryRow('Late', counts['Late']!, AppColors.lateStatus),
            _summaryRow('Absent', counts['Absent']!, AppColors.error),
            _summaryRow('Excused', counts['Excused']!, AppColors.blue),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, int count, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
          Text('$count', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        ],
      ),
    );
  }

  Widget _buildStepper() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Row(
        children: List.generate(_steps.length * 2 - 1, (index) {
          if (index.isOdd) {
            final stepIndex = index ~/ 2;
            return Expanded(
              child: Container(
                height: 2,
                color: stepIndex < _currentStep
                    ? AppColors.primaryMaroon
                    : AppColors.border,
              ),
            );
          }
          final stepIndex = index ~/ 2;
          final isActive = stepIndex <= _currentStep;
          final isCurrent = stepIndex == _currentStep;
          return Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: isActive ? AppColors.primaryMaroon : AppColors.border,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '${stepIndex + 1}',
                    style: TextStyle(
                      color: isActive ? AppColors.white : AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _steps[stepIndex],
                style: TextStyle(
                  fontSize: 10,
                  color: isCurrent
                      ? AppColors.primaryMaroon
                      : AppColors.textSecondary,
                  fontWeight: isCurrent ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildWarningBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.orangeLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.warning, size: 18),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'This QR code is only valid within the set time range',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.warning,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _currentStep == 0 ? 'Create QR Code' : 'Live Attendance',
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Column(
        children: [
          Container(
            color: AppColors.cardBg,
            child: _buildStepper(),
          ),
          Expanded(
            child: _currentStep == 0 ? _buildSetupStep() : _buildMonitorStep(),
          ),
        ],
      ),
    );
  }

  // ===== STEP 1: SETUP =====
  Widget _buildSetupStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildLabel('Select Date'),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: _pickDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            Fmt.dateWithDay(_selectedDate),
                            style: const TextStyle(
                                fontSize: 14, color: AppColors.textPrimary),
                          ),
                        ),
                        const Icon(Icons.calendar_today_outlined,
                            size: 18, color: AppColors.textSecondary),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                _buildLabel('Set Time Duration'),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _pickTime(true),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _displayTime(_startTime),
                                  style: const TextStyle(
                                      fontSize: 14,
                                      color: AppColors.textPrimary),
                                ),
                              ),
                              const Icon(Icons.access_time,
                                  size: 18, color: AppColors.textSecondary),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _pickTime(false),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _displayTime(_endTime),
                                  style: const TextStyle(
                                      fontSize: 14,
                                      color: AppColors.textPrimary),
                                ),
                              ),
                              const Icon(Icons.access_time,
                                  size: 18, color: AppColors.textSecondary),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                _buildLabel(Session.instance.isSpecialClassOfficer ? 'Roster' : 'Brigade'),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.scaffoldBg,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.groups_outlined, size: 18, color: AppColors.textSecondary),
                      const SizedBox(width: 10),
                      Text(
                        Session.instance.isSpecialClassOfficer
                            ? '${Session.instance.program} Inclusive Learning Section (program-wide)'
                            : Session.instance.brigade.isEmpty
                                ? 'No brigade assigned — contact your administrator.'
                                : Session.instance.brigade,
                        style: const TextStyle(fontSize: 14, color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                _buildLabel('This QR Code Is For'),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _buildCheckTypeChip(label: 'Check In', value: 'IN'),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildCheckTypeChip(label: 'Check Out', value: 'OUT'),
                    ),
                  ],
                ),
                if (_checkType == 'OUT') ...[
                  const SizedBox(height: 12),
                  _buildLabel('Pair With Check-In Session'),
                  const SizedBox(height: 8),
                  _buildPairedSessionPicker(),
                  const SizedBox(height: 4),
                  const Text(
                    'Trainees who check in here but never scan this check-out '
                    'QR are marked Absent once you close it.',
                    style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                ],
                const SizedBox(height: 20),

                _buildLabel('Notes (Optional)'),
                const SizedBox(height: 8),
                TextField(
                  controller: _notesController,
                  maxLines: 4,
                  maxLength: 100,
                  decoration: InputDecoration(
                    hintText: 'e.g. CWTS Training – Day 3',
                    hintStyle: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 13),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                          color: AppColors.primaryMaroon, width: 1.5),
                    ),
                    contentPadding: const EdgeInsets.all(14),
                    counterStyle: const TextStyle(
                        fontSize: 11, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSaving ? null : _generateSession,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryMaroon,
                foregroundColor: AppColors.white,
                disabledBackgroundColor: AppColors.grey300,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: _isSaving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor:
                            AlwaysStoppedAnimation<Color>(AppColors.white),
                      ),
                    )
                  : const Text(
                      'Generate QR Code',
                      style:
                          TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ===== STEP 2: SHOW QR + LIVE MONITOR =====
  Widget _buildMonitorStep() {
    final counts = _liveCounts;
    final status = Fmt.str(_session?['status'], 'Active');

    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: _refreshRecords,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    Fmt.str(_session?['title'], 'Attendance Session'),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                StatusBadge(status),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Show this QR code to students to scan',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),

            SizedBox(width: double.infinity, child: _buildQrCard()),
            const SizedBox(height: 20),

            AppCard(
              child: Column(
                children: [
                  InfoRow(
                    icon: Icons.calendar_today_outlined,
                    label: 'Date',
                    value: Fmt.dateWithDay(_session?['date']),
                  ),
                  InfoRow(
                    icon: Icons.access_time,
                    label: 'Time',
                    value:
                        '${Fmt.clock(Fmt.str(_session?['startTime']))} – ${Fmt.clock(Fmt.str(_session?['endTime']))}',
                  ),
                  InfoRow(
                    icon: Icons.groups_outlined,
                    label: Session.instance.isSpecialClassOfficer ? 'Roster' : 'Brigade',
                    value: Session.instance.isSpecialClassOfficer
                        ? '${Session.instance.program} Inclusive Learning Section'
                        : Fmt.str(_session?['brigade'], '—'),
                  ),
                  InfoRow(
                    icon: Icons.notes_outlined,
                    label: 'Notes',
                    value: Fmt.str(_session?['notes'], '—'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            _buildWarningBanner(),
            const SizedBox(height: 24),

            Row(
              children: [
                const Text(
                  'Attendance Progress',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const Spacer(),
                if (_isPolling)
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryMaroon),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildCountChip('Present', counts['Present']!, AppColors.success),
                const SizedBox(width: 8),
                _buildCountChip('Late', counts['Late']!, AppColors.lateStatus),
                const SizedBox(width: 8),
                _buildCountChip('Absent', counts['Absent']!, AppColors.error),
                const SizedBox(width: 8),
                _buildCountChip('Excused', counts['Excused']!, AppColors.blue),
              ],
            ),
            const SizedBox(height: 16),

            if (_liveRecords.isEmpty)
              const AppCard(
                child: AsyncView(
                  state: LoadState.empty,
                  compact: true,
                  emptyText: 'No check-ins yet.',
                  emptyIcon: Icons.qr_code_scanner,
                  child: SizedBox.shrink(),
                ),
              )
            else
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: _liveRecords
                      .map((record) => _buildLiveRecordTile(record))
                      .toList(),
                ),
              ),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _closeSession,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: const BorderSide(color: AppColors.error),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text(
                  'Close Session',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCountChip(String label, int count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text('$count', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildLiveRecordTile(Map<String, dynamic> record) {
    final student = record['studentId'];
    final user = student is Map ? student : const {};
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(user['name'], 'Trainee'),
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  '${Fmt.str(user['studentId'], '—')}  •  ${Fmt.str(record['time'], '---')}',
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          StatusBadge(Fmt.str(record['status'], 'Present'), dense: true),
        ],
      ),
    );
  }

  /// The QR code, prominent and centered, with the session code beneath it
  /// as a selectable fallback for when the image cannot be scanned.
  Widget _buildQrCard() {
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          Container(
            width: 220,
            height: 220,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: _sessionCode.isEmpty
                ? const Center(
                    child: Icon(Icons.qr_code,
                        size: 120, color: AppColors.textPrimary),
                  )
                : QrImageView(
                    data: _sessionCode,
                    version: QrVersions.auto,
                    padding: EdgeInsets.zero,
                    backgroundColor: AppColors.white,
                    errorStateBuilder: (context, error) => const Center(
                      child: Icon(Icons.qr_code,
                          size: 120, color: AppColors.textPrimary),
                    ),
                  ),
          ),
          if (_sessionCode.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text(
              'Session code',
              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.scaffoldBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: SelectableText(
                _sessionCode,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
    );
  }

  Widget _buildCheckTypeChip({required String label, required String value}) {
    final isSelected = _checkType == value;
    return GestureDetector(
      onTap: () => _onCheckTypeChanged(value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryMaroon : AppColors.grey100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? AppColors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildPairedSessionPicker() {
    if (_loadingInSessions) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryMaroon),
        ),
      );
    }

    if (_availableInSessions.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.scaffoldBg,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Text(
          'No check-in sessions for this date yet. Create the check-in QR '
          'code first.',
          style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
        ),
      );
    }

    return GestureDetector(
      onTap: () async {
        final picked = await showAppBottomSheet<Map<String, dynamic>>(
          context,
          title: 'Select a check-in session',
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: _availableInSessions.map((s) {
              final selected = s['_id'] == _pairedSession?['_id'];
              return ListTile(
                title: Text(Fmt.str(s['title'], 'Attendance Session')),
                subtitle: Text(
                  '${Fmt.clock(Fmt.str(s['startTime']))} – ${Fmt.clock(Fmt.str(s['endTime']))}',
                ),
                trailing: selected
                    ? const Icon(Icons.check, color: AppColors.primaryMaroon)
                    : null,
                onTap: () => Navigator.pop(context, s),
              );
            }).toList(),
          ),
        );
        if (picked != null) setState(() => _pairedSession = picked);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                _pairedSession == null
                    ? 'Select a check-in session'
                    : Fmt.str(_pairedSession?['title'], 'Attendance Session'),
                style: TextStyle(
                  fontSize: 14,
                  color: _pairedSession == null
                      ? AppColors.textSecondary
                      : AppColors.textPrimary,
                ),
              ),
            ),
            const Icon(Icons.keyboard_arrow_down, size: 18, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
