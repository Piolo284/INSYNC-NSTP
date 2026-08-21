import 'dart:async';

import 'package:flutter/material.dart';
import 'package:marsu_nstp_portal/core/config/app_config.dart';
import 'package:marsu_nstp_portal/core/constants/app_colors.dart';
import 'package:marsu_nstp_portal/core/services/services.dart';
import 'package:marsu_nstp_portal/core/utils/formatters.dart';
import 'package:marsu_nstp_portal/core/widgets/async_view.dart';

/// Instructor students list backed by the computed Grade records, so the grade,
/// status and attendance figures shown here always match the database.
class CwtsTrainerStudentsScreen extends StatefulWidget {
  const CwtsTrainerStudentsScreen({super.key});

  @override
  State<CwtsTrainerStudentsScreen> createState() =>
      _CwtsTrainerStudentsScreenState();
}

class _CwtsTrainerStudentsScreenState extends State<CwtsTrainerStudentsScreen> {
  String searchQuery = '';
  String selectedFilter = 'All';
  Timer? _debounce;

  LoadState _state = LoadState.loading;
  String _error = '';

  List<Map<String, dynamic>> students = const [];
  Map<String, dynamic> _stats = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final result = await GradeService.instance.list(
        program: Session.instance.program,
        search: searchQuery.trim(),
      );

      if (!mounted) return;
      final list = (result['data'] as List).cast<Map<String, dynamic>>();
      setState(() {
        students = list;
        _stats = result['stats'] as Map<String, dynamic>;
        _state = list.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  void _onSearchChanged(String value) {
    setState(() => searchQuery = value);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  /// The Grade document embeds the trainee via `studentId`.
  Map<String, dynamic> _userOf(Map<String, dynamic> grade) {
    final s = grade['studentId'];
    return s is Map ? s.cast<String, dynamic>() : const {};
  }

  List<Map<String, dynamic>> get filteredStudents {
    if (selectedFilter == 'All') return students;
    return students
        .where((s) => Fmt.str(s['remarks']) == selectedFilter)
        .toList();
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'Passed':
        return AppColors.success;
      case 'Warning':
        return AppColors.orange;
      case 'Failed':
        return AppColors.error;
      default:
        return AppColors.grey900;
    }
  }

  Color _getStatusBgColor(String status) {
    switch (status) {
      case 'Passed':
        return AppColors.greenLight;
      case 'Warning':
        return AppColors.orangeLight;
      case 'Failed':
        return AppColors.errorLight;
      default:
        return AppColors.cardBg;
    }
  }

  /// Recomputes every grade in the program, then points the instructor at the
  /// CSV endpoint. (The file itself is served by the API for download.)
  Future<void> _exportRecords() async {
    try {
      final count = await GradeService.instance
          .recalculate(program: Session.instance.program);
      if (!mounted) return;

      final url =
          '${AppConfig.apiBaseUrl}/grades/report/export?program=${Session.instance.program}';
      AppSnack.success(
        context,
        '$count grade(s) recalculated. CSV report: $url',
      );
      await _load();
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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text(
          'Students',
          style: TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Search student...',
                hintStyle: TextStyle(color: Colors.grey.shade400),
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                filled: true,
                fillColor: Colors.grey.shade100,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),

          // Filter Chips
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _buildFilterChip('All'),
                const SizedBox(width: 8),
                _buildFilterChip('Passed'),
                const SizedBox(width: 8),
                _buildFilterChip('Warning'),
                const SizedBox(width: 8),
                _buildFilterChip('Failed'),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Stats Row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _buildMiniStat('Total', '${students.length}'),
                const SizedBox(width: 8),
                _buildMiniStat('Passed', '${Fmt.toInt(_stats['passed'])}'),
                const SizedBox(width: 8),
                _buildMiniStat('Warning', '${Fmt.toInt(_stats['warning'])}'),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Students List
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No student records yet.',
              emptyIcon: Icons.people_outline,
              child: filteredStudents.isEmpty
                  ? AsyncView(
                      state: LoadState.empty,
                      emptyText: 'No student marked "$selectedFilter".',
                      emptyIcon: Icons.filter_alt_off_outlined,
                      onRetry: () => setState(() => selectedFilter = 'All'),
                      child: const SizedBox.shrink(),
                    )
                  : RefreshIndicator(
                      color: AppColors.primaryMaroon,
                      onRefresh: _load,
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: filteredStudents.length,
                        itemBuilder: (context, index) {
                          return _buildStudentCard(filteredStudents[index]);
                        },
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = selectedFilter == label;
    return GestureDetector(
      onTap: () => setState(() => selectedFilter = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryMaroon : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : Colors.grey.shade600,
          ),
        ),
      ),
    );
  }

  Widget _buildMiniStat(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.primaryMaroon.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.primaryMaroon,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentCard(Map<String, dynamic> grade) {
    final user = _userOf(grade);
    final status = Fmt.str(grade['remarks'], 'Incomplete');
    final statusColor = _getStatusColor(status);
    final statusBgColor = _getStatusBgColor(status);
    final summary =
        (grade['attendanceSummary'] as Map?)?.cast<String, dynamic>() ?? {};
    final attended = Fmt.toInt(summary['present']) +
        Fmt.toInt(summary['late']) +
        Fmt.toInt(summary['excused']);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.grey300),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Profile Avatar
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: AppColors.primaryMaroon.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.person,
                  color: AppColors.primaryMaroon,
                  size: 28,
                ),
              ),
              const SizedBox(width: 14),

              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      Fmt.str(user['name'], 'Trainee'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.badge_outlined,
                            size: 12, color: Colors.grey.shade500),
                        const SizedBox(width: 4),
                        Text(
                          Fmt.str(user['studentId'], '—'),
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(Icons.class_,
                            size: 12, color: Colors.grey.shade500),
                        const SizedBox(width: 4),
                        Text(
                          Fmt.str(user['section'], '—'),
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Grade & Status
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    Fmt.toDouble(grade['finalGrade']).toStringAsFixed(2),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primaryMaroon,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusBgColor,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      status,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),

          const Divider(height: 20),

          // Bottom Row - Attendance & View Details
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.calendar_today,
                      size: 14, color: Colors.grey.shade500),
                  const SizedBox(width: 4),
                  Text(
                    'Attendance: $attended/${Fmt.toInt(summary['total'])}',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () => _showStudentDetails(context, grade),
                child: const Row(
                  children: [
                    Text(
                      'View All Details',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primaryMaroon,
                      ),
                    ),
                    SizedBox(width: 4),
                    Icon(
                      Icons.arrow_forward_ios,
                      size: 12,
                      color: AppColors.primaryMaroon,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showStudentDetails(BuildContext context, Map<String, dynamic> grade) {
    final user = _userOf(grade);
    final summary =
        (grade['attendanceSummary'] as Map?)?.cast<String, dynamic>() ?? {};
    final attended = Fmt.toInt(summary['present']) +
        Fmt.toInt(summary['late']) +
        Fmt.toInt(summary['excused']);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          maxChildSize: 0.9,
          minChildSize: 0.5,
          expand: false,
          builder: (context, scrollController) {
            return ListView(
              controller: scrollController,
              padding: const EdgeInsets.all(20),
              children: [
                // Handle bar
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Profile Header
                Center(
                  child: Column(
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          color:
                              AppColors.primaryMaroon.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(
                          Icons.person,
                          color: AppColors.primaryMaroon,
                          size: 40,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        Fmt.str(user['name'], 'Trainee'),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        Fmt.str(user['studentId'], '—'),
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Details Grid
                _buildDetailRow('Section', Fmt.str(user['section'], '—')),
                _buildDetailRow('Year Level', Fmt.str(user['yearLevel'], '—')),
                _buildDetailRow(
                  'Final Grade',
                  Fmt.toDouble(grade['finalGrade']).toStringAsFixed(2),
                ),
                _buildDetailRow('Status', Fmt.str(grade['remarks'], '—')),
                _buildDetailRow(
                  'Attendance Score',
                  '${Fmt.toDouble(grade['attendanceScore']).toStringAsFixed(2)}%',
                ),
                _buildDetailRow(
                  'Attendance',
                  '$attended/${Fmt.toInt(summary['total'])} sessions',
                ),
                _buildDetailRow(
                  'Graded Modules',
                  '${(grade['moduleScores'] as List? ?? []).length}',
                ),

                const SizedBox(height: 24),

                // Action Buttons
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      Navigator.pop(sheetContext);
                      try {
                        await GradeService.instance.recalculate(
                          studentId: Fmt.str(user['_id']),
                        );
                        if (!context.mounted) return;
                        AppSnack.success(context, 'Grade recalculated.');
                        await _load();
                      } catch (error) {
                        if (!context.mounted) return;
                        AppSnack.error(context, describeError(error));
                      }
                    },
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Recalculate Grade'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryMaroon,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(sheetContext);
                      _exportRecords();
                    },
                    icon: const Icon(Icons.download, size: 18),
                    label: const Text('Export Record'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primaryMaroon,
                      side: const BorderSide(color: AppColors.primaryMaroon),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade600,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
