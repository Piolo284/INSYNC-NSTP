import 'package:flutter/material.dart';
import 'cwts_login_screen.dart';
import 'rotc_login_screen.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/utils/login_validators.dart';
import '../../core/widgets/async_view.dart';

class RegisterScreen extends StatefulWidget {
  final String portalType; // 'cwts' or 'rotc'

  const RegisterScreen({
    super.key,
    required this.portalType,
  });

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController _studentIdController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  String? _selectedProgram;
  String? _selectedYear;
  bool _isSubmitting = false;
  bool _obscurePassword = true;

  final List<String> programs = [
    'BS Information Technology',
    'BS Computer Science',
    'BS Criminology',
    'BS Education',
    'BS Business Administration',
    'BS Nursing',
  ];

  final List<String> years = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
  ];

  /// The NSTP component this registration belongs to (not the degree program).
  String get _nstpProgram => widget.portalType == 'rotc' ? 'ROTC' : 'CWTS';

  @override
  void dispose() {
    _studentIdController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _goToLogin() {
    if (widget.portalType == 'rotc') {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const RotcLoginScreen()),
      );
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const CwtsLoginScreen()),
      );
    }
  }

  String? _validate() {
    if (_studentIdController.text.trim().isEmpty) {
      return 'Please enter your Student ID.';
    }
    if (_nameController.text.trim().isEmpty) {
      return 'Please enter your name.';
    }
    if (!LoginValidators.isValidEmail(_emailController.text)) {
      return 'Please enter a valid email address.';
    }
    if (!LoginValidators.isStrongPassword(_passwordController.text)) {
      return 'Password must have at least 8 characters, 1 uppercase, 1 number, and 1 special character.';
    }
    if (_selectedProgram == null) {
      return 'Please select your program.';
    }
    if (_selectedYear == null) {
      return 'Please select your year.';
    }
    return null;
  }

  Future<void> _submitRegister() async {
    final error = _validate();
    if (error != null) {
      AppSnack.error(context, error);
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await AuthService.instance.register(
        name: _nameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text,
        studentId: _studentIdController.text.trim(),
        program: _nstpProgram,
        course: _selectedProgram ?? '',
        yearLevel: _selectedYear ?? '',
      );

      if (!mounted) return;

      // Registration signs the account in; send them back to the portal login
      // so the flow matches what the screen already promised ("NEXT" → Login).
      await AuthService.instance.logout();
      if (!mounted) return;

      AppSnack.success(context, 'Account created. You can now log in.');
      _goToLogin();
    } catch (err) {
      if (!mounted) return;
      AppSnack.error(context, describeError(err));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios,
            color: Colors.black87,
            size: 20,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Back',
          style: TextStyle(
            color: Colors.black87,
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              Image.asset(
                'assets/images/marsu_logo.png',
                width: 90,
                height: 90,
                errorBuilder: (_, __, ___) => Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: AppColors.primaryMaroon.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.school,
                    color: AppColors.primaryMaroon,
                    size: 45,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Create an Account',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Fill in the details below to get started',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade500,
                ),
              ),
              const SizedBox(height: 32),
              _buildLabel('Student ID'),
              const SizedBox(height: 6),
              _buildTextField(
                controller: _studentIdController,
                hint: 'Enter your Student ID',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 16),
              _buildLabel('Name'),
              const SizedBox(height: 6),
              _buildTextField(
                controller: _nameController,
                hint: 'Enter your name',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 16),
              _buildLabel('Email'),
              const SizedBox(height: 6),
              _buildTextField(
                controller: _emailController,
                hint: 'Enter your email address',
                icon: Icons.mail_outline,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 16),
              _buildLabel('Password'),
              const SizedBox(height: 6),
              _buildTextField(
                controller: _passwordController,
                hint: 'Create your password',
                icon: Icons.lock_outline,
                obscure: _obscurePassword,
                suffix: IconButton(
                  icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: AppColors.primaryMaroon,
                    size: 20,
                  ),
                  onPressed: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
              const SizedBox(height: 16),
              _buildLabel('Program'),
              const SizedBox(height: 6),
              _buildDropdown(
                hint: 'Select your program',
                value: _selectedProgram,
                items: programs,
                onChanged: (value) {
                  setState(() => _selectedProgram = value);
                },
              ),
              const SizedBox(height: 16),
              _buildLabel('Year/Section'),
              const SizedBox(height: 6),
              _buildDropdown(
                hint: 'Select your year',
                value: _selectedYear,
                items: years,
                onChanged: (value) {
                  setState(() => _selectedYear = value);
                },
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitRegister,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor:
                        AppColors.primaryMaroon.withValues(alpha: 0.6),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'NEXT',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Already have an account? ',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  GestureDetector(
                    onTap: _goToLogin,
                    child: const Text(
                      'Login',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primaryMaroon,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        text,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Colors.grey.shade800,
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
    bool obscure = false,
    Widget? suffix,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscure,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          fontSize: 13,
          color: Colors.grey.shade400,
        ),
        prefixIcon: Icon(
          icon,
          color: AppColors.primaryMaroon,
          size: 20,
        ),
        suffixIcon: suffix,
        filled: true,
        fillColor: Colors.grey.shade50,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primaryMaroon),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 14,
        ),
      ),
    );
  }

  Widget _buildDropdown({
    required String hint,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          hint: Text(
            hint,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey.shade400,
            ),
          ),
          isExpanded: true,
          icon: Icon(
            Icons.keyboard_arrow_down,
            color: Colors.grey.shade700,
            size: 22,
          ),
          dropdownColor: Colors.white,
          items: items.map((String item) {
            return DropdownMenuItem<String>(
              value: item,
              child: Text(
                item,
                style: const TextStyle(
                  fontSize: 13,
                  color: Colors.black87,
                ),
              ),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
