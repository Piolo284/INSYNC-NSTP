import 'package:flutter/material.dart';
import 'side_menu/profile/cwts_personal_info_screen.dart';
import 'side_menu/account_security/cwts_account_security_screen.dart';
import 'side_menu/documents/cwts_documents_screen.dart';
import 'side_menu/notifications/cwts_notification_settings_screen.dart';
import 'side_menu/about/cwts_about_screen.dart';
import 'side_menu/help_support/cwts_help_support_screen.dart';
import 'screens/cwts_officer_students_screen.dart';
import '../auth/cwts_officer_login_screen.dart';
import '../auth/rotc_officer_login_screen.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/widgets/app_dialogs.dart';
import '../../core/widgets/profile_header.dart';

class CwtsOfficerDrawer extends StatelessWidget {
  const CwtsOfficerDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final session = Session.instance;
    final isRotc = session.program == 'ROTC';
    // An Attendance Officer has no management duties over other trainees or
    // their documents, so those menu items are hidden for them here.
    final isAttendanceOnly = session.isAttendanceOnlyOfficer;

    return Drawer(
      backgroundColor: AppColors.white,
      child: SafeArea(
        child: Column(
          children: [
            ProfileHeader(
              name: session.name.isEmpty ? 'Officer' : session.name,
              subtitle: '${session.program} Officer',
              imagePath: session.profileImage,
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                children: [
                  const _SectionLabel('MY ACCOUNT'),
                  _MenuItem(
                    icon: Icons.person_outline,
                    label: 'My Profile',
                    onTap: () =>
                        _navigateTo(context, const CwtsPersonalInfoScreen()),
                  ),
                  _MenuItem(
                    icon: Icons.settings_outlined,
                    label: 'Settings',
                    onTap: () => _navigateTo(
                        context, const CwtsAccountSecurityScreen()),
                  ),
                  const SizedBox(height: 8),
                  const _SectionLabel('MANAGEMENT'),
                  if (!isAttendanceOnly) ...[
                    _MenuItem(
                      icon: Icons.people_outline,
                      label: isRotc ? 'Manage Cadets' : 'Manage Students',
                      onTap: () => _navigateTo(
                          context, const CwtsOfficerStudentsScreen()),
                    ),
                    _MenuItem(
                      icon: Icons.description_outlined,
                      label: 'Document Review',
                      onTap: () =>
                          _navigateTo(context, const CwtsDocumentsScreen()),
                    ),
                  ],
                  _MenuItem(
                    icon: Icons.mail_outline,
                    label: 'Notification Setting',
                    onTap: () => _navigateTo(
                        context, const CwtsNotificationSettingsScreen()),
                  ),
                  const SizedBox(height: 8),
                  const _SectionLabel('SUPPORT'),
                  _MenuItem(
                    icon: Icons.help_outline,
                    label: 'Help & Support',
                    onTap: () =>
                        _navigateTo(context, const CwtsHelpSupportScreen()),
                  ),
                  _MenuItem(
                    icon: Icons.info_outline,
                    label: 'About ${session.program} Officer Portal',
                    onTap: () => _navigateTo(context, const CwtsAboutScreen()),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _confirmLogout(context),
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text('Logout'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primaryMaroon,
                    side: const BorderSide(color: AppColors.border),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Log out?',
      message: 'You will need to sign in again to manage attendance, activities, and student records.',
      confirmLabel: 'Logout',
    );
    if (!confirmed) return;

    final isRotc = Session.instance.program == 'ROTC';
    await AuthService.instance.logout();
    if (!context.mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(
        builder: (_) => isRotc
            ? const RotcOfficerLoginScreen()
            : const CwtsOfficerLoginScreen(),
      ),
      (route) => false,
    );
  }

  void _navigateTo(BuildContext context, Widget screen) {
    Navigator.pop(context); // Close drawer
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textSecondary,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: AppColors.goldLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: AppColors.primaryMaroon, size: 18),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.textSecondary, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}
