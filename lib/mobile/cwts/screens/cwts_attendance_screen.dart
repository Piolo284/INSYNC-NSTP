import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_view.dart';

class CwtsAttendanceScreen extends StatefulWidget {
  final VoidCallback? onBackToDashboard;

  const CwtsAttendanceScreen({super.key, this.onBackToDashboard});

  @override
  State<CwtsAttendanceScreen> createState() => _CwtsAttendanceScreenState();
}

class _CwtsAttendanceScreenState extends State<CwtsAttendanceScreen> {
  String _selectedFilter = 'All';

  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> attendanceRecords = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final records = await AttendanceService.instance.myRecords();
      if (!mounted) return;
      setState(() {
        attendanceRecords = records;
        _state = records.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  List<Map<String, dynamic>> get filteredRecords {
    if (_selectedFilter == 'All') return attendanceRecords;
    return attendanceRecords
        .where((record) => record['status'] == _selectedFilter)
        .toList();
  }

  /// Same palette the hard-coded cards used, now driven by the stored status.
  Color _statusColor(String status) {
    switch (status) {
      case 'Present':
        return Colors.green;
      case 'Absent':
        return Colors.red;
      case 'Late':
        return Colors.orange.shade800;
      case 'Excused':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  Color _statusBg(String status) {
    switch (status) {
      case 'Present':
        return const Color(0xFFD4F8D4);
      case 'Absent':
        return const Color(0xFFFFD4D4);
      case 'Late':
        return const Color(0xFFFFF3CD);
      case 'Excused':
        return const Color(0xFFD4E9FF);
      default:
        return Colors.grey.shade200;
    }
  }

  /// The activity/session name the record belongs to.
  String _titleOf(Map<String, dynamic> record) {
    final activity = record['activityId'];
    if (activity is Map && activity['title'] != null) {
      return activity['title'].toString();
    }
    final session = record['sessionId'];
    if (session is Map && session['title'] != null) {
      return session['title'].toString();
    }
    return Fmt.str(record['title'], 'NSTP Session');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => widget.onBackToDashboard?.call(),
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
            icon: const Icon(Icons.refresh, color: Colors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade200),
              ),
            ),
            child: Row(
              children: [
                _buildFilterTab('All'),
                _buildFilterTab('Present'),
                _buildFilterTab('Absent'),
                _buildFilterTab('Late'),
              ],
            ),
          ),
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No attendance records yet.',
              emptyIcon: Icons.event_busy_outlined,
              child: filteredRecords.isEmpty
                  ? AsyncView(
                      state: LoadState.empty,
                      emptyText: 'No $_selectedFilter records.',
                      emptyIcon: Icons.filter_alt_off_outlined,
                      onRetry: () => setState(() => _selectedFilter = 'All'),
                      child: const SizedBox.shrink(),
                    )
                  : RefreshIndicator(
                      color: AppColors.primaryMaroon,
                      onRefresh: _load,
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        itemCount: filteredRecords.length,
                        itemBuilder: (context, index) {
                          return _buildAttendanceCard(filteredRecords[index]);
                        },
                      ),
                    ),
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
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color:
                    isSelected ? AppColors.primaryMaroon : Colors.grey.shade500,
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

  Widget _buildAttendanceCard(Map<String, dynamic> record) {
    final status = Fmt.str(record['status'], 'Present');
    final time = Fmt.str(record['time'], '---');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.date(record['date']),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _titleOf(record),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                if (Fmt.str(record['remarks']).isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    Fmt.str(record['remarks']),
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade500,
                      fontStyle: FontStyle.italic,
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
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: _statusBg(status),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _statusColor(status),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                time.isEmpty ? '---' : time,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
