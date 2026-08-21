import 'package:flutter/material.dart';
import 'cwts_officer_grade_submission_screen.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';
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
          'Student Submission',
          style: TextStyle(
            color: Colors.white,
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
                            color: Colors.black87,
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
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const Divider(height: 32),

              // ===== ASSIGNMENT TITLE =====
              Text(
                Fmt.str(_module['title'], 'Assignment'),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Due: ${Fmt.date(_module['deadline'])}',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade500,
                ),
              ),
              const Divider(height: 32),

              // ===== SUBMISSION INFO =====
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Submission',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primaryMaroon,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Submitted on',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    Fmt.dateTimeShort(_submission['submittedAt']),
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // ===== FILE ATTACHMENT =====
              const Text(
                'File',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              _buildFileCard(),
              const SizedBox(height: 24),

              // ===== STUDENT COMMENT =====
              const Text(
                'Student Comment (Optional)',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Text(
                  Fmt.str(_submission['comment'], 'No comment was added.'),
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade700,
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
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.green.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.check_circle,
                              color: Colors.green.shade700, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'Already graded',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.green.shade800,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${Fmt.toInt(_submission['score'])} / ${Fmt.toInt(_submission['totalPoints'], 100)}',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.green.shade800,
                            ),
                          ),
                        ],
                      ),
                      if (Fmt.str(_submission['feedback']).isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          Fmt.str(_submission['feedback']),
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade800,
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
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    _isGraded ? 'Update Grade' : 'Proceed to Grade',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
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

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child:
                Icon(Icons.picture_as_pdf, color: Colors.red.shade600, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fileName,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade800,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  fileUrl.isEmpty
                      ? 'The trainee submitted a comment only'
                      : Fmt.fileSize(_submission['fileSize']),
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(
              Icons.download,
              color: fileUrl.isEmpty ? Colors.grey.shade400 : Colors.grey.shade600,
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
