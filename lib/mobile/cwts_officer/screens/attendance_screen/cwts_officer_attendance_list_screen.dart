import 'package:flutter/material.dart';
import '../cwts_officer_student_detail_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Drill-down list behind each officer dashboard stat card.
/// [category] decides which attendance status (or the at-risk list) is loaded.
class CwtsOfficerAttendanceListScreen extends StatefulWidget {
  final String category;

  const CwtsOfficerAttendanceListScreen({
    super.key,
    required this.category,
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
  DateTime? _selectedDate;

  bool get _isAtRisk => widget.category == 'At-Risk Students';

  /// Maps the dashboard card label onto an attendance status.
  String? get _status {
    switch (widget.category) {
      case 'Presents':
        return 'Present';
      case 'Absents':
        return 'Absent';
      case 'Late Students':
        return 'Late';
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
      };
    }

    final student = row['studentId'];
    final user = student is Map ? student : const {};
    return {
      'userId': Fmt.str(user['_id']),
      'name': Fmt.str(user['name'], 'Trainee'),
      'idNumber': Fmt.str(user['studentId'], '—'),
      'subtitle':
          '${Fmt.date(row['date'])}  •  ${Fmt.str(row['time'], '---')}',
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
    if (_rows.isEmpty) {
      AppSnack.info(context, 'There is nobody to notify.');
      return;
    }

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
    }
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
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.category,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: _isAtRisk
            ? [
                TextButton(
                  onPressed: _notifyAll,
                  child: const Text(
                    'Notify all',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ]
            : [
                IconButton(
                  icon: const Icon(Icons.refresh,
                      color: Colors.white, size: 20),
                  onPressed: _load,
                ),
              ],
      ),
      body: Column(
        children: [
          // ===== SEARCH BAR =====
          Padding(
            padding: const EdgeInsets.all(16),
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
                  hintText: 'Search student..',
                  hintStyle: TextStyle(
                    color: Colors.grey.shade400,
                    fontSize: 14,
                  ),
                  prefixIcon: Icon(Icons.search, color: Colors.grey.shade400),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
              ),
            ),
          ),

          // ===== DATE DROPDOWN =====
          if (!_isAtRisk)
            Center(
              child: GestureDetector(
                onTap: _pickDate,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _selectedDate == null
                            ? 'All dates'
                            : Fmt.dateWithDay(_selectedDate),
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade700,
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (_selectedDate != null)
                        GestureDetector(
                          onTap: () {
                            setState(() => _selectedDate = null);
                            _load();
                          },
                          child: Icon(Icons.close,
                              size: 16, color: Colors.grey.shade600),
                        )
                      else
                        Icon(Icons.keyboard_arrow_down,
                            size: 18, color: Colors.grey.shade600),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 12),

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
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _filteredRows.length,
                  separatorBuilder: (_, __) => Divider(
                    color: Colors.grey.shade200,
                    height: 1,
                  ),
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

    return InkWell(
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
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
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
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${data['idNumber']} – ${data['subtitle']}',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: Colors.grey.shade400,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
