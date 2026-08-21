import 'package:flutter/material.dart';
import 'cwts_trainer_attendance_screen.dart';
import '../../cwts_officer/screens/submission_screen/cwts_officer_submissions_screen.dart';
import '../../auth/cwts_trainer_login_screen.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/widgets/async_view.dart';

/// The "More" tab. It replaces the placeholder screen with the instructor
/// actions the requirements list: monitor attendance, review submissions,
/// recalculate and export final grades.
class CwtsTrainerMoreScreen extends StatefulWidget {
  const CwtsTrainerMoreScreen({super.key});

  @override
  State<CwtsTrainerMoreScreen> createState() => _CwtsTrainerMoreScreenState();
}

class _CwtsTrainerMoreScreenState extends State<CwtsTrainerMoreScreen> {
  bool _isBusy = false;

  Future<void> _recalculateGrades() async {
    setState(() => _isBusy = true);
    try {
      final count = await GradeService.instance
          .recalculate(program: Session.instance.program);
      if (!mounted) return;
      AppSnack.success(context, 'Recalculated $count grade(s).');
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  void _showExportLink() {
    final url =
        '${AppConfig.apiBaseUrl}/grades/report/export?program=${Session.instance.program}';
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Export final grades',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Open this link with your instructor account to download the CSV '
              'report:',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
            ),
            const SizedBox(height: 12),
            SelectableText(
              url,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.primaryMaroon,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = Session.instance;

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        automaticallyImplyLeading: false,
        title: const Text(
          'More',
          style: TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                const CircleAvatar(
                  radius: 26,
                  backgroundColor: AppColors.primaryMaroon,
                  child: Icon(Icons.school, color: Colors.white, size: 26),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session.name.isEmpty ? 'Instructor' : session.name,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        session.email,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${session.program} Instructor',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _tile(
            icon: Icons.fact_check_outlined,
            label: 'Monitor Attendance',
            subtitle: 'View and correct trainee attendance',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const CwtsTrainerAttendanceScreen(),
              ),
            ),
          ),
          _tile(
            icon: Icons.article_outlined,
            label: 'Review Submissions',
            subtitle: 'Grade the work trainees have turned in',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const CwtsOfficerSubmissionsScreen(),
              ),
            ),
          ),
          _tile(
            icon: Icons.calculate_outlined,
            label: 'Recalculate Final Grades',
            subtitle: 'Recompute every grade from attendance and submissions',
            onTap: _isBusy ? null : _recalculateGrades,
            trailing: _isBusy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : null,
          ),
          _tile(
            icon: Icons.download_outlined,
            label: 'Export Final Grade Report',
            subtitle: 'Download the class CSV report',
            onTap: _showExportLink,
          ),

          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                await AuthService.instance.logout();
                if (!context.mounted) return;
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const CwtsTrainerLoginScreen(),
                  ),
                  (route) => false,
                );
              },
              icon: const Icon(Icons.logout, size: 18),
              label: const Text('Logout'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primaryMaroon,
                side: const BorderSide(color: AppColors.primaryMaroon),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tile({
    required IconData icon,
    required String label,
    required String subtitle,
    VoidCallback? onTap,
    Widget? trailing,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: ListTile(
        onTap: onTap,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.primaryMaroon.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.primaryMaroon, size: 20),
        ),
        title: Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
        ),
        trailing: trailing ??
            Icon(Icons.arrow_forward_ios,
                color: Colors.grey.shade400, size: 14),
      ),
    );
  }
}
