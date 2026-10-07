import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../cwts_officer_student_detail_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Drill-down list behind each officer dashboard stat card.
/// [category] decides which attendance status (or the at-risk list) is loaded.
class CwtsOfficerAttendanceListScreen extends StatefulWidget {
  final String category;

  /// Pre-selects the date filter — set when drilling in from a dashboard
  /// stat card, so the list only shows that day's students instead of the
  /// full history.
  final DateTime? initialDate;

  const CwtsOfficerAttendanceListScreen({
    super.key,
    required this.category,
    this.initialDate,
  });

  @override
  State<CwtsOfficerAttendanceListScreen> createState() =>
      _CwtsOfficerAttendanceListScreenState();
}

class _CwtsOfficerAttendanceListScreenState
    extends State<CwtsOfficerAttendanceListScreen> {
  final TextEditingController _searchController = TextEditingController();

  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _rows = const [];

  /// null means "all dates" — matches the dashboard totals it drills into.
  /// Seeded from [widget.initialDate] when arriving from a stat card.
  late DateTime? _selectedDate = widget.initialDate;

  /// Only used when [widget.category] is 'All Attendance' — the search/filter
  /// entry point lands here and can narrow by status from that one screen.
  String? _statusFilter;

  bool _isNotifying = false;
  bool _isExporting = false;

  /// userId of the drop review currently being saved (disables its buttons).
  String? _reviewingUserId;

  bool get _isAtRisk => widget.category == 'At-Risk Students';
  bool get _isAllAttendance => widget.category == 'All Attendance';

  /// Maps the dashboard card label onto an attendance status.
  String? get _status {
    switch (widget.category) {
      case 'Presents':
        return 'Present';
      case 'Absents':
        return 'Absent';
      case 'Late Students':
        return 'Late';
      case 'Excused Students':
        return 'Excused';
      case 'All Attendance':
        return _statusFilter;
      default:
        return null;
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final List<Map<String, dynamic>> rows;

      if (_isAtRisk) {
        rows = await AttendanceService.instance.atRisk();
      } else {
        rows = await AttendanceService.instance.list(
          program: Session.instance.program,
          status: _status,
          date: _selectedDate,
          limit: 300,
        );
      }

      if (!mounted) return;
      setState(() {
        _rows = rows;
        _state = rows.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  /// Normalises both shapes (at-risk aggregate vs attendance row) into one tile
  /// model, so the list renders identically either way.
  Map<String, String> _rowData(Map<String, dynamic> row) {
    if (_isAtRisk) {
      return {
        'userId': Fmt.str(row['userId']),
        'name': Fmt.str(row['name'], 'Trainee'),
        'idNumber': Fmt.str(row['studentId'], '—'),
        'subtitle':
            '${Fmt.toInt(row['absents'])}/${Fmt.toInt(row['totalSessions'])} Absents',
        'image': '',
        'pendingDrop': row['pendingDrop'] == true ? 'true' : '',
      };
    }

    final student = row['studentId'];
    final user = student is Map ? student : const {};
    final checkOutTime = Fmt.str(row['checkOutTime']);
    final timeLabel = checkOutTime.isEmpty
        ? Fmt.str(row['time'], '---')
        : '${Fmt.str(row['time'], '---')} → $checkOutTime';
    return {
      'userId': Fmt.str(user['_id']),
      'name': Fmt.str(user['name'], 'Trainee'),
      'idNumber': Fmt.str(user['studentId'], '—'),
      'subtitle': '${Fmt.date(row['date'])}  •  $timeLabel',
      'image': Fmt.str(user['profileImage']),
    };
  }

  List<Map<String, dynamic>> get _filteredRows {
    final query = _searchController.text.toLowerCase();
    if (query.isEmpty) return _rows;
    return _rows.where((row) {
      final data = _rowData(row);
      return data['name']!.toLowerCase().contains(query) ||
          data['idNumber']!.toLowerCase().contains(query);
    }).toList();
  }

  /// Reaching the absence limit only flags a trainee — the officer decides.
  /// Both choices ask for confirmation first.
  Future<void> _reviewDrop(Map<String, String> data, {required bool drop}) async {
    final name = data['name']!;
    final confirmed = await showConfirmDialog(
      context,
      title: drop ? 'Drop out $name?' : 'Keep $name enrolled?',
      message: drop
          ? '$name has ${data['subtitle']}. Dropping them out removes them from ${Session.instance.program}: '
              'they can no longer sign in or take part. Are you sure you want to drop out this trainee?'
          : '$name has ${data['subtitle']}. They will stay enrolled and will only be reviewed '
              'again if they get another absence.',
      confirmLabel: drop ? 'Drop Out' : 'Keep Enrolled',
      danger: drop,
    );
    if (!confirmed || !mounted) return;

    setState(() => _reviewingUserId = data['userId']);
    try {
      final message = drop
          ? await AttendanceService.instance.confirmDrop(data['userId']!)
          : await AttendanceService.instance.keepEnrolled(data['userId']!);
      if (!mounted) return;
      AppSnack.success(context, message);
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _reviewingUserId = null);
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
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
      await _load();
    }
  }

  Future<void> _notifyAll() async {
    if (_isNotifying) return;
    if (_rows.isEmpty) {
      AppSnack.info(context, 'There is nobody to notify.');
      return;
    }

    setState(() => _isNotifying = true);
    try {
      var sent = 0;
      for (final row in _rows) {
        final userId = _rowData(row)['userId']!;
        if (userId.isEmpty) continue;
        await ApiService.instance.post('/notifications', body: {
          'recipientId': userId,
          'title': 'Attendance warning',
          'message':
              'You are close to the absence limit for ${Session.instance.program}. '
                  'Please contact your officer.',
          'type': 'attendance',
        });
        sent++;
      }

      if (!mounted) return;
      AppSnack.success(context, 'Notified $sent trainee(s).');
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isNotifying = false);
    }
  }

  Future<void> _openFilterSheet() async {
    final options = const ['All', 'Present', 'Late', 'Absent', 'Excused'];
    final picked = await showAppBottomSheet<String>(
      context,
      title: 'Filter by status',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: options.map((status) {
          final value = status == 'All' ? null : status;
          final selected = _statusFilter == value;
          return ListTile(
            title: Text(status),
            trailing: selected ? const Icon(Icons.check, color: AppColors.primaryMaroon) : null,
            onTap: () => Navigator.pop(context, status),
          );
        }).toList(),
      ),
    );
    if (picked == null) return;
    setState(() => _statusFilter = picked == 'All' ? null : picked);
    await _load();
  }

  String _csvCell(String value) {
    final escaped = value.replaceAll('"', '""');
    return '"$escaped"';
  }

  Future<void> _export() async {
    if (_isExporting) return;
    if (_filteredRows.isEmpty) {
      AppSnack.info(context, 'There is nothing to export.');
      return;
    }

    setState(() => _isExporting = true);
    try {
      final header = [
        'Student Number',
        'Name',
        'Program',
        'Date',
        'Status',
        'Time',
        'Remarks',
      ].map(_csvCell).join(',');

      final lines = _filteredRows.map((row) {
        final data = _rowData(row);
        final status = _isAtRisk ? 'At-Risk' : Fmt.str(row['status'], _status ?? '');
        return [
          data['idNumber'] ?? '',
          data['name'] ?? '',
          Fmt.str(row['program'], Session.instance.program),
          _isAtRisk ? '' : Fmt.date(row['date']),
          status,
          _isAtRisk ? '' : Fmt.str(row['time']),
          Fmt.str(row['remarks']),
        ].map(_csvCell).join(',');
      });

      final csv = ([header, ...lines]).join('\r\n');
      final fileName =
          '${Session.instance.program.toLowerCase()}-attendance-${widget.category.toLowerCase().replaceAll(' ', '-')}.csv';

      final savedPath = await FilePicker.platform.saveFile(
        dialogTitle: 'Save attendance export',
        fileName: fileName,
        bytes: Uint8List.fromList(csv.codeUnits),
      );

      if (!mounted) return;
      if (savedPath == null) {
        AppSnack.info(context, 'Export cancelled.');
      } else {
        AppSnack.success(context, 'Attendance exported.');
      }
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
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
          widget.category,
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: _isAtRisk
            ? [
                TextButton(
                  onPressed: _isNotifying ? null : _notifyAll,
                  child: _isNotifying
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white),
                        )
                      : const Text(
                          'Notify all',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                ),
              ]
            : [
                if (_isAllAttendance)
                  IconButton(
                    icon: const Icon(Icons.filter_list, color: AppColors.white, size: 20),
                    onPressed: _openFilterSheet,
                  ),
                IconButton(
                  icon: _isExporting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white),
                        )
                      : const Icon(Icons.file_download_outlined, color: AppColors.white, size: 20),
                  onPressed: _isExporting ? null : _export,
                ),
                IconButton(
                  icon: const Icon(Icons.refresh,
                      color: AppColors.white, size: 20),
                  onPressed: _load,
                ),
              ],
      ),
      body: Column(
        children: [
          // ===== SEARCH BAR =====
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  hintText: 'Search student..',
                  hintStyle: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                  prefixIcon: Icon(Icons.search, color: AppColors.textSecondary),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ===== DATE FILTER =====
          if (!_isAtRisk)
            Center(
              child: GestureDetector(
                onTap: _pickDate,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.cardBg,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _selectedDate == null
                            ? 'All dates'
                            : Fmt.dateWithDay(_selectedDate),
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (_selectedDate != null)
                        GestureDetector(
                          onTap: () {
                            setState(() => _selectedDate = null);
                            _load();
                          },
                          child: const Icon(Icons.close,
                              size: 16, color: AppColors.textSecondary),
                        )
                      else
                        const Icon(Icons.keyboard_arrow_down,
                            size: 18, color: AppColors.textSecondary),
                    ],
                  ),
                ),
              ),
            ),
          if (!_isAtRisk) const SizedBox(height: 12),

          // ===== STUDENT LIST =====
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: _isAtRisk
                  ? 'No trainee is near the absence limit.'
                  : 'No ${widget.category.toLowerCase()} found.',
              emptyIcon: Icons.people_outline,
              child: RefreshIndicator(
                color: AppColors.primaryMaroon,
                onRefresh: _load,
                child: ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  itemCount: _filteredRows.length,
                  itemBuilder: (context, index) {
                    return _buildStudentTile(_filteredRows[index]);
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentTile(Map<String, dynamic> row) {
    final data = _rowData(row);
    final status = _status;
    final pendingDrop = _isAtRisk && data['pendingDrop'] == 'true';
    final busy = _reviewingUserId == data['userId'];

    final tile = AppCard(
      margin: pendingDrop ? EdgeInsets.zero : const EdgeInsets.only(bottom: 10),
      onTap: data['userId']!.isEmpty
          ? null
          : () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CwtsOfficerStudentDetailScreen(
                    userId: data['userId']!,
                    name: data['name']!,
                    idNumber: data['idNumber']!,
                  ),
                ),
              );
            },
      child: Row(
        children: [
          UserAvatar(
            imagePath: data['image'],
            radius: 22,
            iconSize: 20,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data['name']!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${data['idNumber']} – ${data['subtitle']}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (status != null)
            StatusBadge(status, dense: true)
          else if (pendingDrop)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.errorLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'For Drop Review',
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.error),
              ),
            )
          else if (_isAtRisk)
            const Icon(
              Icons.error_outline,
              color: AppColors.error,
              size: 20,
            ),
          const SizedBox(width: 4),
          const Icon(
            Icons.chevron_right,
            color: AppColors.textSecondary,
            size: 20,
          ),
        ],
      ),
    );

    if (!pendingDrop) return tile;

    // At the absence limit: nothing happens until the officer decides.
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
          border: Border.all(color: AppColors.error.withValues(alpha: 0.35)),
        ),
        child: Column(
          children: [
            tile,
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: busy ? null : () => _reviewDrop(data, drop: false),
                      child: const Text('Keep'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: busy ? null : () => _reviewDrop(data, drop: true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.error,
                        foregroundColor: AppColors.white,
                      ),
                      child: busy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white),
                            )
                          : const Text('Drop Out'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
