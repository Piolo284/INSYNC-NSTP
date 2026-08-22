import 'package:flutter/material.dart';
import 'cwts_officer_grade_submission_screen.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

class CwtsOfficerStudentSubmissionScreen extends StatefulWidget {
  final String submissionId;

  const CwtsOfficerStudentSubmissionScreen({
    super.key,
    required this.submissionId,
  });

  @override
  State<CwtsOfficerStudentSubmissionScreen> createState() =>
      _CwtsOfficerStudentSubmissionScreenState();
}

class _CwtsOfficerStudentSubmissionScreenState
    extends State<CwtsOfficerStudentSubmissionScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  Map<String, dynamic> _submission = const {};

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
      final data = await SubmissionService.instance.get(widget.submissionId);
      if (!mounted) return;
      setState(() {
        _submission = data;
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

  Map<String, dynamic> get _student {
    final s = _submission['studentId'];
    return s is Map ? s.cast<String, dynamic>() : const {};
  }

  Map<String, dynamic> get _module {
    final m = _submission['moduleId'];
    return m is Map ? m.cast<String, dynamic>() : const {};
  }

  bool get _isGraded => _submission['status'] == 'Graded';

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
          'Student Submission',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ===== STUDENT HEADER =====
              Row(
                children: [
                  UserAvatar(
                    imagePath: Fmt.str(_student['profileImage']),
                    radius: 24,
                    iconSize: 24,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          Fmt.str(_student['name'], 'Trainee'),
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          [
                            [
                              Fmt.str(_student['section']),
                              Fmt.str(_student['yearLevel']),
                            ].where((s) => s.isNotEmpty).join(' – '),
                            Fmt.str(_student['studentId']),
                          ].where((s) => s.isNotEmpty).join('\n'),
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  StatusBadge(Fmt.str(_submission['status'], 'Submitted')),
                ],
              ),
              const Divider(height: 32),

              // ===== ASSIGNMENT TITLE =====
              Text(
                Fmt.str(_module['title'], 'Assignment'),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Due: ${Fmt.date(_module['deadline'])}',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              const Divider(height: 32),

              // ===== SUBMISSION INFO =====
              AppCard(
                child: InfoRow(
                  icon: Icons.upload_file_outlined,
                  label: 'Submitted on',
                  value: Fmt.dateTimeShort(_submission['submittedAt']),
                ),
              ),
              const SizedBox(height: 20),

              // ===== FILE ATTACHMENT =====
              const SectionHeader(title: 'File'),
              const SizedBox(height: 8),
              _buildFileCard(),
              const SizedBox(height: 24),

              // ===== STUDENT COMMENT =====
              const SectionHeader(title: 'Student Comment (Optional)'),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.grey50,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  Fmt.str(_submission['comment'], 'No comment was added.'),
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),

              // ===== EXISTING GRADE =====
              if (_isGraded) ...[
                const SizedBox(height: 24),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.greenLight,
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                    border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.check_circle,
                              color: AppColors.success, size: 20),
                          const SizedBox(width: 8),
                          const Text(
                            'Already graded',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.success,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${Fmt.toInt(_submission['score'])} / ${Fmt.toInt(_submission['totalPoints'], 100)}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.success,
                            ),
                          ),
                        ],
                      ),
                      if (Fmt.str(_submission['feedback']).isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          Fmt.str(_submission['feedback']),
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textPrimary,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 32),

              // ===== PROCEED BUTTON =====
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => CwtsOfficerGradeSubmissionScreen(
                          submissionId: widget.submissionId,
                        ),
                      ),
                    ).then((_) => _load());
                  },
                  child: Text(_isGraded ? 'Update Grade' : 'Proceed to Grade'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFileCard() {
    final fileUrl = Fmt.str(_submission['fileUrl']);
    final fileName = Fmt.str(_submission['fileName'], 'No file attached');

    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.errorLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.picture_as_pdf, color: AppColors.error, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fileName,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  fileUrl.isEmpty
                      ? 'The trainee submitted a comment only'
                      : Fmt.fileSize(_submission['fileSize']),
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(
              Icons.download,
              color: fileUrl.isEmpty ? AppColors.textSecondary : AppColors.primaryMaroon,
              size: 20,
            ),
            onPressed: fileUrl.isEmpty
                ? null
                : () => AppSnack.info(
                      context,
                      'Download link: ${AppConfig.resolveFileUrl(fileUrl)}',
                    ),
          ),
        ],
      ),
    );
  }
}
