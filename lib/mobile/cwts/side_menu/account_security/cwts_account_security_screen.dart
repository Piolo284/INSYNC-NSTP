import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/login_validators.dart';
import '../../../../core/widgets/async_view.dart';

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
              decoration: InputDecoration(
                labelText: 'Current password',
                labelStyle: const TextStyle(fontSize: 13),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: newController,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'New password',
                labelStyle: const TextStyle(fontSize: 13),
                helperText: '8+ chars, 1 uppercase, 1 number, 1 symbol',
                helperStyle: const TextStyle(fontSize: 11),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text('Cancel', style: TextStyle(color: Colors.grey.shade700)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, [
              currentController.text,
              newController.text,
            ]),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryMaroon,
              foregroundColor: Colors.white,
              elevation: 0,
            ),
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
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Account & Security',
          style: TextStyle(
            color: Colors.white,
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
            // Account Setting
            const Text(
              'Account Setting',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
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
                    onTap: () => _notYetAvailable(context, 'Changing your email'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.phone_android_outlined,
                    label: 'Change Contact Number',
                    subtitle: Session.instance.user?['contactNumber']
                            ?.toString() ??
                        '',
                    onTap: () => _notYetAvailable(
                        context, 'Changing your contact number'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // Security
            const Text(
              'Security',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  _buildMenuItem(
                    icon: Icons.mail_outline,
                    label: 'Two-Factor Authentication',
                    subtitle: 'Attendance already uses email verification',
                    onTap: () =>
                        _notYetAvailable(context, 'Two-factor authentication'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.devices_outlined,
                    label: 'Login Devices',
                    onTap: () => _notYetAvailable(context, 'Device history'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.timer_outlined,
                    label: 'Active Sessions',
                    onTap: () => _notYetAvailable(context, 'Session history'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.logout_outlined,
                    label: 'Logout All Devices',
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
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
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
      subtitle: subtitle.isEmpty
          ? null
          : Text(
              subtitle,
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              overflow: TextOverflow.ellipsis,
            ),
      trailing: Icon(
        Icons.arrow_forward_ios,
        color: Colors.grey.shade400,
        size: 14,
      ),
    );
  }

  Widget _buildDivider() {
    return Divider(
      height: 1,
      color: Colors.grey.shade200,
      indent: 16,
      endIndent: 16,
    );
  }
}