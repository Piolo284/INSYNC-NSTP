import 'package:flutter/material.dart';
import 'cwts_officer_student_submission_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';
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

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Rubric',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryMaroon,
                ),
              ),
              const SizedBox(height: 12),
              if (rubrics.isEmpty)
                Text(
                  'No rubric was set for this assignment. Grading uses a single '
                  'score out of ${Fmt.toInt(_module['totalPoints'], 100)}.',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                )
              else
                ...rubrics.map(
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
                                  color: Colors.black87,
                                ),
                              ),
                            ),
                            Text(
                              '${Fmt.toInt(r['points'])} pts',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          Fmt.str(r['description']),
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
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
        title: const Text(
          'Assignment Details',
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
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        child: Column(
          children: [
            // ===== ASSIGNMENT INFO CARD =====
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF3E0),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.assignment_outlined,
                            color: Colors.deepOrange, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          Fmt.str(_module['title'], 'Assignment'),
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildInfoRow('Module', Fmt.str(_module['moduleCode'], '—')),
                  const SizedBox(height: 8),
                  _buildInfoRow(
                      'Due Date', Fmt.dateWithDay(_module['deadline'])),
                  const SizedBox(height: 8),
                  _buildInfoRow('Total Points',
                      '${Fmt.toInt(_module['totalPoints'], 100)}'),
                  const SizedBox(height: 12),
                  Text(
                    Fmt.str(
                      _module['description'],
                      'No description was provided for this assignment.',
                    ),
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: TextButton.icon(
                      onPressed: _showRubric,
                      icon: const Icon(Icons.description_outlined,
                          size: 16, color: AppColors.primaryMaroon),
                      label: const Text(
                        'View Rubric',
                        style: TextStyle(
                          color: AppColors.primaryMaroon,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ===== TABS =====
            TabBar(
              controller: _tabController,
              indicatorColor: AppColors.primaryMaroon,
              indicatorWeight: 3,
              labelColor: AppColors.primaryMaroon,
              unselectedLabelColor: Colors.grey.shade500,
              labelStyle:
                  const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
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

  Widget _buildInfoRow(String label, String value) {
    return Row(
      children: [
        SizedBox(
          width: 80,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade500,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
        ),
      ],
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
        separatorBuilder: (_, __) => Divider(color: Colors.grey.shade200),
        itemBuilder: (context, index) {
          final s = submissions[index];
          final student = s['studentId'];
          final user = student is Map ? student : const {};
          final score = s['score'];

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
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          Fmt.dateTimeShort(s['submittedAt']),
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey.shade500,
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
                            color: Colors.black87,
                          ),
                        ),
                        Text(
                          'Graded',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.green.shade600,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    )
                  else
                    Text(
                      '---\nTo Grade',
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.amber.shade700,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
