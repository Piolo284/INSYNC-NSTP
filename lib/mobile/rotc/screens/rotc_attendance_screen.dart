import 'package:flutter/material.dart';
import '../../shared/contest_absence_sheet.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/attendance_filter_request.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/status_badge.dart';

class RotcAttendanceScreen extends StatefulWidget {
  final VoidCallback? onBackToDashboard;

  /// Status tab to open on ('All', 'Present', 'Late', 'Absent', 'Excused').
  final String initialFilter;

  /// Set by the shell so the dashboard's status counts can switch this tab
  /// to the matching filter.
  final AttendanceFilterRequest? filterRequest;

  const RotcAttendanceScreen({
    super.key,
    this.onBackToDashboard,
    this.initialFilter = 'All',
    this.filterRequest,
  });

  @override
  State<RotcAttendanceScreen> createState() => _RotcAttendanceScreenState();
}

class _RotcAttendanceScreenState extends State<RotcAttendanceScreen> {
  static const List<String> _filters = [
    'All',
    'Present',
    'Late',
    'Absent',
    'Excused',
  ];

  late String _selectedFilter =
      _filters.contains(widget.initialFilter) ? widget.initialFilter : 'All';

  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> attendanceRecords = const [];
  List<Map<String, dynamic>> _contests = const [];

  @override
  void initState() {
    super.initState();
    widget.filterRequest?.addListener(_applyFilterRequest);
    _load();
  }

  @override
  void didUpdateWidget(covariant RotcAttendanceScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.filterRequest != widget.filterRequest) {
      oldWidget.filterRequest?.removeListener(_applyFilterRequest);
      widget.filterRequest?.addListener(_applyFilterRequest);
    }
  }

  @override
  void dispose() {
    widget.filterRequest?.removeListener(_applyFilterRequest);
    super.dispose();
  }

  void _applyFilterRequest() {
    final filter = widget.filterRequest?.filter ?? 'All';
    if (!_filters.contains(filter)) return;
    setState(() => _selectedFilter = filter);
    // The tab stays alive in the shell's IndexedStack, so refresh the records.
    _load();
  }

  /// Tapping a summary tile filters the history to it; tapping it again
  /// clears back to All.
  void _toggleFilter(String status) {
    setState(() => _selectedFilter = _selectedFilter == status ? 'All' : status);
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final results = await Future.wait([
        AttendanceService.instance.myRecords(),
        AttendanceService.instance.myContests(),
      ]);
      if (!mounted) return;
      setState(() {
        attendanceRecords = results[0];
        _contests = results[1];
        _state = attendanceRecords.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  /// The cadet's own filed contest for one record, if any — overlays
  /// Pending/Approved/Rejected on top of the plain Absent badge.
  Map<String, dynamic>? _contestFor(String attendanceId) {
    for (final contest in _contests) {
      if (Fmt.str(contest['attendanceId']) == attendanceId) return contest;
    }
    return null;
  }

  Future<void> _contestAbsence(Map<String, dynamic> record) async {
    final filed = await showContestAbsenceSheet(
      context,
      attendanceId: Fmt.str(record['_id']),
      activityTitle: _titleOf(record),
      date: Fmt.date(record['date']),
    );
    if (filed == true) await _load();
  }

  List<Map<String, dynamic>> get filteredRecords {
    if (_selectedFilter == 'All') return attendanceRecords;
    return attendanceRecords
        .where((record) => Fmt.str(record['status'], 'Present') == _selectedFilter)
        .toList();
  }

  int _countOf(String status) => attendanceRecords
      .where((record) => Fmt.str(record['status'], 'Present') == status)
      .length;

  /// Present + Late both count as "attended" — only Absent/Excused sit outside it.
  double get _attendanceRate {
    final total = attendanceRecords.length;
    if (total == 0) return 0;
    final attended = _countOf('Present') + _countOf('Late');
    return attended / total * 100;
  }

  String _titleOf(Map<String, dynamic> record) {
    final activity = record['activityId'];
    if (activity is Map && activity['title'] != null) {
      return activity['title'].toString();
    }
    final session = record['sessionId'];
    if (session is Map && session['title'] != null) {
      return session['title'].toString();
    }
    return Fmt.str(record['title'], 'ROTC Session');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          // As a bottom-nav tab the shell passes onBackToDashboard (switch to
          // Home). Opened from "View all" it's a pushed route with no
          // callback — pop back to the screen it was opened from.
          onPressed: () {
            final backToDashboard = widget.onBackToDashboard;
            if (backToDashboard != null) {
              backToDashboard();
            } else {
              Navigator.maybePop(context);
            }
          },
        ),
        title: const Text(
          'Attendance',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            decoration: const BoxDecoration(
              color: AppColors.white,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: _filters.map(_buildFilterTab).toList(),
            ),
          ),
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No attendance records yet.',
              emptyIcon: Icons.event_busy_outlined,
              child: RefreshIndicator(
                color: AppColors.primaryMaroon,
                onRefresh: _load,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildSummaryCard(),
                    const SizedBox(height: 20),
                    SectionHeader(
                      title: 'History',
                      subtitle: '${filteredRecords.length} '
                          '${filteredRecords.length == 1 ? 'record' : 'records'}',
                    ),
                    const SizedBox(height: 12),
                    if (filteredRecords.isEmpty)
                      AsyncView(
                        state: LoadState.empty,
                        compact: true,
                        emptyText: 'No $_selectedFilter records.',
                        emptyIcon: Icons.filter_alt_off_outlined,
                        onRetry: () => setState(() => _selectedFilter = 'All'),
                        child: const SizedBox.shrink(),
                      )
                    else
                      ...filteredRecords.map(_buildAttendanceCard),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Attendance Summary'),
          const SizedBox(height: 14),
          Row(
            children: [
              _StatTile(
                label: 'Present',
                count: _countOf('Present'),
                status: 'Present',
                selected: _selectedFilter == 'Present',
                onTap: () => _toggleFilter('Present'),
              ),
              const SizedBox(width: 8),
              _StatTile(
                label: 'Late',
                count: _countOf('Late'),
                status: 'Late',
                selected: _selectedFilter == 'Late',
                onTap: () => _toggleFilter('Late'),
              ),
              const SizedBox(width: 8),
              _StatTile(
                label: 'Absent',
                count: _countOf('Absent'),
                status: 'Absent',
                selected: _selectedFilter == 'Absent',
                onTap: () => _toggleFilter('Absent'),
              ),
              const SizedBox(width: 8),
              _StatTile(
                label: 'Excused',
                count: _countOf('Excused'),
                status: 'Excused',
                selected: _selectedFilter == 'Excused',
                onTap: () => _toggleFilter('Excused'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Attendance Rate',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              Text(
                '${_attendanceRate.toStringAsFixed(0)}%',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryMaroon,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: LinearProgressIndicator(
              value: (_attendanceRate / 100).clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: AppColors.grey100,
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primaryMaroon),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab(String label) {
    final isSelected = _selectedFilter == label;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedFilter = label),
        child: Column(
          children: [
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? AppColors.primaryMaroon : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              height: 2,
              color: isSelected ? AppColors.primaryMaroon : Colors.transparent,
            ),
          ],
        ),
      ),
    );
  }

  /// "Originally Absent → Approved as Present" / "Contest rejected: …".
  String _contestNote(Map<String, dynamic>? contest) {
    if (contest == null) return '';
    switch (Fmt.str(contest['status'])) {
      case 'Approved':
        final approvedAs = Fmt.str(contest['approvedAs'], 'Excused');
        return 'Originally Absent → Approved as ${approvedAs == 'Present' ? 'Present' : 'Excuse'}';
      case 'Rejected':
        final note = Fmt.str(contest['reviewNote']);
        return note.isEmpty ? 'Contest rejected — counted as Absent' : 'Contest rejected: $note';
      default:
        return '';
    }
  }

  Widget _buildAttendanceCard(Map<String, dynamic> record) {
    final status = Fmt.str(record['status'], 'Present');
    final time = Fmt.str(record['time'], '---');
    final contest = _contestFor(Fmt.str(record['_id']));
    final contestStatus = Fmt.str(contest?['status']);
    // Final status always comes from the record itself (Present / Excused
    // after an approval, Absent after a rejection); only a still-pending
    // contest overlays "Pending Review" on the Absent badge.
    final displayStatus = status == 'Absent' && contestStatus == 'Pending' ? 'Pending' : status;
    final contestNote = _contestNote(contest);

    return AppCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.date(record['date']),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Text(
                  _titleOf(record),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (Fmt.str(record['remarks']).isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    Fmt.str(record['remarks']),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
                if (contestNote.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    contestNote,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: contestStatus == 'Rejected' ? AppColors.error : AppColors.success,
                    ),
                  ),
                ],
                if (status == 'Absent' && contest == null) ...[
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () => _contestAbsence(record),
                    child: const Text(
                      'Contest this absence',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primaryMaroon,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              StatusBadge(displayStatus == 'Pending' ? 'Pending Review' : displayStatus),
              const SizedBox(height: 6),
              Text(
                time.isEmpty ? '---' : time,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// One count tile inside the attendance summary card — color follows the
/// same status→color mapping as [StatusBadge] so the summary and the history
/// list below always agree visually.
class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.count,
    required this.status,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final int count;
  final String status;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final style = StatusStyle.of(status);
    final radius = BorderRadius.circular(AppColors.radiusSm);
    return Expanded(
      child: Material(
        color: style.background,
        borderRadius: radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(
                color: selected ? style.color : Colors.transparent,
                width: 1.5,
              ),
            ),
            child: Column(
              children: [
                Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: style.color,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: style.color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
