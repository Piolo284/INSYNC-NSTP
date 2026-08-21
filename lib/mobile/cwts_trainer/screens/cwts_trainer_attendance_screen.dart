import 'package:flutter/material.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';

/// Instructor attendance monitor. Class/session dropdowns filter real records,
/// the stat cards show live totals, and each row can be corrected inline.
class CwtsTrainerAttendanceScreen extends StatefulWidget {
  const CwtsTrainerAttendanceScreen({super.key});

  @override
  State<CwtsTrainerAttendanceScreen> createState() =>
      _CwtsTrainerAttendanceScreenState();
}

class _CwtsTrainerAttendanceScreenState
    extends State<CwtsTrainerAttendanceScreen> {
  String _selectedClass = 'All Classes';
  String _selectedStatus = 'All';

  final TextEditingController _searchController = TextEditingController();

  LoadState _state = LoadState.loading;
  String _error = '';

  List<Map<String, dynamic>> _records = const [];
  int _totalStudents = 0;

  static const List<String> _statuses = [
    'All',
    'Present',
    'Late',
    'Absent',
    'Excused',
  ];

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
      final results = await Future.wait([
        AttendanceService.instance.list(
          program: Session.instance.program,
          status: _selectedStatus == 'All' ? null : _selectedStatus,
          limit: 300,
        ),
        AttendanceService.instance.summary(),
      ]);

      if (!mounted) return;
      final summary = results[1] as Map<String, dynamic>;
      setState(() {
        _records = results[0] as List<Map<String, dynamic>>;
        _totalStudents = Fmt.toInt(summary['totalStudents']);
        _state = _records.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  Map<String, dynamic> _userOf(Map<String, dynamic> record) {
    final s = record['studentId'];
    return s is Map ? s.cast<String, dynamic>() : const {};
  }

  /// Section values present in the loaded data, so the dropdown is never stale.
  List<String> get _classOptions {
    final sections = _records
        .map((r) => Fmt.str(_userOf(r)['section']))
        .where((s) => s.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    return ['All Classes', ...sections];
  }

  List<Map<String, dynamic>> get _filtered {
    final query = _searchController.text.toLowerCase();

    return _records.where((r) {
      final user = _userOf(r);

      if (_selectedClass != 'All Classes' &&
          Fmt.str(user['section']) != _selectedClass) {
        return false;
      }
      if (query.isEmpty) return true;

      return Fmt.str(user['name']).toLowerCase().contains(query) ||
          Fmt.str(user['studentId']).toLowerCase().contains(query);
    }).toList();
  }

  int _countOf(String status) =>
      _filtered.where((r) => r['status'] == status).length;

  Color _statusColor(String status) {
    switch (status) {
      case 'Present':
        return Colors.green;
      case 'Late':
        return Colors.amber.shade700;
      case 'Absent':
        return Colors.red.shade400;
      case 'Excused':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  Future<void> _changeStatus(Map<String, dynamic> record) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 16),
            Text(
              Fmt.str(_userOf(record)['name'], 'Trainee'),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            ..._statuses.skip(1).map(
                  (option) => ListTile(
                    leading: Icon(Icons.circle,
                        size: 12, color: _statusColor(option)),
                    title: Text(option, style: const TextStyle(fontSize: 14)),
                    trailing: record['status'] == option
                        ? const Icon(Icons.check,
                            color: AppColors.primaryMaroon)
                        : null,
                    onTap: () => Navigator.pop(sheetContext, option),
                  ),
                ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (picked == null || picked == record['status'] || !mounted) return;

    try {
      await AttendanceService.instance
          .update(Fmt.str(record['_id']), status: picked);
      if (!mounted) return;
      AppSnack.success(context, 'Marked $picked.');
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  void _export() {
    final url =
        '${AppConfig.apiBaseUrl}/grades/report/export?program=${Session.instance.program}';
    AppSnack.info(context, 'CSV report: $url');
  }

  @override
  Widget build(BuildContext context) {
    final classOptions = _classOptions;
    final classValue =
        classOptions.contains(_selectedClass) ? _selectedClass : 'All Classes';
    final filtered = _filtered;
    final present = _countOf('Present');
    final absent = _countOf('Absent');
    final total = filtered.length;

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text(
          'Attendance',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          // ===== DROPDOWN ROW =====
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Row(
              children: [
                Expanded(
                  child: _buildDropdown(
                    value: classValue,
                    items: classOptions,
                    onChanged: (v) => setState(() => _selectedClass = v!),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildDropdown(
                    value: _selectedStatus,
                    items: _statuses,
                    onChanged: (v) {
                      setState(() => _selectedStatus = v!);
                      _load();
                    },
                  ),
                ),
              ],
            ),
          ),

          // ===== STATS CARDS =====
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            child: Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    label: 'Total Students',
                    value: '$_totalStudents',
                    dotColor: Colors.grey.shade400,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard(
                    label: 'Present',
                    value: total == 0
                        ? '0'
                        : '$present (${((present / total) * 100).round()}%)',
                    dotColor: Colors.green,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard(
                    label: 'Absent',
                    value: total == 0
                        ? '0'
                        : '$absent (${((absent / total) * 100).round()}%)',
                    dotColor: Colors.red.shade400,
                  ),
                ),
              ],
            ),
          ),
          Divider(color: Colors.grey.shade200, height: 1),

          // ===== STUDENT ATTENDANCE HEADER =====
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Student Attendance',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ),
          ),

          // ===== SEARCH BAR =====
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Search students',
                  hintStyle:
                      TextStyle(color: Colors.grey.shade400, fontSize: 14),
                  prefixIcon: Icon(Icons.search, color: Colors.grey.shade400),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ===== TABLE HEADER =====
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(
                      'Student',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade700,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      'Attendance',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 30),
                ],
              ),
            ),
          ),

          // ===== STUDENT LIST =====
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No attendance records yet.',
              emptyIcon: Icons.event_busy_outlined,
              child: filtered.isEmpty
                  ? const AsyncView(
                      state: LoadState.empty,
                      emptyText: 'No records match these filters.',
                      emptyIcon: Icons.filter_alt_off_outlined,
                      child: SizedBox.shrink(),
                    )
                  : RefreshIndicator(
                      color: AppColors.primaryMaroon,
                      onRefresh: _load,
                      child: ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) =>
                            Divider(color: Colors.grey.shade200, height: 1),
                        itemBuilder: (context, index) {
                          return _buildRow(filtered[index]);
                        },
                      ),
                    ),
            ),
          ),

          // ===== EXPORT BUTTON =====
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(16),
            child: SafeArea(
              top: false,
              child: OutlinedButton.icon(
                onPressed: _export,
                icon: const Icon(Icons.upload,
                    color: AppColors.primaryMaroon, size: 18),
                label: const Text(
                  'Export Attendance',
                  style: TextStyle(
                    color: AppColors.primaryMaroon,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48),
                  side: const BorderSide(color: AppColors.primaryMaroon),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(Map<String, dynamic> record) {
    final user = _userOf(record);
    final status = Fmt.str(record['status'], 'Present');

    return InkWell(
      onTap: () => _changeStatus(record),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: Colors.grey.shade200,
              child: const Icon(Icons.person, size: 16, color: Colors.white),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    Fmt.str(user['name'], 'Trainee'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.black87,
                    ),
                  ),
                  Text(
                    Fmt.date(record['date']),
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _statusColor(status).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _statusColor(status),
                  ),
                ),
              ),
            ),
            SizedBox(
              width: 30,
              child:
                  Icon(Icons.more_vert, color: Colors.grey.shade400, size: 18),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDropdown({
    required String value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          value: value,
          icon: Icon(Icons.keyboard_arrow_down,
              color: Colors.grey.shade600, size: 18),
          style: TextStyle(fontSize: 13, color: Colors.grey.shade800),
          onChanged: onChanged,
          items: items
              .map((i) => DropdownMenuItem(
                    value: i,
                    child: Text(i, overflow: TextOverflow.ellipsis),
                  ))
              .toList(),
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required String label,
    required String value,
    required Color dotColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade600,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          FittedBox(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
