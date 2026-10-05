import 'package:flutter/material.dart';
import '../constants/app_colors.dart';
import '../utils/password_strength.dart';

/// Live strength meter + requirement checklist + security warning shown
/// under a password field. Purely presentational — the caller owns
/// evaluating the password (see [evaluatePasswordStrength]) and decides
/// whether to block submission; this widget only ever reflects that result.
class PasswordStrengthIndicator extends StatelessWidget {
  const PasswordStrengthIndicator({super.key, required this.result});

  final PasswordStrengthResult result;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 180),
      alignment: Alignment.topCenter,
      child: result.label.isEmpty
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildMeter(),
                  const SizedBox(height: 10),
                  if (result.warning != null) ...[
                    _buildWarning(),
                    const SizedBox(height: 10),
                  ],
                  _buildChecklist(),
                ],
              ),
            ),
    );
  }

  Widget _buildMeter() {
    // 5 segments read naturally against the 5 named tiers even though the
    // underlying score maxes out at 6 — a near-full bar for "Very Strong"
    // reads better than reserving a sliver for an invisible 6th tier.
    final filled = result.score >= 6 ? 5 : result.score;
    return Row(
      children: [
        Expanded(
          child: Row(
            children: List.generate(5, (i) {
              final isFilled = i < filled;
              return Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOut,
                  margin: EdgeInsets.only(right: i == 4 ? 0 : 4),
                  height: 5,
                  decoration: BoxDecoration(
                    color: isFilled ? result.color : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              );
            }),
          ),
        ),
        const SizedBox(width: 10),
        AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 220),
          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: result.color),
          child: Text(result.label),
        ),
      ],
    );
  }

  Widget _buildWarning() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.orangeLight,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, size: 15, color: Color(0xFF9A5B00)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              result.warning!,
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF9A5B00), height: 1.35),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChecklist() {
    final items = <(bool, String)>[
      (result.hasMinLength, 'At least 8 characters'),
      (result.hasUppercase, 'Uppercase letter'),
      (result.hasLowercase, 'Lowercase letter'),
      (result.hasNumber, 'Number'),
      (result.hasSpecialChar, 'Special character'),
    ];

    return Wrap(
      spacing: 14,
      runSpacing: 4,
      children: items.map((item) {
        final (met, label) = item;
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
              child: Icon(
                met ? Icons.check_circle : Icons.circle_outlined,
                key: ValueKey(met),
                size: 13,
                color: met ? AppColors.success : Colors.grey.shade400,
              ),
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                color: met ? AppColors.success : Colors.grey.shade600,
                fontWeight: met ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        );
      }).toList(),
    );
  }
}
