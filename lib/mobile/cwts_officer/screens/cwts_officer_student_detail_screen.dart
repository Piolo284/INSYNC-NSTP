import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/user_avatar.dart';

/// Officer view of one trainee: profile, attendance, submissions and grade.
///
/// The students list already had a chevron on every row that led nowhere — this
/// is the destination it implied, and it satisfies the officer requirements for
/// viewing student information, attendance, submissions and grades.
class CwtsOfficerStudentDetailScreen extends StatefulWidget {
  final String userId;
  final String name;
  final String idNumber;
  final Map<String, dynamic> profile;

  const CwtsOfficerStudentDetailScreen({
    super.key,
    required this.userId,
    required this.name,
    required this.idNumber,
    this.profile = const {},
  });

  @override
  State<CwtsOfficerStudentDetailScreen> createState() =>
      _CwtsOfficerStudentDetailScreenState();
}

class _CwtsOfficerStudentDetailScreenState
    extends State<CwtsOfficerStudentDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  LoadState _state = LoadState.loading;
  String _error = '';

  List<Map<String, dynamic>> _attendance = const [];
  List<Map<String, dynamic>> _submissions = const [];
  Map<String, dynamic> _grade = const {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final results = await Future.wait([
        AttendanceService.instance.list(studentId: widget.userId),
        SubmissionService.instance.list(studentId: widget.userId),
        GradeService.instance.forStudent(widget.userId),
      ]);

      if (!mounted) return;
      setState(() {
        _attendance = results[0] as List<Map<String, dynamic>>;
        _submissions = results[1] as List<Map<String, dynamic>>;
        _grade = results[2] as Map<String, dynamic>;
        _state = LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Student Details',
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
          _buildHeader(),
          Container(
            color: Colors.white,
            child: TabBar(
              controller: _tabController,
              labelColor: AppColors.primaryMaroon,
              unselectedLabelColor: Colors.grey.shade500,
              indicatorColor: AppColors.primaryMaroon,
              labelStyle:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              tabs: const [
                Tab(text: 'Attendance'),
                Tab(text: 'Submissions'),
                Tab(text: 'Grades'),
              ],
            ),
          ),
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildAttendanceTab(),
                  _buildSubmissionsTab(),
                  _buildGradesTab(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    final p = widget.profile;

    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
      child: Row(
        children: [
          UserAvatar(
            imagePath: Fmt.str(p['profileImage']),
            radius: 30,
            iconSize: 28,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.name,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.idNumber,
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    Fmt.str(p['course']),
                    Fmt.str(p['yearLevel']),
                    Fmt.str(p['section']),
                  ].where((s) => s.isNotEmpty).join(' • '),
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                ),
                if (Fmt.str(p['email']).isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    Fmt.str(p['email']),
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAttendanceTab() {
    if (_attendance.isEmpty) {
      return const AsyncView(
        state: LoadState.empty,
        emptyText: 'No attendance records for this trainee.',
        emptyIcon: Icons.event_busy_outlined,
        child: SizedBox.shrink(),
      );
    }

    final present = _attendance.where((a) => a['status'] == 'Present').length;
    final late = _attendance.where((a) => a['status'] == 'Late').length;
    final absent = _attendance.where((a) => a['status'] == 'Absent').length;

    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(child: _miniStat('Present', present, Colors.green)),
              const SizedBox(width: 10),
              Expanded(
                  child: _miniStat('Late', late, Colors.amber.shade700)),
              const SizedBox(width: 10),
              Expanded(child: _miniStat('Absent', absent, Colors.red)),
            ],
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _attendance.length,
            separatorBuilder: (_, __) =>
                Divider(color: Colors.grey.shade200, height: 1),
            itemBuilder: (context, index) {
              final record = _attendance[index];
              final status = Fmt.str(record['status'], 'Present');
              final activity = record['activityId'];
              final title = activity is Map
                  ? Fmt.str(activity['title'], 'Session')
                  : Fmt.str(record['title'], 'Session');

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${Fmt.date(record['date'])}  •  ${Fmt.str(record['attendanceMethod'], 'Manual')}',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: _statusColor(status).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _statusColor(status),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSubmissionsTab() {
    if (_submissions.isEmpty) {
      return const AsyncView(
        state: LoadState.empty,
        emptyText: 'This trainee has not submitted anything yet.',
        emptyIcon: Icons.assignment_outlined,
        child: SizedBox.shrink(),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _submissions.length,
      separatorBuilder: (_, __) =>
          Divider(color: Colors.grey.shade200, height: 1),
      itemBuilder: (context, index) {
        final s = _submissions[index];
        final module = s['moduleId'];
        final title = module is Map
            ? Fmt.str(module['title'], 'Submission')
            : 'Submission';
        final status = Fmt.str(s['status'], 'Submitted');
        final score = s['score'];

        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Submitted ${Fmt.dateTimeShort(s['submittedAt'], fallback: '—')}',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    score == null
                        ? '---'
                        : '${Fmt.toInt(score)}/${Fmt.toInt(s['totalPoints'], 100)}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  Text(
                    status,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: status == 'Graded'
                          ? Colors.green.shade600
                          : Colors.amber.shade700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildGradesTab() {
    if (_grade.isEmpty) {
      return const AsyncView(
        state: LoadState.empty,
        emptyText: 'No grade computed yet.',
        emptyIcon: Icons.grade_outlined,
        child: SizedBox.shrink(),
      );
    }

    final remarks = Fmt.str(_grade['remarks'], 'Incomplete');
    final summary =
        (_grade['attendanceSummary'] as Map?)?.cast<String, dynamic>() ?? {};

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            children: [
              Text(
                'Final Grade',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 8),
              Text(
                Fmt.toDouble(_grade['finalGrade']).toStringAsFixed(2),
                style: const TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryMaroon,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                decoration: BoxDecoration(
                  color: _remarksColor(remarks).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  remarks,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _remarksColor(remarks),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _gradeRow('Attendance Score',
            '${Fmt.toDouble(_grade['attendanceScore']).toStringAsFixed(2)}%'),
        _gradeRow('Module Scores',
            '${(_grade['moduleScores'] as List? ?? []).length} recorded'),
        _gradeRow('Activity Scores',
            '${(_grade['activityScores'] as List? ?? []).length} recorded'),
        _gradeRow('Present', '${Fmt.toInt(summary['present'])}'),
        _gradeRow('Late', '${Fmt.toInt(summary['late'])}'),
        _gradeRow('Absent', '${Fmt.toInt(summary['absent'])}'),
        _gradeRow('Excused', '${Fmt.toInt(summary['excused'])}'),
        _gradeRow('Total Sessions', '${Fmt.toInt(summary['total'])}'),
      ],
    );
  }

  Widget _gradeRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniStat(String label, int value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Text(
            '$value',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Present':
        return Colors.green;
      case 'Late':
        return Colors.amber.shade700;
      case 'Absent':
        return Colors.red;
      case 'Excused':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  Color _remarksColor(String remarks) {
    switch (remarks) {
      case 'Passed':
        return Colors.green.shade700;
      case 'Warning':
        return Colors.orange.shade800;
      case 'Failed':
        return Colors.red.shade700;
      default:
        return Colors.grey.shade600;
    }
  }
}
