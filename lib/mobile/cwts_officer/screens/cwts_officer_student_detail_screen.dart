import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/status_badge.dart';
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
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          Session.instance.program == 'ROTC' ? 'Cadet Details' : 'Student Details',
          style: const TextStyle(
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
            color: AppColors.cardBg,
            child: TabBar(
              controller: _tabController,
              labelColor: AppColors.primaryMaroon,
              unselectedLabelColor: AppColors.textSecondary,
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
      color: AppColors.cardBg,
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
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.idNumber,
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    Fmt.str(p['course']),
                    Fmt.str(p['yearLevel']),
                    Fmt.str(p['section']),
                    Fmt.str(p['campus']),
                  ].where((s) => s.isNotEmpty).join(' • '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                if (Fmt.str(p['email']).isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    Fmt.str(p['email']),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
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

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(child: _miniStat('Present', present, AppColors.success)),
            const SizedBox(width: 10),
            Expanded(child: _miniStat('Late', late, AppColors.warning)),
            const SizedBox(width: 10),
            Expanded(child: _miniStat('Absent', absent, AppColors.error)),
          ],
        ),
        const SizedBox(height: 16),
        ...List.generate(_attendance.length, (index) {
          final record = _attendance[index];
          final status = Fmt.str(record['status'], 'Present');
          final activity = record['activityId'];
          final title = activity is Map
              ? Fmt.str(activity['title'], 'Session')
              : Fmt.str(record['title'], 'Session');

          return AppCard(
            margin: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
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
                        '${Fmt.date(record['date'])}  •  ${Fmt.str(record['attendanceMethod'], 'Manual')}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusBadge(status, dense: true),
              ],
            ),
          );
        }),
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

    return ListView(
      padding: const EdgeInsets.all(16),
      children: List.generate(_submissions.length, (index) {
        final s = _submissions[index];
        final module = s['moduleId'];
        final title = module is Map
            ? Fmt.str(module['title'], 'Submission')
            : 'Submission';
        final status = Fmt.str(s['status'], 'Submitted');
        final score = s['score'];

        return AppCard(
          margin: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
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
                      'Submitted ${Fmt.dateTimeShort(s['submittedAt'], fallback: '—')}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    score == null
                        ? '—'
                        : '${Fmt.toInt(score)}/${Fmt.toInt(s['totalPoints'], 100)}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  StatusBadge(status, dense: true),
                ],
              ),
            ],
          ),
        );
      }),
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
    final moduleScores = (_grade['moduleScores'] as List? ?? []).cast<Map>();
    final activityScores = (_grade['activityScores'] as List? ?? []).cast<Map>();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ===== Final grade hero =====
        AppCard(
          child: Column(
            children: [
              const Text(
                'Final Grade',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              Text(
                Fmt.toDouble(_grade['gradePoint']).toStringAsFixed(2),
                style: const TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryMaroon,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${Fmt.toDouble(_grade['finalGrade']).toStringAsFixed(2)}%',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              StatusBadge(remarks),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ===== Score breakdown =====
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader(title: 'Score Breakdown'),
              const SizedBox(height: 4),
              InfoRow(
                icon: Icons.assignment_outlined,
                label: 'Activity Scores',
                value: _scoreSummary(activityScores),
              ),
              InfoRow(
                icon: Icons.menu_book_outlined,
                label: 'Module Scores',
                value: _scoreSummary(moduleScores),
              ),
              InfoRow(
                icon: Icons.event_available_outlined,
                label: 'Attendance Score',
                value: '${Fmt.toDouble(_grade['attendanceScore']).toStringAsFixed(2)}%',
              ),
              InfoRow(
                icon: Icons.summarize_outlined,
                label: 'Total Score',
                value: Fmt.toDouble(_grade['totalScore']).toStringAsFixed(2),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ===== Attendance summary =====
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader(title: 'Attendance Summary'),
              const SizedBox(height: 4),
              InfoRow(
                icon: Icons.check_circle_outline,
                label: 'Present',
                value: '${Fmt.toInt(summary['present'])}',
              ),
              InfoRow(
                icon: Icons.schedule_outlined,
                label: 'Late',
                value: '${Fmt.toInt(summary['late'])}',
              ),
              InfoRow(
                icon: Icons.cancel_outlined,
                label: 'Absent',
                value: '${Fmt.toInt(summary['absent'])}',
              ),
              InfoRow(
                icon: Icons.verified_outlined,
                label: 'Excused',
                value: '${Fmt.toInt(summary['excused'])}',
              ),
              InfoRow(
                icon: Icons.event_note_outlined,
                label: 'Total Sessions',
                value: '${Fmt.toInt(summary['total'])}',
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// "82.50% avg • 3 recorded" summary for a list of `{percentage}` score lines.
  String _scoreSummary(List<Map> scores) {
    if (scores.isEmpty) return 'Not yet recorded';
    final total = scores.fold<double>(
      0,
      (sum, s) => sum + Fmt.toDouble(s['percentage']),
    );
    final avg = total / scores.length;
    return '${avg.toStringAsFixed(1)}% avg • ${scores.length} recorded';
  }

  Widget _miniStat(String label, int value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
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
              color: color.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }
}
