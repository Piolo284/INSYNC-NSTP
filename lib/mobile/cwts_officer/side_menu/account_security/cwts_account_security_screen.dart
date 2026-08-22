import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/login_validators.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';

class CwtsAccountSecurityScreen extends StatelessWidget {
  const CwtsAccountSecurityScreen({super.key});

  /// Real password change against the API (hashed server-side with bcrypt).
  Future<void> _changePassword(BuildContext context) async {
    final currentController = TextEditingController();
    final newController = TextEditingController();

    final result = await showDialog<List<String>>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Change Password',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: currentController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current password'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: newController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'New password',
                helperText: '8+ chars, 1 uppercase, 1 number, 1 symbol',
                helperStyle: TextStyle(fontSize: 11),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, [
              currentController.text,
              newController.text,
            ]),
            child: const Text('Update'),
          ),
        ],
      ),
    );

    currentController.dispose();
    newController.dispose();
    if (result == null || !context.mounted) return;

    if (result[0].isEmpty) {
      AppSnack.error(context, 'Please enter your current password.');
      return;
    }
    if (!LoginValidators.isStrongPassword(result[1])) {
      AppSnack.error(
        context,
        'New password needs 8+ characters, 1 uppercase, 1 number and 1 symbol.',
      );
      return;
    }

    try {
      await AuthService.instance.changePassword(
        currentPassword: result[0],
        newPassword: result[1],
      );
      if (!context.mounted) return;
      AppSnack.success(context, 'Password updated.');
    } catch (error) {
      if (!context.mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  void _notYetAvailable(BuildContext context, String feature) {
    AppSnack.info(context, '$feature is not enabled yet.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Account & Security',
          style: TextStyle(
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
            const SectionHeader(title: 'Account Setting'),
            const SizedBox(height: 10),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _buildMenuItem(
                    icon: Icons.key_outlined,
                    label: 'Change Password',
                    onTap: () => _changePassword(context),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.mail_outline,
                    label: 'Change Email',
                    subtitle: Session.instance.email,
                    available: false,
                    onTap: () => _notYetAvailable(context, 'Changing your email'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.phone_android_outlined,
                    label: 'Change Contact Number',
                    subtitle: Session.instance.user?['contactNumber']?.toString() ?? '',
                    available: false,
                    onTap: () => _notYetAvailable(
                        context, 'Changing your contact number'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const SectionHeader(title: 'Security'),
            const SizedBox(height: 10),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _buildMenuItem(
                    icon: Icons.mail_outline,
                    label: 'Two-Factor Authentication',
                    subtitle: 'Attendance already uses email verification',
                    available: false,
                    onTap: () =>
                        _notYetAvailable(context, 'Two-factor authentication'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.devices_outlined,
                    label: 'Login Devices',
                    available: false,
                    onTap: () => _notYetAvailable(context, 'Device history'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.timer_outlined,
                    label: 'Active Sessions',
                    available: false,
                    onTap: () => _notYetAvailable(context, 'Session history'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.logout_outlined,
                    label: 'Logout All Devices',
                    available: false,
                    onTap: () =>
                        _notYetAvailable(context, 'Logging out all devices'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    String subtitle = '',
    bool available = true,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
      leading: Icon(
        icon,
        color: available ? AppColors.primaryMaroon : AppColors.textSecondary,
        size: 22,
      ),
      title: Text(
        label,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: available ? AppColors.textPrimary : AppColors.textSecondary,
        ),
      ),
      subtitle: subtitle.isEmpty
          ? null
          : Text(
              subtitle,
              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              overflow: TextOverflow.ellipsis,
            ),
      trailing: available
          ? const Icon(Icons.arrow_forward_ios, color: AppColors.textSecondary, size: 14)
          : const StatusBadge('Not available yet', dense: true),
    );
  }

  Widget _buildDivider() {
    return const Divider(height: 1, color: AppColors.border, indent: 16, endIndent: 16);
  }
}
