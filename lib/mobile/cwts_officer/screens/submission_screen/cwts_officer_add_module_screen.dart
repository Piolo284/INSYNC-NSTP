import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';

/// Creates a new module/assignment for students to answer, or edits
/// [existing] when one is passed in. Pops with `true` when something was
/// saved so the caller can refresh.
///
/// A "module" (a posted PDF/PPT/video resource) and an "assignment" (a
/// graded task students submit work against) are the same underlying
/// record — a module with no deadline is a plain resource, one with a
/// deadline is what the Submissions tab tracks. [forAssignment] only
/// changes this form's labels and requires a deadline before saving; it
/// doesn't change what gets created.
class CwtsOfficerAddModuleScreen extends StatefulWidget {
  final Map<String, dynamic>? existing;
  final bool forAssignment;

  const CwtsOfficerAddModuleScreen({
    super.key,
    this.existing,
    this.forAssignment = false,
  });

  @override
  State<CwtsOfficerAddModuleScreen> createState() =>
      _CwtsOfficerAddModuleScreenState();
}

class _CwtsOfficerAddModuleScreenState
    extends State<CwtsOfficerAddModuleScreen> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _moduleCodeController = TextEditingController();
  final TextEditingController _sectionController = TextEditingController();
  final TextEditingController _instructionsController = TextEditingController();
  final TextEditingController _totalPointsController =
      TextEditingController(text: '100');
  final TextEditingController _linkController = TextEditingController();

  DateTime? _deadline;
  PlatformFile? _file;
  bool _isSaving = false;

  /// True when the existing record's attachment is an external link rather
  /// than a server-uploaded file — decides what an unchanged save resends.
  bool _existingIsLink = false;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _titleController.text = Fmt.str(existing['title']);
      _descriptionController.text = Fmt.str(existing['description']);
      _moduleCodeController.text = Fmt.str(existing['moduleCode']);
      _sectionController.text = Fmt.str(existing['section']);
      _instructionsController.text =
          ((existing['instructions'] as List?) ?? const [])
              .map((e) => e.toString())
              .join('\n');
      _totalPointsController.text = '${Fmt.toInt(existing['totalPoints'], 100)}';
      _deadline = Fmt.parse(existing['deadline']);

      final existingFileUrl = Fmt.str(existing['fileUrl']);
      _existingIsLink = existingFileUrl.startsWith('http');
      if (_existingIsLink) _linkController.text = existingFileUrl;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _moduleCodeController.dispose();
    _sectionController.dispose();
    _instructionsController.dispose();
    _totalPointsController.dispose();
    _linkController.dispose();
    super.dispose();
  }

  Future<void> _pickDeadline() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _deadline ?? DateTime.now(),
      firstDate: DateTime(2024),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(primary: AppColors.primaryMaroon),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _deadline = picked);
    }
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: [
          'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt',
          'png', 'jpg', 'jpeg', 'webp', 'gif', 'zip',
          'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v',
        ],
        // Web never returns a real filesystem path — only bytes — so the
        // upload has to travel as bytes for the picked file to actually
        // reach the server on every platform.
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;
      setState(() {
        _file = result.files.first;
        // A file and a link attachment are mutually exclusive.
        _linkController.clear();
      });
    } catch (_) {
      if (!mounted) return;
      AppSnack.error(context, 'Could not open the file picker.');
    }
  }

  void _removeFile() => setState(() => _file = null);

  Future<void> _save() async {
    if (_titleController.text.trim().isEmpty) {
      AppSnack.error(context, 'Please enter the module title.');
      return;
    }
    if (widget.forAssignment && _deadline == null) {
      AppSnack.error(context, 'Please set a deadline for this assignment.');
      return;
    }
    final linkText = _linkController.text.trim();
    final hasLink = _file == null && linkText.isNotEmpty;
    if (hasLink && !(linkText.startsWith('http://') || linkText.startsWith('https://'))) {
      AppSnack.error(context, 'Please enter a full video link starting with https://');
      return;
    }

    setState(() => _isSaving = true);

    try {
      // Points only mean anything for a graded assignment — a plain module
      // resource always keeps the schema default since it's never graded.
      final totalPoints = widget.forAssignment
          ? (int.tryParse(_totalPointsController.text.trim()) ?? 100)
          : 100;

      if (_isEditing) {
        await ModuleService.instance.update(
          Fmt.str(widget.existing!['_id']),
          {
            'title': _titleController.text.trim(),
            'description': _descriptionController.text.trim(),
            'moduleCode': _moduleCodeController.text.trim(),
            'section': _sectionController.text.trim(),
            'deadline': _deadline != null ? Fmt.apiDate(_deadline!) : '',
            'totalPoints': totalPoints,
            'instructions': _instructionsController.text.trim(),
            // Only resend the link when there's no new file upload this
            // save — a real upload below overwrites it on the backend
            // regardless, and we don't want to wipe out an unrelated
            // existing upload when the officer never touched the link field.
            if (_file == null && (linkText.isNotEmpty || _existingIsLink)) ...{
              'fileUrl': linkText,
              'fileName': linkText.isEmpty ? '' : 'Video Link',
            },
          },
          filePath: kIsWeb ? null : _file?.path,
          fileBytes: _file?.bytes,
          fileName: _file?.name,
        );
      } else {
        await ModuleService.instance.create(
          title: _titleController.text.trim(),
          description: _descriptionController.text.trim(),
          program: Session.instance.program,
          moduleCode: _moduleCodeController.text.trim(),
          section: _sectionController.text.trim(),
          instructions: _instructionsController.text.trim(),
          deadline: _deadline,
          totalPoints: totalPoints,
          filePath: kIsWeb ? null : _file?.path,
          fileBytes: _file?.bytes,
          fileName: _file?.name,
          fileUrl: hasLink ? linkText : null,
        );
      }

      if (!mounted) return;
      AppSnack.success(
        context,
        _isEditing
            ? (widget.forAssignment ? 'Assignment updated.' : 'Module updated.')
            : (widget.forAssignment
                ? 'Assignment posted to students.'
                : 'Module posted to students.'),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
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
        title: Text(
          widget.forAssignment
              ? (_isEditing ? 'Edit Assignment' : 'New Assignment')
              : (_isEditing ? 'Edit Module' : 'New Module'),
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ===== TITLE =====
            _buildLabel('Title', required: true),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _titleController,
              hint: 'Enter module title',
            ),
            const SizedBox(height: 20),

            // ===== DESCRIPTION =====
            _buildLabel('Description'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _descriptionController,
              hint: 'What should students do for this module?',
              maxLines: 4,
              maxLength: 500,
            ),
            const SizedBox(height: 20),

            // ===== MODULE CODE (+ SECTION, assignments only) =====
            if (widget.forAssignment)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: _buildModuleCodeField()),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildLabel('Section'),
                        const SizedBox(height: 8),
                        _buildTextField(
                          controller: _sectionController,
                          hint: 'Optional',
                        ),
                      ],
                    ),
                  ),
                ],
              )
            else
              _buildModuleCodeField(),
            const SizedBox(height: 20),

            // ===== DEADLINE + POINTS (assignments only — a module is an
            // ungraded resource, so neither applies to it) =====
            if (widget.forAssignment) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: _buildDeadlineField()),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildLabel('Points'),
                        const SizedBox(height: 8),
                        _buildTextField(
                          controller: _totalPointsController,
                          hint: '100',
                          keyboardType: TextInputType.number,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'A deadline is required — this is what makes it a graded assignment students submit work against.',
                style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),

              // ===== INSTRUCTIONS (assignments only) =====
              _buildLabel('Instructions'),
              const SizedBox(height: 8),
              _buildTextField(
                controller: _instructionsController,
                hint: 'One instruction per line',
                maxLines: 4,
                maxLength: 500,
              ),
              const SizedBox(height: 20),
            ],

            // ===== FILE =====
            _buildLabel('Attach file'),
            const SizedBox(height: 8),
            Stack(
              children: [
                GestureDetector(
                  onTap: _pickFile,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      color: AppColors.grey50,
                    ),
                    child: Column(
                      children: [
                        Icon(
                          _file == null ? Icons.upload : Icons.check_circle,
                          size: 28,
                          color: _file == null
                              ? AppColors.textSecondary
                              : AppColors.success,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _file?.name ??
                              (_isEditing &&
                                      !_existingIsLink &&
                                      Fmt.str(widget.existing?['fileName']).isNotEmpty
                                  ? Fmt.str(widget.existing?['fileName'])
                                  : 'Tap to attach a file'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _file == null
                              ? 'PDF, PPT, video, image or zip, up to 15 MB'
                              : Fmt.fileSize(_file!.size),
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (_file != null)
                  Positioned(
                    top: 6,
                    right: 6,
                    child: GestureDetector(
                      onTap: _removeFile,
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: const BoxDecoration(
                          color: AppColors.white,
                          shape: BoxShape.circle,
                          boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 3)],
                        ),
                        child: const Icon(Icons.close, size: 16, color: AppColors.textSecondary),
                      ),
                    ),
                  ),
              ],
            ),
            // ===== VIDEO LINK (modules only — an assignment always takes a
            // real file, since students submit graded work against it) =====
            if (!widget.forAssignment) ...[
              const SizedBox(height: 16),
              Row(
                children: const [
                  Expanded(child: Divider()),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 10),
                    child: Text('or', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ),
                  Expanded(child: Divider()),
                ],
              ),
              const SizedBox(height: 16),
              _buildLabel('Video Link'),
              const SizedBox(height: 8),
              _buildTextField(
                controller: _linkController,
                hint: 'https://youtube.com/watch?v=...',
                keyboardType: TextInputType.url,
                onChanged: (v) {
                  if (v.isNotEmpty && _file != null) setState(() => _file = null);
                },
              ),
              const SizedBox(height: 4),
              const Text(
                'Paste a YouTube (or other video) link instead of uploading a file.',
                style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
              ),
            ],
            const SizedBox(height: 32),

            // ===== BUTTONS =====
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed:
                        _isSaving ? null : () => Navigator.pop(context, false),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _save,
                    child: _isSaving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(AppColors.white),
                            ),
                          )
                        : Text(_isEditing
                            ? 'Save'
                            : (widget.forAssignment ? 'Post Assignment' : 'Post Module')),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModuleCodeField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel('Module Code'),
        const SizedBox(height: 8),
        _buildTextField(
          controller: _moduleCodeController,
          hint: 'e.g. CWTS - A',
        ),
      ],
    );
  }

  Widget _buildDeadlineField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel('Deadline', required: widget.forAssignment),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: _pickDeadline,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              border: Border.all(
                color: widget.forAssignment && _deadline == null
                    ? AppColors.error
                    : AppColors.border,
              ),
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _deadline != null ? Fmt.dateWithDay(_deadline) : 'No deadline',
                    style: TextStyle(
                      fontSize: 14,
                      color: _deadline != null ? AppColors.textPrimary : AppColors.textSecondary,
                    ),
                  ),
                ),
                if (_deadline != null)
                  GestureDetector(
                    onTap: () => setState(() => _deadline = null),
                    child: const Icon(Icons.close, size: 16, color: AppColors.textSecondary),
                  )
                else
                  const Icon(Icons.calendar_today_outlined, size: 18, color: AppColors.textSecondary),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLabel(String text, {bool required = false}) {
    return Row(
      children: [
        Text(
          text,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        if (required) ...[
          const SizedBox(width: 2),
          const Text(
            '*',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: AppColors.error,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    int maxLines = 1,
    int? maxLength,
    TextInputType? keyboardType,
    ValueChanged<String>? onChanged,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      maxLength: maxLength,
      keyboardType: keyboardType,
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: hint,
      ),
    );
  }
}
