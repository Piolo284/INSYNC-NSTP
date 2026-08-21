import 'package:flutter/material.dart';
import 'screens/cwts_trainer_attendance_screen.dart';
import 'screens/cwts_trainer_modules_screen.dart';
import 'screens/cwts_trainer_students_screen.dart';
import '../auth/cwts_trainer_login_screen.dart';
import '../cwts_officer/screens/cwts_officer_announcement_screen.dart';
import '../cwts_officer/screens/submission_screen/cwts_officer_submissions_screen.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';

/// Side menu for the instructor shell, matching the officer drawer's design.
class CwtsTrainerDrawer extends StatelessWidget {
  const CwtsTrainerDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final session = Session.instance;

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 30),
              child: Column(
                children: [
                  const CircleAvatar(
                    radius: 45,
                    backgroundColor: AppColors.primaryMaroon,
                    child: Icon(
                      Icons.school,
                      color: Colors.white,
                      size: 45,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    session.name.isEmpty ? 'Instructor' : session.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${session.program} Instructor',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
            Divider(
              height: 1,
              color: Colors.grey.shade200,
              indent: 20,
              endIndent: 20,
            ),
            const SizedBox(height: 10),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _buildMenuItem(
                    icon: Icons.folder_outlined,
                    label: 'Modules',
                    onTap: () => _navigateTo(
                        context, const CwtsTrainerModulesScreen()),
                  ),
                  _buildMenuItem(
                    icon: Icons.people_outline,
                    label: 'Students',
                    onTap: () => _navigateTo(
                        context, const CwtsTrainerStudentsScreen()),
                  ),
                  _buildMenuItem(
                    icon: Icons.fact_check_outlined,
                    label: 'Attendance',
                    onTap: () => _navigateTo(
                        context, const CwtsTrainerAttendanceScreen()),
                  ),
                  _buildMenuItem(
                    icon: Icons.article_outlined,
                    label: 'Submissions',
                    onTap: () => _navigateTo(
                        context, const CwtsOfficerSubmissionsScreen()),
                  ),
                  _buildMenuItem(
                    icon: Icons.campaign_outlined,
                    label: 'Announcements',
                    onTap: () => _navigateTo(
                        context, const CwtsOfficerAnnouncementScreen()),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: GestureDetector(
                onTap: () async {
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
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.logout,
                        color: AppColors.primaryMaroon,
                        size: 18,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Logout',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primaryMaroon,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _navigateTo(BuildContext context, Widget screen) {
    Navigator.pop(context); // Close drawer
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
      leading: Icon(
        icon,
        color: AppColors.primaryMaroon,
        size: 22,
      ),
      title: Text(
        label,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Colors.black87,
        ),
      ),
      trailing: Icon(
        Icons.arrow_forward_ios,
        color: Colors.grey.shade400,
        size: 14,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
      ),
    );
  }
}
