import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/widgets/async_view.dart';

/// Second step of a two-factor login — entered right after [AuthService.login]
/// comes back with `requiresTwoFactor: true`. [homeScreenBuilder] builds
/// whichever shell this account's role lands on once verified.
class TwoFactorVerifyScreen extends StatefulWidget {
  const TwoFactorVerifyScreen({
    super.key,
    required this.identifier,
    required this.homeScreenBuilder,
  });

  final String identifier;
  final WidgetBuilder homeScreenBuilder;

  @override
  State<TwoFactorVerifyScreen> createState() => _TwoFactorVerifyScreenState();
}

class _TwoFactorVerifyScreenState extends State<TwoFactorVerifyScreen> {
  final TextEditingController _codeController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      AppSnack.error(context, 'Please enter the code sent to your email.');
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await AuthService.instance.verifyTwoFactor(identifier: widget.identifier, code: code);
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: widget.homeScreenBuilder),
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
          'Two-Factor Verification',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(28, 16, 28, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.shield_outlined, color: AppColors.primaryMaroon, size: 56),
              const SizedBox(height: 16),
              const Text(
                'Enter your code',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              Text(
                'Two-factor authentication is on for this account. We emailed a 6-digit code to ${widget.identifier}.',
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 26),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _isSubmitting ? null : _submit(),
                decoration: const InputDecoration(
                  hintText: '6-digit code',
                  prefixIcon: Icon(Icons.pin_outlined, color: AppColors.primaryMaroon, size: 20),
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
                          'VERIFY',
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
