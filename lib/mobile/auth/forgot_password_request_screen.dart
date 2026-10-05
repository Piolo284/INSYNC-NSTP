import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/widgets/async_view.dart';
import 'reset_password_screen.dart';

/// Step 1 of the forgot-password flow: the trainee tells us who they are and
/// why they're locked out. This never resets anything by itself — a
/// system_maintenance_admin reviews it in the admin panel and, once they've
/// verified the trainee's identity, approves it — which is what actually
/// emails a reset code (see [ResetPasswordScreen]).
class ForgotPasswordRequestScreen extends StatefulWidget {
  const ForgotPasswordRequestScreen({super.key, required this.loginScreenBuilder});

  final WidgetBuilder loginScreenBuilder;

  @override
  State<ForgotPasswordRequestScreen> createState() => _ForgotPasswordRequestScreenState();
}

class _ForgotPasswordRequestScreenState extends State<ForgotPasswordRequestScreen> {
  final TextEditingController _identifierController = TextEditingController();
  final TextEditingController _reasonController = TextEditingController();

  bool _isSubmitting = false;
  bool _submitted = false;
  String _resultMessage = '';

  @override
  void dispose() {
    _identifierController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final identifier = _identifierController.text.trim();
    final reason = _reasonController.text.trim();

    if (identifier.isEmpty) {
      AppSnack.error(context, 'Please enter your Student/Cadet ID or email.');
      return;
    }
    if (reason.isEmpty) {
      AppSnack.error(context, 'Please briefly tell us why you need a reset.');
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final response = await AuthService.instance.forgotPassword(
        identifier: identifier,
        reason: reason,
      );
      if (!mounted) return;
      setState(() {
        _submitted = true;
        _resultMessage = (response['message'] as String?) ??
            'Your request has been submitted. A system administrator will review it.';
      });
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _goToEnterCode() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ResetPasswordScreen(
          loginScreenBuilder: widget.loginScreenBuilder,
          initialIdentifier: _identifierController.text.trim(),
        ),
      ),
    );
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
          'Forgot Password',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(28, 16, 28, 32),
          child: _submitted ? _buildSubmittedView() : _buildFormView(),
        ),
      ),
    );
  }

  Widget _buildFormView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.lock_reset, color: AppColors.primaryMaroon, size: 56),
        const SizedBox(height: 16),
        const Text(
          'Reset your password',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 6),
        const Text(
          'A system administrator manually verifies every request before a reset code is issued — this keeps your account safe even if someone else knows your email.',
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
        const _FieldLabel('Why do you need a reset?'),
        const SizedBox(height: 6),
        TextField(
          controller: _reasonController,
          maxLines: 3,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(
            hintText: 'e.g. I forgot my password after reinstalling the app.',
            alignLabelWithHint: true,
            prefixIcon: Padding(
              padding: EdgeInsets.only(bottom: 40),
              child: Icon(Icons.edit_note_outlined, color: AppColors.primaryMaroon, size: 20),
            ),
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
                    'SUBMIT REQUEST',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
          ),
        ),
        const SizedBox(height: 18),
        Center(
          child: GestureDetector(
            onTap: _goToEnterCode,
            child: const Text(
              'Already have a reset code?',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.primaryMaroon),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSubmittedView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        const Icon(Icons.check_circle_outline, color: AppColors.success, size: 56),
        const SizedBox(height: 16),
        const Text(
          'Request submitted',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.greenLight,
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
          ),
          child: Text(
            _resultMessage,
            style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, height: 1.5),
          ),
        ),
        const SizedBox(height: 26),
        SizedBox(
          height: 50,
          child: ElevatedButton(
            onPressed: _goToEnterCode,
            child: const Text(
              'I HAVE MY RESET CODE',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1),
            ),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 50,
          child: OutlinedButton(
            onPressed: () => Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(builder: widget.loginScreenBuilder),
              (route) => false,
            ),
            child: const Text('BACK TO LOGIN', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1)),
          ),
        ),
      ],
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
