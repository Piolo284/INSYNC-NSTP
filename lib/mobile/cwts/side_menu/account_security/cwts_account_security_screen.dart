import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'manage_sessions_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/contact_number.dart';
import '../../../../core/utils/login_validators.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../main.dart' show SplashRouter;

class CwtsAccountSecurityScreen extends StatefulWidget {
  const CwtsAccountSecurityScreen({super.key});

  @override
  State<CwtsAccountSecurityScreen> createState() => _CwtsAccountSecurityScreenState();
}

class _CwtsAccountSecurityScreenState extends State<CwtsAccountSecurityScreen> {
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

    String message;
    try {
      message = await AuthService.instance.requestPasswordChange(
        currentPassword: result[0],
        newPassword: result[1],
      );
    } catch (error) {
      if (!context.mounted) return;
      AppSnack.error(context, describeError(error));
      return;
    }
    if (!context.mounted) return;
    AppSnack.info(context, message);

    final confirmed = await _enterEmailedCode(
      context,
      confirm: AuthService.instance.confirmPasswordChange,
    );
    if (!confirmed || !context.mounted) return;
    AppSnack.success(context, 'Password updated.');
  }

  /// Prompts for a single text value inside a standard AlertDialog shell —
  /// shared by the "new email"/"new contact number"/"6-digit code" prompts
  /// below so the styling isn't reinvented four times.
  Future<String?> _promptForValue(
    BuildContext context, {
    required String title,
    required String label,
    String? helperText,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    String? Function(String value)? validator,
    String confirmLabel = 'Continue',
  }) async {
    final controller = TextEditingController();
    String? errorText;
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          content: TextField(
            controller: controller,
            keyboardType: keyboardType,
            inputFormatters: inputFormatters,
            autofocus: true,
            onChanged: (_) {
              if (errorText != null) setDialogState(() => errorText = null);
            },
            decoration: InputDecoration(
              labelText: label,
              helperText: helperText,
              helperStyle: const TextStyle(fontSize: 11),
              errorText: errorText,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () {
                final error = validator?.call(controller.text.trim());
                if (error != null) {
                  setDialogState(() => errorText = error);
                  return;
                }
                Navigator.pop(dialogContext, controller.text);
              },
              child: Text(confirmLabel),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    return result;
  }

  /// Asks for the code that was emailed and confirms it via [confirm]. A
  /// mistyped code can be re-entered (the server allows a few attempts,
  /// then voids the code and the user has to request a new one). The code
  /// itself never comes from the server response — only from the email.
  Future<bool> _enterEmailedCode(
    BuildContext context, {
    required Future<void> Function(String code) confirm,
    String helperText = 'Check your registered email for the 6-digit code.',
  }) async {
    while (true) {
      if (!context.mounted) return false;
      final code = await _promptForValue(
        context,
        title: 'Enter Code',
        label: '6-digit code',
        helperText: helperText,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(6),
        ],
        validator: (v) => v.length == 6 ? null : 'Enter all 6 digits of the code.',
        confirmLabel: 'Confirm',
      );
      if (code == null || code.trim().isEmpty || !context.mounted) return false;

      try {
        await confirm(code.trim());
        return true;
      } catch (error) {
        if (!context.mounted) return false;
        final message = describeError(error);
        AppSnack.error(context, message);
        // Only a wrong guess can be retried; an expired/voided code needs a new request.
        if (!message.startsWith('Incorrect code')) return false;
      }
    }
  }

  Future<void> _changeEmail(BuildContext context) async {
    final newEmail = await _promptForValue(
      context,
      title: 'Change Email',
      label: 'New email address',
      keyboardType: TextInputType.emailAddress,
      confirmLabel: 'Send Code',
    );
    if (newEmail == null || newEmail.trim().isEmpty || !context.mounted) return;

    String message;
    try {
      message = await AuthService.instance.requestEmailChange(newEmail.trim());
    } catch (error) {
      if (!context.mounted) return;
      AppSnack.error(context, describeError(error));
      return;
    }
    if (!context.mounted) return;
    AppSnack.info(context, message);

    final confirmed = await _enterEmailedCode(
      context,
      confirm: AuthService.instance.confirmEmailChange,
      helperText: 'Sent to your NEW email address.',
    );
    if (!confirmed || !context.mounted) return;
    setState(() {}); // re-read Session.instance.email into the subtitle
    AppSnack.success(context, 'Your email address has been updated.');
  }

  Future<void> _changeContactNumber(BuildContext context) async {
    final newNumber = await _promptForValue(
      context,
      title: 'Change Contact Number',
      label: 'New contact number',
      helperText: 'Numbers only, up to 11 digits (e.g. 09123456789)',
      keyboardType: TextInputType.number,
      inputFormatters: contactNumberInputFormatters,
      validator: (v) => validateContactNumber(v, required: true),
      confirmLabel: 'Send Code',
    );
    if (newNumber == null || newNumber.trim().isEmpty || !context.mounted) return;

    String message;
    try {
      message = await AuthService.instance.requestContactNumberChange(newNumber.trim());
    } catch (error) {
      if (!context.mounted) return;
      AppSnack.error(context, describeError(error));
      return;
    }
    if (!context.mounted) return;
    AppSnack.info(context, message);

    final confirmed = await _enterEmailedCode(
      context,
      confirm: AuthService.instance.confirmContactNumberChange,
      helperText: 'Sent to your registered email — there is no SMS verification yet.',
    );
    if (!confirmed || !context.mounted) return;
    setState(() {});
    AppSnack.success(context, 'Your contact number has been updated.');
  }

  Future<void> _toggleTwoFactor(BuildContext context) async {
    final isEnabled = Session.instance.user?['twoFactorEnabled'] == true;
    final action = isEnabled ? 'Turn Off' : 'Turn On';

    final passwordController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          '$action Two-Factor Authentication?',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isEnabled
                  ? 'Logging in will only need your password once this is off.'
                  : "You'll need to enter a code emailed to you every time you log in.",
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: passwordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirm your password'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(action),
          ),
        ],
      ),
    );
    final password = passwordController.text;
    passwordController.dispose();
    if (confirmed != true || !context.mounted) return;

    if (password.isEmpty) {
      AppSnack.error(context, 'Please enter your password.');
      return;
    }

    try {
      await AuthService.instance.setTwoFactorEnabled(enable: !isEnabled, currentPassword: password);
      if (!context.mounted) return;
      setState(() {});
      AppSnack.success(context, !isEnabled ? 'Two-factor authentication is now on.' : 'Two-factor authentication is now off.');
    } catch (error) {
      if (!context.mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  void _openSessions(BuildContext context) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => const ManageSessionsScreen()));
  }

  Future<void> _logoutAllDevices(BuildContext context) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Logout All Devices?',
      message: 'Every device signed into this account — including this one — will be logged out immediately.',
      confirmLabel: 'Logout All',
    );
    if (!confirmed || !context.mounted) return;

    try {
      await AuthService.instance.revokeAllSessions();
      await AuthService.instance.logout();
      if (!context.mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const SplashRouter()),
        (route) => false,
      );
    } catch (error) {
      if (!context.mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTwoFactorEnabled = Session.instance.user?['twoFactorEnabled'] == true;

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
                    onTap: () => _changeEmail(context),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.phone_android_outlined,
                    label: 'Change Contact Number',
                    subtitle: Session.instance.user?['contactNumber']?.toString() ?? '',
                    onTap: () => _changeContactNumber(context),
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
                    subtitle: isTwoFactorEnabled ? 'On — a code is emailed at every login' : 'Off',
                    onTap: () => _toggleTwoFactor(context),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.devices_outlined,
                    label: 'Login Devices',
                    onTap: () => _openSessions(context),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.timer_outlined,
                    label: 'Active Sessions',
                    onTap: () => _openSessions(context),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.logout_outlined,
                    label: 'Logout All Devices',
                    onTap: () => _logoutAllDevices(context),
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
