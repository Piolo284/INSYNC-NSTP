import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_dialogs.dart';
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
/// doesn't change what gets created. [isQuiz] (with [forAssignment]) posts
/// the graded item as a Quiz instead of an Assignment — same deadline,
/// rubric and grading, just labelled differently.
class CwtsOfficerAddModuleScreen extends StatefulWidget {
  final Map<String, dynamic>? existing;
  final bool forAssignment;
  final bool isQuiz;

  const CwtsOfficerAddModuleScreen({
    super.key,
    this.existing,
    this.forAssignment = false,
    this.isQuiz = false,
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
  final TextEditingController _instructionsController = TextEditingController();
  final TextEditingController _totalPointsController =
      TextEditingController(text: '100');
  final TextEditingController _linkController = TextEditingController();
  // Quiz form only.
  final TextEditingController _quizNumberController = TextEditingController();
  final TextEditingController _formUrlController = TextEditingController();

  DateTime? _deadline;
  PlatformFile? _file;
  bool _isSaving = false;

  /// True when the existing record's attachment is an external link rather
  /// than a server-uploaded file — decides what an unchanged save resends.
  bool _existingIsLink = false;

  /// Grading rubric — required for an assignment (graded activity). Its
  /// criteria must add up to the Points field; validated again server-side.
  final List<_RubricRow> _rubric = [];

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _titleController.text = Fmt.str(existing['title']);
      _descriptionController.text = Fmt.str(existing['description']);
      _moduleCodeController.text = Fmt.str(existing['moduleCode']);
      _instructionsController.text =
          ((existing['instructions'] as List?) ?? const [])
              .map((e) => e.toString())
              .join('\n');
      _totalPointsController.text = '${Fmt.toInt(existing['totalPoints'], 100)}';
      _quizNumberController.text = Fmt.str(existing['quizNumber']);
      _formUrlController.text = Fmt.str(existing['formUrl']);
      _deadline = Fmt.parse(existing['deadline']);
      for (final r in ((existing['rubrics'] as List?) ?? const []).whereType<Map>()) {
        _rubric.add(_RubricRow(
          title: Fmt.str(r['title']),
          description: Fmt.str(r['description']),
          points: Fmt.toInt(r['points']),
        ));
      }

      final existingFileUrl = Fmt.str(existing['fileUrl']);
      // Uploaded files are stored as an absolute ".../api/files/<id>" URL too,
      // so only a non-upload http(s) URL is an external link (YouTube, etc.).
      _existingIsLink = existingFileUrl.startsWith('http') && !existingFileUrl.contains('/api/files/');
      if (_existingIsLink) _linkController.text = existingFileUrl;
    }
    if (widget.forAssignment && !_quizForm && _rubric.isEmpty) _rubric.add(_RubricRow());
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _moduleCodeController.dispose();
    _instructionsController.dispose();
    _totalPointsController.dispose();
    _linkController.dispose();
    _quizNumberController.dispose();
    _formUrlController.dispose();
    for (final row in _rubric) {
      row.dispose();
    }
    super.dispose();
  }

  int get _rubricTotal => _rubric.fold(0, (sum, r) => sum + (int.tryParse(r.points.text.trim()) ?? 0));

  bool get _isQuiz =>
      widget.isQuiz || Fmt.str(widget.existing?['kind']) == 'Quiz';

  /// "Quiz" or "Assignment" — what this graded item is called in the form.
  String get _noun => _isQuiz ? 'Quiz' : 'Assignment';

  /// The quiz form: Quiz No., Title, Description, Deadline, Score, an
  /// optional PDF/Word file and an optional Google Form link — no rubric
  /// editor (the score becomes a single "Score" criterion for grading).
  bool get _quizForm => widget.forAssignment && _isQuiz;

  int get _assignmentPoints => int.tryParse(_totalPointsController.text.trim()) ?? 0;

  void _addCriterion() => setState(() => _rubric.add(_RubricRow()));

  void _removeCriterion(int index) {
    setState(() => _rubric.removeAt(index).dispose());
  }

  /// Null when the rubric is valid, otherwise what to fix.
  String? _rubricError() {
    if (_rubric.isEmpty) return 'Add at least one rubric criterion.';
    final seen = <String>{};
    for (var i = 0; i < _rubric.length; i++) {
      final name = _rubric[i].title.text.trim();
      final points = int.tryParse(_rubric[i].points.text.trim());
      if (name.isEmpty) return 'Criterion ${i + 1} needs a name.';
      if (!seen.add(name.toLowerCase())) return 'Two criteria are both named "$name". Each must be unique.';
      if (points == null || points <= 0) return '"$name" must be worth a whole number of points greater than 0.';
    }
    if (_assignmentPoints <= 0) return "Enter the ${_noun.toLowerCase()}'s total points.";
    if (_rubricTotal != _assignmentPoints) {
      return 'The rubric adds up to $_rubricTotal points, but the ${_noun.toLowerCase()} is worth $_assignmentPoints. Make them equal.';
    }
    return null;
  }

  List<Map<String, dynamic>> _rubricPayload() => _rubric
      .map((r) => {
            'title': r.title.text.trim(),
            'description': r.description.text.trim(),
            'points': int.tryParse(r.points.text.trim()) ?? 0,
          })
      .toList();

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
        allowedExtensions: _quizForm
            ? const ['pdf', 'doc', 'docx']
            : const [
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
    if (_quizForm) return _saveQuiz();
    if (_titleController.text.trim().isEmpty) {
      AppSnack.error(context, 'Please enter the module title.');
      return;
    }
    if (widget.forAssignment && _deadline == null) {
      AppSnack.error(context, 'Please set a deadline for this ${_noun.toLowerCase()}.');
      return;
    }
    if (widget.forAssignment) {
      final rubricError = _rubricError();
      if (rubricError != null) {
        AppSnack.error(context, rubricError);
        return;
      }
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
            // Assignments no longer have a code/section field — leave any
            // existing value untouched rather than blanking it.
            if (!widget.forAssignment) 'moduleCode': _moduleCodeController.text.trim(),
            'deadline': _deadline != null ? Fmt.apiDate(_deadline!) : '',
            'totalPoints': totalPoints,
            'instructions': _instructionsController.text.trim(),
            if (widget.forAssignment) 'rubrics': jsonEncode(_rubricPayload()),
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
          moduleCode: widget.forAssignment ? '' : _moduleCodeController.text.trim(),
          kind: _isQuiz ? 'Quiz' : 'Assignment',
          instructions: _instructionsController.text.trim(),
          deadline: _deadline,
          totalPoints: totalPoints,
          rubrics: widget.forAssignment ? _rubricPayload() : const [],
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
            ? (widget.forAssignment ? '$_noun updated.' : 'Module updated.')
            : (widget.forAssignment
                ? '$_noun posted to students.'
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

  /// Saves the quiz form. Only Title and Deadline are needed (a deadline is
  /// what lists it as a graded item); Quiz No., file and Google Form link
  /// are all optional. Always asks for confirmation before posting.
  Future<void> _saveQuiz() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      AppSnack.error(context, 'Please enter the quiz title.');
      return;
    }
    if (_deadline == null) {
      AppSnack.error(context, 'Please set a deadline for this quiz.');
      return;
    }
    final scoreText = _totalPointsController.text.trim();
    final score = scoreText.isEmpty ? 100 : int.tryParse(scoreText);
    if (score == null || score <= 0) {
      AppSnack.error(context, 'Score must be a whole number greater than 0.');
      return;
    }
    final formUrl = _formUrlController.text.trim();
    if (formUrl.isNotEmpty && !(formUrl.startsWith('http://') || formUrl.startsWith('https://'))) {
      AppSnack.error(context, 'Please enter the full Google Form link starting with https://');
      return;
    }
    final quizNumber = _quizNumberController.text.trim();

    final confirmed = await showConfirmDialog(
      context,
      title: _isEditing ? 'Save changes to this quiz?' : 'Post this quiz?',
      message: _isEditing
          ? 'Students will see the updated quiz right away.'
          : '"$title" will be posted to all students, due ${Fmt.date(_deadline)}.',
      confirmLabel: _isEditing ? 'Save' : 'Post Quiz',
      danger: false,
    );
    if (!confirmed || !mounted) return;

    setState(() => _isSaving = true);
    final rubric = [
      {'title': 'Score', 'description': '', 'points': score},
    ];
    try {
      if (_isEditing) {
        await ModuleService.instance.update(
          Fmt.str(widget.existing!['_id']),
          {
            'title': title,
            'description': _descriptionController.text.trim(),
            'kind': 'Quiz',
            'quizNumber': quizNumber,
            'formUrl': formUrl,
            'deadline': Fmt.apiDate(_deadline!),
            'totalPoints': score,
            'rubrics': jsonEncode(rubric),
          },
          filePath: kIsWeb ? null : _file?.path,
          fileBytes: _file?.bytes,
          fileName: _file?.name,
        );
      } else {
        await ModuleService.instance.create(
          title: title,
          description: _descriptionController.text.trim(),
          program: Session.instance.program,
          kind: 'Quiz',
          quizNumber: quizNumber,
          formUrl: formUrl,
          deadline: _deadline,
          totalPoints: score,
          rubrics: rubric,
          filePath: kIsWeb ? null : _file?.path,
          fileBytes: _file?.bytes,
          fileName: _file?.name,
        );
      }
      if (!mounted) return;
      AppSnack.success(context, _isEditing ? 'Quiz updated.' : 'Quiz posted to students.');
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
              ? (_isEditing ? 'Edit $_noun' : 'New $_noun')
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
            // ===== QUIZ NO. (quiz only) =====
            if (_quizForm) ...[
              _buildLabel('Quiz No.'),
              const SizedBox(height: 8),
              _buildTextField(
                controller: _quizNumberController,
                hint: 'e.g. 1',
              ),
              const SizedBox(height: 20),
            ],

            // ===== TITLE =====
            _buildLabel('Title', required: true),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _titleController,
              hint: _quizForm ? 'Enter quiz title' : 'Enter module title',
            ),
            const SizedBox(height: 20),

            // ===== DESCRIPTION =====
            _buildLabel('Description'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _descriptionController,
              hint: _quizForm ? 'What is this quiz about?' : 'What should students do for this module?',
              maxLines: 4,
              maxLength: 500,
            ),
            const SizedBox(height: 20),

            // ===== MODULE CODE (modules only) =====
            if (!widget.forAssignment) ...[
              _buildModuleCodeField(),
              const SizedBox(height: 20),
            ],

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
                        _buildLabel(_quizForm ? 'Score' : 'Points'),
                        const SizedBox(height: 8),
                        _buildTextField(
                          controller: _totalPointsController,
                          hint: '100',
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState(() {}),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'A deadline is required — this is what makes it a graded ${_noun.toLowerCase()} students submit work against.',
                style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),
            ],

            // ===== INSTRUCTIONS + RUBRIC (assignments only — a quiz is
            // graded on its single Score) =====
            if (widget.forAssignment && !_quizForm) ...[
              _buildLabel('Instructions'),
              const SizedBox(height: 8),
              _buildTextField(
                controller: _instructionsController,
                hint: 'One instruction per line',
                maxLines: 4,
                maxLength: 500,
              ),
              const SizedBox(height: 20),

              // ===== RUBRIC (assignments only — required) =====
              _buildRubricEditor(),
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
                              ? (_quizForm ? 'PDF or Word document — optional' : 'PDF, PPT, video, image or zip, up to 15 MB')
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
            // ===== GOOGLE FORM LINK (quiz only, optional) =====
            if (_quizForm) ...[
              const SizedBox(height: 20),
              _buildLabel('Google Form link'),
              const SizedBox(height: 8),
              _buildTextField(
                controller: _formUrlController,
                hint: 'https://forms.gle/...',
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 4),
              const Text(
                'Optional — students open this link to answer the quiz online.',
                style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
              ),
            ],
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
                            : (widget.forAssignment ? 'Post $_noun' : 'Post Module')),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRubricEditor() {
    final total = _rubricTotal;
    final points = _assignmentPoints;
    final matches = total == points && points > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel('Rubric', required: true),
        const SizedBox(height: 4),
        Text(
          'How this ${_noun.toLowerCase()} is graded. Students see the rubric before they submit.',
          style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 10),
        for (var i = 0; i < _rubric.length; i++) _buildCriterionCard(i, total),
        OutlinedButton.icon(
          onPressed: _addCriterion,
          icon: const Icon(Icons.add, size: 18),
          label: const Text('Add Criterion'),
        ),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: matches ? AppColors.greenLight : AppColors.errorLight,
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
          ),
          child: Row(
            children: [
              Icon(
                matches ? Icons.check_circle_outline : Icons.error_outline,
                size: 18,
                color: matches ? AppColors.success : AppColors.error,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  matches
                      ? 'Rubric total: $total / $points points'
                      : "Rubric total: $total / $points points — must equal the ${_noun.toLowerCase()}'s points",
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: matches ? AppColors.success : AppColors.error,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCriterionCard(int index, int total) {
    final row = _rubric[index];
    final points = int.tryParse(row.points.text.trim()) ?? 0;
    final weight = total > 0 ? (points / total * 100) : 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(12, 10, 4, 12),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        color: AppColors.grey50,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Criterion ${index + 1}',
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(width: 8),
              Text(
                '${weight.toStringAsFixed(weight == weight.roundToDouble() ? 0 : 1)}% of grade',
                style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Remove criterion',
                visualDensity: VisualDensity.compact,
                onPressed: _rubric.length == 1 ? null : () => _removeCriterion(index),
                icon: const Icon(Icons.delete_outline, size: 20),
                color: AppColors.error,
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: _buildTextField(
                    controller: row.title,
                    hint: 'e.g. Content Understanding',
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 1,
                  child: _buildTextField(
                    controller: row.points,
                    hint: 'Points',
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _buildTextField(
              controller: row.description,
              hint: 'Description (optional) — what earns full points',
              maxLines: 2,
            ),
          ),
        ],
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

/// One editable rubric criterion on the assignment form.
class _RubricRow {
  _RubricRow({String title = '', String description = '', int? points})
      : title = TextEditingController(text: title),
        description = TextEditingController(text: description),
        points = TextEditingController(text: points == null ? '' : '$points');

  final TextEditingController title;
  final TextEditingController description;
  final TextEditingController points;

  void dispose() {
    title.dispose();
    description.dispose();
    points.dispose();
  }
}
