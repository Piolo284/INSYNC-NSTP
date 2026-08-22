import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Officer grading screen.
///
/// The rubric rows come from the module in MongoDB instead of the hard-coded
/// four-item list, the running total is still summed the same way, and
/// "Submit Grade" posts the scores — which also recalculates the trainee's
/// overall grade server-side.
class CwtsOfficerGradeSubmissionScreen extends StatefulWidget {
  final String submissionId;

  const CwtsOfficerGradeSubmissionScreen({
    super.key,
    required this.submissionId,
  });

  @override
  State<CwtsOfficerGradeSubmissionScreen> createState() =>
      _CwtsOfficerGradeSubmissionScreenState();
}

class _CwtsOfficerGradeSubmissionScreenState
    extends State<CwtsOfficerGradeSubmissionScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  bool _isSaving = false;

  Map<String, dynamic> _submission = const {};
  List<Map<String, dynamic>> _rubrics = [];
  final List<TextEditingController> _scoreControllers = [];
  final TextEditingController _feedbackController = TextEditingController();

  /// Used when the module has no rubric — a single score out of totalPoints.
  final TextEditingController _flatScoreController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _scoreControllers) {
      c.dispose();
    }
    _feedbackController.dispose();
    _flatScoreController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final submission =
          await SubmissionService.instance.get(widget.submissionId);

      final module = submission['moduleId'];
      final moduleMap = module is Map ? module.cast<String, dynamic>() : const {};

      // Prefer scores already saved on the submission; fall back to the
      // module's rubric definition with zeroed scores.
      final existingScores =
          ((submission['rubricScores'] as List?) ?? const [])
              .cast<Map<String, dynamic>>();
      final moduleRubrics =
          ((moduleMap['rubrics'] as List?) ?? const []).cast<Map<String, dynamic>>();

      final rubrics = existingScores.isNotEmpty
          ? existingScores
              .map((r) => {
                    'title': Fmt.str(r['title'], 'Criterion'),
                    'points': Fmt.toInt(r['points']),
                    'description': '',
                    'score': Fmt.toInt(r['score']),
                  })
              .toList()
          : moduleRubrics
              .map((r) => {
                    'title': Fmt.str(r['title'], 'Criterion'),
                    'points': Fmt.toInt(r['points']),
                    'description': Fmt.str(r['description']),
                    'score': 0,
                  })
              .toList();

      // Rubric descriptions live on the module, not on saved scores — merge
      // them back in so the officer still sees the criteria text.
      if (existingScores.isNotEmpty && moduleRubrics.isNotEmpty) {
        for (final rubric in rubrics) {
          final match = moduleRubrics.firstWhere(
            (m) => Fmt.str(m['title']) == rubric['title'],
            orElse: () => const {},
          );
          rubric['description'] = Fmt.str(match['description']);
        }
      }

      if (!mounted) return;

      for (final c in _scoreControllers) {
        c.dispose();
      }
      _scoreControllers.clear();
      for (final r in rubrics) {
        _scoreControllers
            .add(TextEditingController(text: '${Fmt.toInt(r['score'])}'));
      }

      setState(() {
        _submission = submission;
        _rubrics = rubrics;
        _feedbackController.text = Fmt.str(submission['feedback']);
        _flatScoreController.text = submission['score'] == null
            ? ''
            : '${Fmt.toInt(submission['score'])}';
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

  bool get _hasRubrics => _rubrics.isNotEmpty;

  int get _totalScore => _hasRubrics
      ? _rubrics.fold(0, (sum, r) => sum + Fmt.toInt(r['score']))
      : Fmt.toInt(_flatScoreController.text);

  int get _totalPoints => _hasRubrics
      ? _rubrics.fold(0, (sum, r) => sum + Fmt.toInt(r['points']))
      : Fmt.toInt(_module['totalPoints'], 100);

  Future<void> _submitGrade() async {
    if (_hasRubrics) {
      for (final r in _rubrics) {
        final score = Fmt.toInt(r['score']);
        final points = Fmt.toInt(r['points']);
        if (score < 0 || score > points) {
          AppSnack.error(
            context,
            'Score for "${r['title']}" must be between 0 and $points.',
          );
          return;
        }
      }
    } else {
      final score = _totalScore;
      if (_flatScoreController.text.trim().isEmpty) {
        AppSnack.error(context, 'Please enter a score.');
        return;
      }
      if (score < 0 || score > _totalPoints) {
        AppSnack.error(
          context,
          'Score must be between 0 and $_totalPoints.',
        );
        return;
      }
    }

    setState(() => _isSaving = true);

    try {
      await SubmissionService.instance.grade(
        widget.submissionId,
        rubricScores: _hasRubrics
            ? _rubrics
                .map((r) => {
                      'title': r['title'],
                      'points': Fmt.toInt(r['points']),
                      'score': Fmt.toInt(r['score']),
                    })
                .toList()
            : null,
        score: _hasRubrics ? null : _totalScore,
        totalPoints: _hasRubrics ? null : _totalPoints,
        feedback: _feedbackController.text.trim(),
      );

      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSuccessDialog();
    } catch (error) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      AppSnack.error(context, describeError(error));
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: AppColors.greenLight,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, color: AppColors.success, size: 32),
              ),
              const SizedBox(height: 20),
              const Text(
                'Grade Submitted!',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'You have successfully graded\nthis submission.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Final Grade',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$_totalScore / $_totalPoints',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryMaroon,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(dialogContext); // close dialog
                    Navigator.pop(context); // back to submission view
                  },
                  child: const Text('OK'),
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
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const Divider(height: 32),

              // ===== RUBRICS HEADER =====
              SectionHeader(
                title: _hasRubrics ? 'Rubrics' : 'Score',
                subtitle: '$_totalPoints total points',
              ),
              const SizedBox(height: 16),

              // ===== RUBRIC ITEMS =====
              if (_hasRubrics)
                ..._rubrics.asMap().entries.map((entry) {
                  return _buildRubricCard(entry.value, entry.key);
                })
              else
                _buildFlatScoreField(),
              const SizedBox(height: 20),

              // ===== FEEDBACK =====
              const SectionHeader(title: 'Feedback'),
              const SizedBox(height: 8),
              TextField(
                controller: _feedbackController,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Write feedback for the trainee (optional)',
                ),
              ),
              const SizedBox(height: 20),

              // ===== FINAL GRADE =====
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.goldLight,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Final Grade',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primaryDark,
                      ),
                    ),
                    Text(
                      '$_totalScore / $_totalPoints',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primaryDark,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // ===== SUBMIT BUTTON =====
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _submitGrade,
                  child: _isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(AppColors.white),
                          ),
                        )
                      : const Text('Submit Grade'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFlatScoreField() {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Score out of $_totalPoints',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          SizedBox(
            width: 80,
            child: TextField(
              controller: _flatScoreController,
              textAlign: TextAlign.center,
              keyboardType: TextInputType.number,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
              decoration: InputDecoration(
                isDense: true,
                filled: false,
                contentPadding: const EdgeInsets.symmetric(vertical: 8),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                suffixText: '/$_totalPoints',
                suffixStyle: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRubricCard(Map<String, dynamic> rubric, int index) {
    final points = Fmt.toInt(rubric['points']);
    final score = Fmt.toInt(rubric['score']);
    final isOver = score > points;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(
          color: isOver ? AppColors.error : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  Fmt.str(rubric['title'], 'Criterion'),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              SizedBox(
                width: 70,
                child: TextField(
                  controller: _scoreControllers[index],
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.number,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isOver ? AppColors.error : AppColors.textPrimary,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: false,
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    suffixText: '/$points',
                    suffixStyle: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  onChanged: (v) {
                    setState(() {
                      _rubrics[index]['score'] = int.tryParse(v) ?? 0;
                    });
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '($points pts)',
            style: TextStyle(
              fontSize: 11,
              color: isOver ? AppColors.error : AppColors.textSecondary,
            ),
          ),
          if (Fmt.str(rubric['description']).isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              Fmt.str(rubric['description']),
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
