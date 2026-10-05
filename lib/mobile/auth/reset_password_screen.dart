import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/widgets/async_view.dart';

/// Final step of the forgot-password flow: the trainee enters the code a
/// system_maintenance_admin's approval emailed them, plus a new password.
/// [loginScreenBuilder] builds whichever of the four login screens (CWTS/
/// ROTC, trainee/officer) started this flow, so a successful reset can
/// return the trainee to the right one.
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({
    super.key,
    required this.loginScreenBuilder,
    this.initialIdentifier = '',
  });

  final WidgetBuilder loginScreenBuilder;
  final String initialIdentifier;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  late final TextEditingController _identifierController =
      TextEditingController(text: widget.initialIdentifier);
  final TextEditingController _codeController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmController = TextEditingController();

  bool _obscurePassword = true;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _identifierController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final identifier = _identifierController.text.trim();
    final code = _codeController.text.trim();
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    if (identifier.isEmpty) {
      AppSnack.error(context, 'Please enter your Student ID or email.');
      return;
    }
    if (code.isEmpty) {
      AppSnack.error(context, 'Please enter the reset code from your email.');
      return;
    }
    if (password.length < 8) {
      AppSnack.error(context, 'New password must be at least 8 characters long.');
      return;
    }
    if (password != confirm) {
      AppSnack.error(context, 'Passwords do not match.');
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final response = await AuthService.instance.resetPassword(
        identifier: identifier,
        resetCode: code,
        newPassword: password,
      );

      if (!mounted) return;
      AppSnack.success(
        context,
        (response['message'] as String?) ?? 'Password reset. You can now log in.',
      );
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: widget.loginScreenBuilder),
        (route) => false,
      );
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        title: const Text(
          'Enter Reset Code',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(28, 16, 28, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.mark_email_read_outlined, color: AppColors.primaryMaroon, size: 56),
              const SizedBox(height: 16),
              const Text(
                'Check your email',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              const Text(
                'Once your request is approved, a 6-digit reset code is emailed to your registered address. Enter it below with your new password.',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 26),
              const _FieldLabel('Student ID / Email'),
              const SizedBox(height: 6),
              TextField(
                controller: _identifierController,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  hintText: 'Enter your Student ID / Email',
                  prefixIcon: Icon(Icons.person_outline, color: AppColors.primaryMaroon, size: 20),
                ),
              ),
              const SizedBox(height: 18),
              const _FieldLabel('Reset Code'),
              const SizedBox(height: 6),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  hintText: '6-digit code from your email',
                  prefixIcon: Icon(Icons.pin_outlined, color: AppColors.primaryMaroon, size: 20),
                ),
              ),
              const SizedBox(height: 18),
              const _FieldLabel('New Password'),
              const SizedBox(height: 6),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  hintText: 'At least 8 characters',
                  prefixIcon: const Icon(Icons.lock_outline, color: AppColors.primaryMaroon, size: 20),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: AppColors.primaryMaroon,
                      size: 20,
                    ),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const _FieldLabel('Confirm New Password'),
              const SizedBox(height: 6),
              TextField(
                controller: _confirmController,
                obscureText: _obscurePassword,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _isSubmitting ? null : _submit(),
                decoration: const InputDecoration(
                  hintText: 'Re-enter your new password',
                  prefixIcon: Icon(Icons.lock_outline, color: AppColors.primaryMaroon, size: 20),
                ),
              ),
              const SizedBox(height: 26),
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(AppColors.white),
                          ),
                        )
                      : const Text(
                          'RESET PASSWORD',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        text,
        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
      ),
    );
  }
}
