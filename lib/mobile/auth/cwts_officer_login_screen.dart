import 'package:flutter/material.dart';
import 'package:marsu_nstp_portal/mobile/cwts_officer/cwts_officer_main_shell.dart';
import 'forgot_password_request_screen.dart';
import 'two_factor_verify_screen.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/widgets/async_view.dart';

class CwtsOfficerLoginScreen extends StatefulWidget {
  const CwtsOfficerLoginScreen({super.key});

  @override
  State<CwtsOfficerLoginScreen> createState() => _CwtsOfficerLoginScreenState();
}

class _CwtsOfficerLoginScreenState extends State<CwtsOfficerLoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = false;
  bool _isSubmitting = false;

  String? _validateEmail() {
    final identifier = _emailController.text.trim();
    if (identifier.isEmpty) {
      return 'Please enter your Officer ID or email.';
    }
    return null;
  }

  String? _validatePassword() {
    final password = _passwordController.text.trim();
    if (password.isEmpty) {
      return 'Please enter your password.';
    }
    return null;
  }

  Future<void> _submitLogin() async {
    final emailError = _validateEmail();
    final passwordError = _validatePassword();

    if (emailError != null || passwordError != null) {
      AppSnack.error(context, emailError ?? passwordError ?? 'Invalid login details.');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final identifier = _emailController.text.trim();
      final result = await AuthService.instance.login(
        identifier: identifier,
        password: _passwordController.text,
        expectedRole: 'officer',
      );

      if (!mounted) return;

      if (result['requiresTwoFactor'] == true) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => TwoFactorVerifyScreen(
              identifier: (result['identifier'] ?? identifier).toString(),
              homeScreenBuilder: (_) => const CwtsOfficerMainShell(),
            ),
          ),
        );
        return;
      }

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const CwtsOfficerMainShell()),
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
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.black87, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Image.asset(
                'assets/images/cwts_logo.png',
                width: 96,
                height: 96,
                errorBuilder: (_, _, _) => Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: AppColors.primaryMaroon.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.school,
                    color: AppColors.primaryMaroon,
                    size: 48,
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Welcome Officer!',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'CWTS Portal Login',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 28),
              const _FieldLabel('Officer ID'),
              const SizedBox(height: 6),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  hintText: 'Enter your Officer ID',
                  prefixIcon: Icon(Icons.person_outline, color: AppColors.primaryMaroon, size: 20),
                ),
              ),
              const SizedBox(height: 18),
              const _FieldLabel('Password'),
              const SizedBox(height: 6),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                textInputAction: TextInputAction.done,
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _isSubmitting ? null : _submitLogin(),
                decoration: InputDecoration(
                  hintText: 'Enter your Password',
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
              const SizedBox(height: 10),
              Row(
                children: [
                  SizedBox(
                    height: 22,
                    width: 22,
                    child: Checkbox(
                      value: _rememberMe,
                      onChanged: (value) => setState(() => _rememberMe = value ?? false),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Remember Me',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ForgotPasswordRequestScreen(
                            loginScreenBuilder: (_) => const CwtsOfficerLoginScreen(),
                          ),
                        ),
                      );
                    },
                    child: const Text(
                      'Forgot Password?',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primaryMaroon,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitLogin,
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
                          'LOGIN',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1),
                        ),
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  const Expanded(child: Divider(color: AppColors.border)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Container(
                      width: 26,
                      height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Text(
                        'or',
                        style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ),
                  ),
                  const Expanded(child: Divider(color: AppColors.border)),
                ],
              ),
              const SizedBox(height: 22),
              const Center(
                child: Text.rich(
                  TextSpan(
                    text: 'Need help? ',
                    style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                    children: [
                      TextSpan(
                        text: 'Contact your administrator.',
                        style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.primaryMaroon),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
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
        style: const TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }
}
