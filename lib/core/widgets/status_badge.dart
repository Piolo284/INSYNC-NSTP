import 'package:flutter/material.dart';

import '../constants/app_colors.dart';

/// One place that maps every status string used across the app — attendance,
/// activities, modules, submissions, grades, announcements, documents — to a
/// consistent color, so the same word always reads the same way no matter
/// which screen it appears on.
class StatusStyle {
  const StatusStyle(this.color, this.background);

  final Color color;
  final Color background;

  static StatusStyle of(String status) {
    switch (status.trim().toLowerCase()) {
      // Attendance
      case 'present':
      case 'approved as present':
      case 'active':
      case 'approved':
      case 'published':
      case 'passed':
      case 'graded':
      case 'completed':
      case 'uploaded':
        return const StatusStyle(AppColors.success, AppColors.greenLight);

      case 'late':
        return const StatusStyle(AppColors.lateStatus, AppColors.orangeLight);

      case 'warning':
      case 'at risk for dropping':
      case 'pending':
      case 'pending review':
      case 'needs reply':
      case 'under review':
      case 'in progress':
      case 'awaiting approval':
      case 'upcoming':
        return const StatusStyle(AppColors.warning, AppColors.orangeLight);

      case 'absent':
      case 'failed':
      case 'rejected':
      case 'missing':
      case 'cancelled':
      case 'inactive':
      case 'dropped':
      case 'at risk / restricted':
      case 'restricted':
      case 'overdue':
      case 'late submission':
        return const StatusStyle(AppColors.error, AppColors.errorLight);

      case 'excused':
      case 'approved as excuse':
      case 'submitted':
      case 'to do':
      case 'draft':
      case 'ongoing':
        return const StatusStyle(AppColors.blue, AppColors.blueLight);

      case 'incomplete':
      case 'archived':
      default:
        return StatusStyle(AppColors.textSecondary, AppColors.grey100);
    }
  }
}

/// A small colored pill used for every status/remarks word in the app
/// (attendance status, activity/module status, submission state, grade
/// remarks, announcement pin state, document review state, ...).
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.label, {super.key, this.dense = false});

  final String label;

  /// Slightly smaller padding/text for tight spaces (e.g. inline in a list row).
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final style = StatusStyle.of(label);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 8 : 10,
        vertical: dense ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: dense ? 10.5 : 11.5,
          fontWeight: FontWeight.w700,
          color: style.color,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
