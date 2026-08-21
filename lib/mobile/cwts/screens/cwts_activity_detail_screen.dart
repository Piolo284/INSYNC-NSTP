import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_view.dart';

/// Module/assignment detail with the trainee's own submission.
///
/// Layout is unchanged; the description, instructions, attachment, existing
/// submission, score and feedback now come from MongoDB.
class CwtsActivityDetailScreen extends StatefulWidget {
  final String moduleId;
  final String title;
  final String dueDate;
  final String status;
  final Color statusColor;

  const CwtsActivityDetailScreen({
    super.key,
    required this.moduleId,
    required this.title,
    required this.dueDate,
    required this.status,
    required this.statusColor,
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
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Activity Details',
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
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Activity Header Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFFE3F2FD),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.menu_book,
                              color: Colors.blue,
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
                                    color: Colors.black87,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _module['deadline'] != null
                                      ? Fmt.dateTime(_module['deadline'])
                                      : widget.dueDate,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            _status,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _statusColor(_status),
                            ),
                          ),
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
                    const Text(
                      'Description',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      Fmt.str(
                        _module['description'],
                        'No description was provided for this activity.',
                      ),
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey.shade600,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Instructions
                    const Text(
                      'Instructions',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ..._instructions().map(
                      (line) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _buildBulletPoint(line),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Attachment
                    const Text(
                      'Attachment',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _buildAttachmentCard(),
                    const SizedBox(height: 20),

                    // My Submission
                    const Text(
                      'My Submission',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _buildSubmissionBox(),
                    const SizedBox(height: 16),

                    // Optional comment
                    TextField(
                      controller: _commentController,
                      enabled: !_isGraded,
                      maxLines: 3,
                      decoration: InputDecoration(
                        hintText: 'Add a comment (optional)',
                        hintStyle: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade400,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                              color: AppColors.primaryMaroon, width: 1.5),
                        ),
                        contentPadding: const EdgeInsets.all(14),
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
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.grey.shade300,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Text(
                          _isGraded
                              ? 'Graded'
                              : _status == 'Submitted'
                                  ? 'Re-submit'
                                  : 'Turn In',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
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

  Color _statusColor(String status) {
    switch (status) {
      case 'Graded':
        return Colors.green;
      case 'Submitted':
        return Colors.amber.shade700;
      case 'Missing':
        return Colors.red;
      default:
        return widget.statusColor;
    }
  }

  Widget _buildGradeCard() {
    final score = Fmt.toDouble(_submission?['score']);
    final total = Fmt.toDouble(_submission?['totalPoints'], 100);
    final feedback = Fmt.str(_submission?['feedback']);

    return Container(
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
                'Score',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.green.shade800,
                ),
              ),
              const Spacer(),
              Text(
                '${score.toStringAsFixed(0)} / ${total.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.green.shade800,
                ),
              ),
            ],
          ),
          if (feedback.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Feedback',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.green.shade800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              feedback,
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade800,
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

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.description_outlined,
              color: Colors.orange,
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
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  fileUrl.isEmpty
                      ? 'Nothing attached for this activity'
                      : Fmt.fileSize(_module['fileSize']),
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
              Icons.download_outlined,
              color: fileUrl.isEmpty
                  ? Colors.grey.shade400
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
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: Column(
            children: [
              Icon(
                Icons.cloud_upload_outlined,
                color: Colors.grey.shade500,
                size: 32,
              ),
              const SizedBox(height: 8),
              Text(
                'Tap to upload or browse',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade500,
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
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
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
              child: Icon(
                Icons.picture_as_pdf,
                color: Colors.red.shade600,
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
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    picked != null
                        ? '${Fmt.fileSize(size)} • ready to submit'
                        : '${Fmt.fileSize(size)} • submitted ${Fmt.dateTimeShort(submittedAt, fallback: '')}',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ),
            if (!_isGraded)
              Icon(Icons.edit_outlined,
                  size: 18, color: Colors.grey.shade600),
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
          decoration: BoxDecoration(
            color: Colors.grey.shade600,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey.shade600,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
