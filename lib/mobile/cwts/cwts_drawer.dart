import 'package:flutter/material.dart';
import 'side_menu/profile/cwts_personal_info_screen.dart';
import 'side_menu/account_security/cwts_account_security_screen.dart';
import 'side_menu/notifications/cwts_notification_settings_screen.dart';
import 'side_menu/documents/cwts_documents_screen.dart';
import 'side_menu/certificate/cwts_certificate_screen.dart';
import 'side_menu/about/cwts_about_screen.dart';
import 'side_menu/help_support/cwts_help_support_screen.dart';
import '../auth/cwts_login_screen.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/widgets/app_dialogs.dart';
import '../../core/widgets/profile_header.dart';

class CwtsDrawer extends StatelessWidget {
  const CwtsDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final session = Session.instance;
    final subtitle = [
      session.idNumber.isEmpty ? null : session.idNumber,
      [
        session.yearLevel.isEmpty ? null : session.yearLevel,
        session.program,
      ].whereType<String>().join(' · '),
    ].whereType<String>().where((s) => s.isNotEmpty).join('  |  ');

    return Drawer(
      backgroundColor: AppColors.white,
      child: SafeArea(
        child: Column(
          children: [
            ProfileHeader(
              name: session.name.isEmpty ? 'Trainee' : session.name,
              subtitle: subtitle.isEmpty ? 'CWTS Trainee' : subtitle,
              imagePath: session.profileImage,
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                children: [
                  _SectionLabel('MY ACCOUNT'),
                  _MenuItem(
                    icon: Icons.person_outline,
                    label: 'Personal Information',
                    onTap: () => _navigateTo(context, const CwtsPersonalInfoScreen()),
                  ),
                  _MenuItem(
                    icon: Icons.description_outlined,
                    label: 'Documents',
                    onTap: () => _navigateTo(context, const CwtsDocumentsScreen()),
                  ),
                  _MenuItem(
                    icon: Icons.workspace_premium_outlined,
                    label: 'Certificate Request',
                    onTap: () => _navigateTo(context, const CwtsCertificateScreen()),
                  ),
                  _MenuItem(
                    icon: Icons.lock_outline,
                    label: 'Account & Security',
                    onTap: () => _navigateTo(context, const CwtsAccountSecurityScreen()),
                  ),
                  _MenuItem(
                    icon: Icons.mail_outline,
                    label: 'Notification Setting',
                    onTap: () => _navigateTo(context, const CwtsNotificationSettingsScreen()),
                  ),
                  const SizedBox(height: 8),
                  _SectionLabel('SUPPORT'),
                  _MenuItem(
                    icon: Icons.help_outline,
                    label: 'Help & Support',
                    onTap: () => _navigateTo(context, const CwtsHelpSupportScreen()),
                  ),
                  _MenuItem(
                    icon: Icons.info_outline,
                    label: 'About CWTS Portal',
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
      message: 'You will need to sign in again to access your CWTS portal.',
      confirmLabel: 'Logout',
    );
    if (!confirmed) return;

    // Clears the JWT + cached user so the next launch does not restore
    // this session.
    await AuthService.instance.logout();
    if (!context.mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const CwtsLoginScreen()),
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
