import 'package:flutter/material.dart';
import 'cwts_officer_student_submission_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

class CwtsOfficerAssignmentDetailScreen extends StatefulWidget {
  final String moduleId;

  const CwtsOfficerAssignmentDetailScreen({
    super.key,
    required this.moduleId,
  });

  @override
  State<CwtsOfficerAssignmentDetailScreen> createState() =>
      _CwtsOfficerAssignmentDetailScreenState();
}

class _CwtsOfficerAssignmentDetailScreenState
    extends State<CwtsOfficerAssignmentDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  LoadState _state = LoadState.loading;
  String _error = '';

  Map<String, dynamic> _module = const {};
  List<Map<String, dynamic>> _submissions = const [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
        ModuleService.instance.get(widget.moduleId),
        ModuleService.instance.submissions(widget.moduleId),
      ]);

      if (!mounted) return;
      setState(() {
        _module = results[0] as Map<String, dynamic>;
        _submissions = results[1] as List<Map<String, dynamic>>;
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

  List<Map<String, dynamic>> get _graded =>
      _submissions.where((s) => s['status'] == 'Graded').toList();

  List<Map<String, dynamic>> get _toGrade =>
      _submissions.where((s) => s['status'] != 'Graded').toList();

  void _showRubric() {
    final rubrics = ((_module['rubrics'] as List?) ?? const [])
        .cast<Map<String, dynamic>>();

    showAppBottomSheet(
      context,
      title: 'Rubric',
      child: rubrics.isEmpty
          ? Text(
              'No rubric was set for this assignment. Grading uses a single '
              'score out of ${Fmt.toInt(_module['totalPoints'], 100)}.',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: rubrics
                  .map(
                    (r) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  Fmt.str(r['title'], 'Criterion'),
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              Text(
                                '${Fmt.toInt(r['points'])} pts',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            Fmt.str(r['description']),
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
    );
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
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Assignment Details',
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
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        child: Column(
          children: [
            // ===== ASSIGNMENT INFO CARD =====
            Padding(
              padding: const EdgeInsets.all(16),
              child: AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.orangeLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.assignment_outlined,
                              color: AppColors.orange, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            Fmt.str(_module['title'], 'Assignment'),
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    InfoRow(
                      icon: Icons.menu_book_outlined,
                      label: 'Module',
                      value: Fmt.str(_module['moduleCode'], '—'),
                    ),
                    InfoRow(
                      icon: Icons.event_outlined,
                      label: 'Due Date',
                      value: Fmt.dateWithDay(_module['deadline']),
                    ),
                    InfoRow(
                      icon: Icons.grade_outlined,
                      label: 'Total Points',
                      value: '${Fmt.toInt(_module['totalPoints'], 100)}',
                    ),
                    const SizedBox(height: 8),
                    Text(
                      Fmt.str(
                        _module['description'],
                        'No description was provided for this assignment.',
                      ),
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Center(
                      child: TextButton.icon(
                        onPressed: _showRubric,
                        icon: const Icon(Icons.description_outlined, size: 16),
                        label: const Text(
                          'View Rubric',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // ===== TABS =====
            TabBar(
              controller: _tabController,
              tabs: [
                Tab(text: 'Graded (${_graded.length})'),
                Tab(text: 'To Grade (${_toGrade.length})'),
              ],
            ),
            const Divider(height: 1),

            // ===== STUDENT LIST =====
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildStudentList(_graded, 'No graded submissions yet.'),
                  _buildStudentList(
                      _toGrade, 'Everything submitted has been graded.'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentList(
    List<Map<String, dynamic>> submissions,
    String emptyText,
  ) {
    if (submissions.isEmpty) {
      return AsyncView(
        state: LoadState.empty,
        emptyText: emptyText,
        emptyIcon: Icons.inbox_outlined,
        child: const SizedBox.shrink(),
      );
    }

    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: submissions.length,
        separatorBuilder: (_, _) => const Divider(color: AppColors.border),
        itemBuilder: (context, index) {
          final s = submissions[index];
          final student = s['studentId'];
          final user = student is Map ? student : const {};
          final score = s['score'];
          final status = Fmt.str(s['status'], 'Submitted');

          return GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CwtsOfficerStudentSubmissionScreen(
                    submissionId: Fmt.str(s['_id']),
                  ),
                ),
              ).then((_) => _load());
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                children: [
                  UserAvatar(
                    imagePath: Fmt.str(user['profileImage']),
                    radius: 20,
                    iconSize: 18,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          Fmt.str(user['name'], 'Trainee'),
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
                          Fmt.dateTimeShort(s['submittedAt']),
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (score != null)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '${Fmt.toInt(score)}/${Fmt.toInt(s['totalPoints'], 100)}',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 3),
                        StatusBadge(status, dense: true),
                      ],
                    )
                  else
                    StatusBadge('To Grade', dense: true),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
