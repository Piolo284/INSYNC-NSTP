import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/status_badge.dart';

/// Module/assignment detail with the trainee's own submission.
///
/// Layout is unchanged; the description, instructions, attachment, existing
/// submission, score and feedback now come from MongoDB.
class CwtsActivityDetailScreen extends StatefulWidget {
  final String moduleId;
  final String title;
  final String dueDate;
  final String status;

  const CwtsActivityDetailScreen({
    super.key,
    required this.moduleId,
    required this.title,
    required this.dueDate,
    required this.status,
  });

  @override
  State<CwtsActivityDetailScreen> createState() =>
      _CwtsActivityDetailScreenState();
}

class _CwtsActivityDetailScreenState extends State<CwtsActivityDetailScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';

  Map<String, dynamic> _module = const {};
  Map<String, dynamic>? _submission;

  PlatformFile? _pickedFile;
  bool _isSubmitting = false;

  final TextEditingController _commentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final data = await ModuleService.instance.get(widget.moduleId);
      if (!mounted) return;
      setState(() {
        _module = data;
        _submission =
            (data['mySubmission'] as Map?)?.cast<String, dynamic>();
        _commentController.text = Fmt.str(_submission?['comment']);
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

  String get _status => Fmt.str(_submission?['status'], widget.status);
  bool get _isGraded => _status == 'Graded';

  Future<void> _pickFile() async {
    if (_isGraded) {
      AppSnack.info(context, 'This activity is already graded.');
      return;
    }
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'],
      );
      if (result == null || result.files.isEmpty) return;
      setState(() => _pickedFile = result.files.first);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, 'Could not open the file picker.');
    }
  }

  Future<void> _turnIn() async {
    if (_isGraded) {
      AppSnack.info(context, 'This activity is already graded.');
      return;
    }
    if (_pickedFile == null &&
        (_submission?['fileUrl'] == null ||
            Fmt.str(_submission?['fileUrl']).isEmpty) &&
        _commentController.text.trim().isEmpty) {
      AppSnack.error(context, 'Attach a file or write a comment first.');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await SubmissionService.instance.submit(
        moduleId: widget.moduleId,
        filePath: _pickedFile?.path,
        comment: _commentController.text.trim(),
      );

      if (!mounted) return;
      AppSnack.success(context, 'Submission turned in.');
      setState(() => _pickedFile = null);
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Activity Details',
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
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Activity Header Card
                    AppCard(
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: AppColors.blueLight,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.menu_book,
                              color: AppColors.blue,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  Fmt.str(_module['title'], widget.title),
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _module['deadline'] != null
                                      ? Fmt.dateTime(_module['deadline'])
                                      : widget.dueDate,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          StatusBadge(_status),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Score + feedback appear once the officer has graded it.
                    if (_isGraded) ...[
                      _buildGradeCard(),
                      const SizedBox(height: 24),
                    ],

                    // Description
                    const SectionHeader(title: 'Description'),
                    const SizedBox(height: 8),
                    Text(
                      Fmt.str(
                        _module['description'],
                        'No description was provided for this activity.',
                      ),
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Instructions
                    const SectionHeader(title: 'Instructions'),
                    const SizedBox(height: 10),
                    ..._instructions().map(
                      (line) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _buildBulletPoint(line),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Attachment
                    const SectionHeader(title: 'Attachment'),
                    const SizedBox(height: 10),
                    _buildAttachmentCard(),
                    const SizedBox(height: 20),

                    // My Submission
                    const SectionHeader(title: 'My Submission'),
                    const SizedBox(height: 10),
                    _buildSubmissionBox(),
                    const SizedBox(height: 16),

                    // Optional comment
                    TextField(
                      controller: _commentController,
                      enabled: !_isGraded,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        hintText: 'Add a comment (optional)',
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
            // Turn In Button
            Padding(
              padding: const EdgeInsets.all(20),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: (_isSubmitting || _isGraded) ? null : _turnIn,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(AppColors.white),
                          ),
                        )
                      : Text(
                          _isGraded
                              ? 'Graded'
                              : _status == 'Submitted'
                                  ? 'Re-submit'
                                  : 'Turn In',
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<String> _instructions() {
    final raw = (_module['instructions'] as List?) ?? const [];
    final lines = raw.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
    if (lines.isNotEmpty) return lines;
    return const [
      'Follow the format given in the instructions',
      'Use your own words',
      'Submit before the deadline',
    ];
  }

  Widget _buildGradeCard() {
    final score = Fmt.toDouble(_submission?['score']);
    final total = Fmt.toDouble(_submission?['totalPoints'], 100);
    final feedback = Fmt.str(_submission?['feedback']);

    return Container(
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
              const Icon(Icons.check_circle, color: AppColors.success, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Score',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.success,
                ),
              ),
              const Spacer(),
              Text(
                '${score.toStringAsFixed(0)} / ${total.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.success,
                ),
              ),
            ],
          ),
          if (feedback.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text(
              'Feedback',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.success,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              feedback,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textPrimary,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAttachmentCard() {
    final fileUrl = Fmt.str(_module['fileUrl']);
    final fileName = Fmt.str(_module['fileName'], 'No attachment');

    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.orangeLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.description_outlined,
              color: AppColors.orange,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  fileUrl.isEmpty
                      ? 'Nothing attached for this activity'
                      : Fmt.fileSize(_module['fileSize']),
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
              Icons.download_outlined,
              color: fileUrl.isEmpty
                  ? AppColors.textSecondary
                  : AppColors.primaryMaroon,
              size: 22,
            ),
            onPressed: fileUrl.isEmpty
                ? null
                : () {
                    AppSnack.info(
                      context,
                      'Download link: ${AppConfig.resolveFileUrl(fileUrl)}',
                    );
                  },
          ),
        ],
      ),
    );
  }

  Widget _buildSubmissionBox() {
    final existingName = Fmt.str(_submission?['fileName']);
    final picked = _pickedFile;

    if (picked == null && existingName.isEmpty) {
      return GestureDetector(
        onTap: _pickFile,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 30),
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              const Icon(
                Icons.cloud_upload_outlined,
                color: AppColors.textSecondary,
                size: 32,
              ),
              const SizedBox(height: 8),
              const Text(
                'Tap to upload or browse',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final name = picked?.name ?? existingName;
    final size = picked?.size ?? Fmt.toInt(_submission?['fileSize']);
    final submittedAt = _submission?['submittedAt'];

    return GestureDetector(
      onTap: _isGraded ? null : _pickFile,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.grey50,
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.errorLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.picture_as_pdf,
                color: AppColors.error,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    picked != null
                        ? '${Fmt.fileSize(size)} • ready to submit'
                        : '${Fmt.fileSize(size)} • submitted ${Fmt.dateTimeShort(submittedAt, fallback: '')}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            if (!_isGraded)
              const Icon(Icons.edit_outlined,
                  size: 18, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  Widget _buildBulletPoint(String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 6),
          width: 5,
          height: 5,
          decoration: const BoxDecoration(
            color: AppColors.textSecondary,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
