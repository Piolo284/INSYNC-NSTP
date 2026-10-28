import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../utils/formatters.dart';

/// Read-only grading rubric: each criterion with its description, max points
/// and share of the total (its weight). Pass [scores] (the submission's
/// `rubricScores`) once graded to show what was awarded per criterion.
class RubricView extends StatelessWidget {
  final List<Map<String, dynamic>> rubrics;
  final List<Map<String, dynamic>> scores;

  const RubricView({super.key, required this.rubrics, this.scores = const []});

  static List<Map<String, dynamic>> listFrom(Object? raw) =>
      ((raw as List?) ?? const []).whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();

  @override
  Widget build(BuildContext context) {
    if (rubrics.isEmpty) {
      return const Text(
        'No rubric was set for this activity.',
        style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
      );
    }

    final total = rubrics.fold<int>(0, (sum, r) => sum + Fmt.toInt(r['points']));
    num? scoreFor(String title) {
      for (final s in scores) {
        if (Fmt.str(s['title']).toLowerCase() == title.toLowerCase()) return Fmt.toDouble(s['score']);
      }
      return null;
    }

    final graded = scores.isNotEmpty;
    final awardedTotal = graded
        ? rubrics.fold<double>(0, (sum, r) => sum + (scoreFor(Fmt.str(r['title'])) ?? 0))
        : 0.0;

    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rubrics.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.border),
            _row(rubrics[i], total, graded ? scoreFor(Fmt.str(rubrics[i]['title'])) : null),
          ],
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: const BoxDecoration(
              color: AppColors.grey50,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(AppColors.radiusSm)),
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                const Text('Total', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const Spacer(),
                Text(
                  graded ? '${_fmt(awardedTotal)} / $total pts' : '$total pts',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primaryMaroon),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _fmt(num n) => n == n.roundToDouble() ? n.toInt().toString() : n.toStringAsFixed(1);

  Widget _row(Map<String, dynamic> r, int total, num? awarded) {
    final points = Fmt.toInt(r['points']);
    final pct = total > 0 ? (points / total * 100) : 0;
    final description = Fmt.str(r['description']);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(r['title'], 'Criterion'),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(description, style: const TextStyle(fontSize: 12, height: 1.4, color: AppColors.textSecondary)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                awarded != null ? '${_fmt(awarded)} / $points' : '$points pts',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 2),
              Text(
                '${pct.toStringAsFixed(pct == pct.roundToDouble() ? 0 : 1)}%',
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
