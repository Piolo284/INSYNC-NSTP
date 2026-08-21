import 'package:flutter/material.dart';
import 'side_menu/profile/cwts_personal_info_screen.dart';
import 'side_menu/account_security/cwts_account_security_screen.dart';
import 'side_menu/notifications/cwts_notification_settings_screen.dart';
import 'side_menu/documents/cwts_documents_screen.dart';
import 'side_menu/about/cwts_about_screen.dart';
import 'side_menu/help_support/cwts_help_support_screen.dart';
import '../auth/cwts_login_screen.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/widgets/user_avatar.dart';

class CwtsDrawer extends StatelessWidget {
  const CwtsDrawer({super.key});

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
                  UserAvatar(
                    imagePath: session.profileImage,
                    radius: 45,
                    iconColor: Colors.grey,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    session.idNumber.isEmpty ? '—' : session.idNumber,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    session.name.isEmpty ? 'Trainee' : session.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      session.yearLevel.isEmpty ? null : session.yearLevel,
                      session.program,
                    ].whereType<String>().join(' | '),
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
                    icon: Icons.person_outline,
                    label: 'Personal Information',
                    onTap: () => _navigateTo(context, const CwtsPersonalInfoScreen()),
                  ),
                  _buildMenuItem(
                    icon: Icons.description_outlined,
                    label: 'Documents',
                    onTap: () => _navigateTo(context, const CwtsDocumentsScreen()),
                  ),
                  _buildMenuItem(
                    icon: Icons.lock_outline,
                    label: 'Account & Security',
                    onTap: () => _navigateTo(context, const CwtsAccountSecurityScreen()),
                  ),
                  _buildMenuItem(
                    icon: Icons.mail_outline,
                    label: 'Notification Setting',
                    onTap: () => _navigateTo(context, const CwtsNotificationSettingsScreen()),
                  ),
                  _buildMenuItem(
                    icon: Icons.help_outline,
                    label: 'Help & Support',
                    onTap: () => _navigateTo(context, const CwtsHelpSupportScreen()),
                  ),
                  _buildMenuItem(
                    icon: Icons.info_outline,
                    label: 'About CWTS Portal',
                    onTap: () => _navigateTo(context, const CwtsAboutScreen()),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: GestureDetector(
                onTap: () async {
                  // Clears the JWT + cached user so the next launch does not
                  // restore this session.
                  await AuthService.instance.logout();
                  if (!context.mounted) return;
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const CwtsLoginScreen(),
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
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.logout,
                        color: AppColors.primaryMaroon,
                        size: 18,
                      ),
                      const SizedBox(width: 8),
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
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => screen),
    );
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