import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_dialogs.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/attachment_preview_screen.dart';
import '../../../core/widgets/attendance_standing.dart';
import '../../../core/widgets/private_comments.dart';
import '../../../core/widgets/rubric_view.dart';
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

  /// Set when the server refused to open this activity because the trainee
  /// reached the counted-absence limit — shows "Feature Locked" instead.
  String? _restrictedMessage;

  Map<String, dynamic> _module = const {};
  Map<String, dynamic>? _submission;

  PlatformFile? _pickedFile;
  bool _isSubmitting = false;
  bool _isUnsubmitting = false;

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
      _restrictedMessage = null;
    });

    try {
      final data = await ModuleService.instance.get(widget.moduleId);
      if (!mounted) return;
      setState(() {
        _module = data;
        _submission = (data['mySubmission'] as Map?)?.cast<String, dynamic>();
        _commentController.text = Fmt.str(_submission?['comment']);
        _state = LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        if (error is ApiException && error.isAttendanceRestricted) {
          _restrictedMessage = error.message;
          _state = LoadState.ready;
        } else {
          _state = LoadState.error;
          _error = describeError(error);
        }
      });
    }
  }

  String get _status => Fmt.str(
    _submission?['status'],
    Fmt.str(_module['myStatus'], widget.status),
  );
  bool get _isGraded => _status == 'Graded';

  /// Due date has passed — the server refuses any turn-in/re-submit now.
  bool get _isClosed => _module['isClosed'] == true;
  bool get _isLocked => _isGraded || _isClosed;

  /// Turned in and not graded yet — the trainee can view it or unsubmit it,
  /// but has to unsubmit before attaching a different file.
  bool get _isTurnedIn => _submission != null && _status == 'Submitted';

  void _explainLocked() {
    AppSnack.info(
      context,
      _isGraded
          ? 'This activity is already graded.'
          : 'The due date has passed. Use the private comments to reach your officer.',
    );
  }

  Future<void> _pickFile() async {
    if (_isLocked) {
      _explainLocked();
      return;
    }
    if (_isTurnedIn) {
      AppSnack.info(
        context,
        'Unsubmit your current submission first to attach a different file.',
      );
      return;
    }
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'],
        // Web never returns a real filesystem path — only bytes — so the
        // upload has to travel as bytes for the submission to actually
        // reach the officer.
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;
      setState(() => _pickedFile = result.files.first);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, 'Could not open the file picker.');
    }
  }

  Future<void> _turnIn() async {
    if (_isLocked) {
      _explainLocked();
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
        filePath: kIsWeb ? null : _pickedFile?.path,
        fileBytes: _pickedFile?.bytes,
        fileName: _pickedFile?.name,
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

  /// Opens the file that was already turned in — no re-upload needed.
  void _viewSubmittedFile() {
    final fileUrl = Fmt.str(_submission?['fileUrl']);
    if (fileUrl.isEmpty) return;
    openAttachmentPreview(
      context,
      fileUrl: fileUrl,
      fileName: Fmt.str(_submission?['fileName'], 'Submitted file'),
    );
  }

  /// Withdraws the current submission (DELETE /submissions/:id — only
  /// allowed before grading and before the due date, checked server-side)
  /// so the trainee can attach and turn in a new file.
  Future<void> _unsubmit() async {
    final id = Fmt.str(_submission?['_id']);
    if (id.isEmpty || _isUnsubmitting) return;

    final confirmed = await showConfirmDialog(
      context,
      title: 'Unsubmit',
      message:
          'Are you sure you want to unsubmit this file? Your current '
          'submission will be withdrawn, and you can attach and turn in a new '
          'file before the due date.',
      confirmLabel: 'Unsubmit',
    );
    if (!confirmed || !mounted) return;

    setState(() => _isUnsubmitting = true);
    try {
      await SubmissionService.instance.delete(id);
      if (!mounted) return;
      setState(() => _pickedFile = null);
      AppSnack.success(
        context,
        'Submission withdrawn. You can now attach a new file.',
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isUnsubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appBar = AppBar(
      backgroundColor: AppColors.primaryMaroon,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(
          Icons.arrow_back_ios,
          color: AppColors.white,
          size: 20,
        ),
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
    );

    if (_restrictedMessage != null) {
      return Scaffold(
        backgroundColor: AppColors.white,
        appBar: appBar,
        body: FeatureLockedView(message: _restrictedMessage!),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: appBar,
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
                                if (_isQuiz)
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 2),
                                    child: Text(
                                      Fmt.str(_module['quizNumber']).isEmpty
                                          ? 'QUIZ'
                                          : 'QUIZ NO. ${Fmt.str(_module['quizNumber'])}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.4,
                                        color: AppColors.primaryMaroon,
                                      ),
                                    ),
                                  ),
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

                    if (_isClosed && !_isGraded) ...[
                      _buildClosedBanner(),
                      const SizedBox(height: 24),
                    ],

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

                    // A quiz has no instructions/rubric — just a total score
                    // and (optionally) an online form to answer.
                    if (_isQuiz) ...[
                      Text(
                        'Total score: ${Fmt.toInt(_module['totalPoints'], 100)} points',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 20),
                      if (Fmt.str(_module['formUrl']).isNotEmpty) ...[
                        const SectionHeader(title: 'Google Form'),
                        const SizedBox(height: 10),
                        _buildFormLinkCard(Fmt.str(_module['formUrl'])),
                        const SizedBox(height: 20),
                      ],
                    ] else ...[
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

                      // Grading rubric — visible before turning in, and with the
                      // awarded points per criterion once graded.
                      const SectionHeader(title: 'Grading Rubric'),
                      const SizedBox(height: 10),
                      RubricView(
                        rubrics: RubricView.listFrom(_module['rubrics']),
                        scores: _isGraded
                            ? RubricView.listFrom(_submission?['rubricScores'])
                            : const [],
                      ),
                      const SizedBox(height: 20),
                    ],

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

                    // Optional note sent along with the submission
                    TextField(
                      controller: _commentController,
                      enabled: !_isLocked && !_isTurnedIn,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        hintText: 'Add a note with your submission (optional)',
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Divider(color: AppColors.border),
                    const SizedBox(height: 16),

                    // Private comments stay open even after the due date.
                    PrivateCommentsSection(moduleId: widget.moduleId),
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
                child: _isTurnedIn && !_isLocked
                    // File already submitted → Unsubmit (View File is on the card above).
                    ? OutlinedButton.icon(
                        onPressed: _isUnsubmitting ? null : _unsubmit,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.error,
                          side: const BorderSide(color: AppColors.error),
                        ),
                        icon: _isUnsubmitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.error,
                                ),
                              )
                            : const Icon(Icons.undo, size: 18),
                        label: const Text('Unsubmit'),
                      )
                    : ElevatedButton(
                        onPressed: (_isSubmitting || _isLocked)
                            ? null
                            : _turnIn,
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    AppColors.white,
                                  ),
                                ),
                              )
                            : Text(
                                _isGraded
                                    ? 'Graded'
                                    : _isClosed
                                    ? (_submission == null
                                          ? 'Missing'
                                          : 'Turned In')
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
    final lines = raw
        .map((e) => e.toString())
        .where((e) => e.isNotEmpty)
        .toList();
    if (lines.isNotEmpty) return lines;
    return const [
      'Follow the format given in the instructions',
      'Use your own words',
      'Submit before the deadline',
    ];
  }

  Widget _buildClosedBanner() {
    final missing = _submission == null;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: missing ? AppColors.errorLight : AppColors.grey50,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(
          color: missing
              ? AppColors.error.withValues(alpha: 0.3)
              : AppColors.border,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            missing ? Icons.error_outline : Icons.lock_clock_outlined,
            color: missing ? AppColors.error : AppColors.textSecondary,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              missing
                  ? 'The due date has passed and nothing was turned in, so this is '
                        'marked Missing. It can no longer be turned in — use the '
                        'private comments below to reach your officer.'
                  : 'The due date has passed. Your submission is locked in and can '
                        'no longer be changed.',
              style: TextStyle(
                fontSize: 12.5,
                height: 1.4,
                color: missing ? AppColors.error : AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
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
              const Icon(
                Icons.check_circle,
                color: AppColors.success,
                size: 20,
              ),
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

  bool get _isQuiz => Fmt.str(_module['kind']) == 'Quiz';

  Future<void> _openFormLink(String url) async {
    final uri = Uri.tryParse(url);
    try {
      final opened =
          uri != null &&
          await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened && mounted) {
        AppSnack.error(context, 'Could not open the Google Form link.');
      }
    } catch (_) {
      if (mounted) {
        AppSnack.error(context, 'Could not open the Google Form link.');
      }
    }
  }

  Widget _buildFormLinkCard(String url) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      onTap: () => _openFormLink(url),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primaryMaroon.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.quiz_outlined,
              color: AppColors.primaryMaroon,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Answer the quiz online',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  url,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.open_in_new,
            color: AppColors.primaryMaroon,
            size: 20,
          ),
        ],
      ),
    );
  }

  Widget _buildAttachmentCard() {
    final fileUrl = Fmt.str(_module['fileUrl']);
    final fileName = Fmt.str(_module['fileName'], 'No attachment');

    return AppCard(
      padding: const EdgeInsets.all(14),
      onTap: fileUrl.isEmpty
          ? null
          : () => openAttachmentPreview(
              context,
              fileUrl: fileUrl,
              fileName: fileName,
            ),
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
          Icon(
            Icons.visibility_outlined,
            color: fileUrl.isEmpty
                ? AppColors.textSecondary
                : AppColors.primaryMaroon,
            size: 22,
          ),
        ],
      ),
    );
  }

  Widget _buildSubmissionBox() {
    final existingName = Fmt.str(_submission?['fileName']);
    final existingUrl = Fmt.str(_submission?['fileUrl']);
    final picked = _pickedFile;

    // A file the trainee picked but hasn't turned in yet.
    if (picked != null) {
      final type = FileTypeInfo.of(picked.name);
      return _fileCard(
        type: type,
        name: picked.name,
        details:
            '${type.label} • ${Fmt.fileSize(picked.size)} • ready to submit',
        onTap: _pickFile,
        trailing: IconButton(
          tooltip: 'Remove',
          icon: const Icon(
            Icons.close,
            size: 18,
            color: AppColors.textSecondary,
          ),
          onPressed: () => setState(() => _pickedFile = null),
        ),
      );
    }

    // Already turned in (or graded / locked in) — show what was submitted
    // and let the trainee open it without uploading it again.
    if (_submission != null && existingUrl.isNotEmpty) {
      final type = FileTypeInfo.of(existingName);
      final submittedAt = Fmt.dateTimeShort(
        _submission?['submittedAt'],
        fallback: '',
      );
      return _fileCard(
        type: type,
        name: existingName.isEmpty ? 'Submitted file' : existingName,
        details: [
          type.label,
          Fmt.fileSize(_submission?['fileSize']),
          if (submittedAt.isNotEmpty) 'Submitted $submittedAt',
        ].join(' • '),
        onTap: _viewSubmittedFile,
        trailing: TextButton.icon(
          onPressed: _viewSubmittedFile,
          icon: const Icon(Icons.visibility_outlined, size: 18),
          label: const Text('View File'),
          style: TextButton.styleFrom(foregroundColor: AppColors.primaryMaroon),
        ),
      );
    }

    // Turned in with a note only, no file.
    if (_submission != null) {
      final submittedAt = Fmt.dateTimeShort(
        _submission?['submittedAt'],
        fallback: '',
      );
      return _fileCard(
        type: FileTypeInfo.of(''),
        name: 'No file attached',
        details: submittedAt.isEmpty
            ? 'Submitted with a note only'
            : 'Note only • Submitted $submittedAt',
      );
    }

    // Nothing yet → Attach File.
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
        child: const Column(
          children: [
            Icon(
              Icons.cloud_upload_outlined,
              color: AppColors.textSecondary,
              size: 32,
            ),
            SizedBox(height: 8),
            Text(
              'Tap to attach a file',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            SizedBox(height: 2),
            Text(
              'PDF, DOC, DOCX, PNG, JPG or JPEG',
              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fileCard({
    required FileTypeInfo type,
    required String name,
    required String details,
    VoidCallback? onTap,
    Widget? trailing,
  }) {
    return GestureDetector(
      onTap: onTap,
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
                color: type.background,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(type.icon, color: type.color, size: 20),
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
                    details,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            ?trailing,
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
