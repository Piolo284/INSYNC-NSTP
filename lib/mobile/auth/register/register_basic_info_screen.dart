import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/login_validators.dart';
import '../../../core/utils/password_strength.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/password_strength_indicator.dart';
import 'register_additional_info_screen.dart';
import 'register_draft.dart';
import 'register_program_banner.dart';

/// Step 1 of 3 — the account's basic details. Collects everything the old
/// single-page registration form used to, then hands a [RegisterDraft] on to
/// [RegisterAdditionalInfoScreen] instead of submitting immediately.
class RegisterBasicInfoScreen extends StatefulWidget {
  final String portalType; // 'cwts' or 'rotc'

  const RegisterBasicInfoScreen({super.key, required this.portalType});

  @override
  State<RegisterBasicInfoScreen> createState() =>
      _RegisterBasicInfoScreenState();
}

class _RegisterBasicInfoScreenState extends State<RegisterBasicInfoScreen> {
  final TextEditingController _studentIdController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  // Drives the small helper hint shown under a field while it's focused
  // (tapped into) — see _buildTextField's `tooltip` param.
  final FocusNode _studentIdFocus = FocusNode();
  final FocusNode _nameFocus = FocusNode();
  final FocusNode _emailFocus = FocusNode();
  final FocusNode _passwordFocus = FocusNode();

  String? _selectedProgram;
  String? _selectedYear;
  String? _selectedCampus;
  bool _obscurePassword = true;

  /// The campus that will actually be submitted — a fixed campus from the
  /// selected college (see _programCampuses) takes priority over whatever
  /// the trainee picked manually, mirroring authController.register.
  String? get _effectiveCampus => _fixedCampusForSelectedProgram ?? _selectedCampus;

  /// Torrijos and Gasan don't offer ROTC — only CWTS is available there.
  bool get _isRestrictedRotcCampus =>
      widget.portalType == 'rotc' &&
      _effectiveCampus != null &&
      kRotcRestrictedCampuses.contains(_effectiveCampus);

  LoadState _programsState = LoadState.loading;
  String _programsError = '';
  List<String> _programs = const [];
  // Program name -> its fixed campus (null if that program lets the trainee
  // pick their own campus) — keyed off the same GET /api/programs response
  // that fills _programs, so a college with a fixed campus (see
  // models/Program.js) auto-fills and locks the Campus field below instead
  // of asking the trainee to pick one.
  Map<String, String?> _programCampuses = const {};
  bool _isVerifying = false;

  String? get _fixedCampusForSelectedProgram =>
      _selectedProgram == null ? null : _programCampuses[_selectedProgram];

  final List<String> years = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
  ];

  @override
  void initState() {
    super.initState();
    _loadPrograms();
    // Each hint only needs a rebuild on focus change, not on every keystroke.
    for (final node in [_studentIdFocus, _nameFocus, _emailFocus, _passwordFocus]) {
      node.addListener(_onFocusChange);
    }
    // The strength meter needs to react to every keystroke, and to edits on
    // the other fields too (name/ID/email feed the similarity check).
    _passwordController.addListener(_onFieldsChanged);
    _studentIdController.addListener(_onFieldsChanged);
    _nameController.addListener(_onFieldsChanged);
    _emailController.addListener(_onFieldsChanged);
  }

  void _onFocusChange() => setState(() {});
  void _onFieldsChanged() => setState(() {});

  /// Recomputed on every relevant keystroke rather than cached — evaluating
  /// a password string is cheap, and caching would just be another place for
  /// the meter to go stale.
  PasswordStrengthResult get _passwordStrength => evaluatePasswordStrength(
        _passwordController.text,
        personalInfo: [
          _studentIdController.text,
          _nameController.text,
          _emailController.text,
        ],
      );

  @override
  void dispose() {
    _studentIdController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _studentIdFocus.dispose();
    _nameFocus.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  /// Fetched instead of hardcoded so a program an admin adds later shows up
  /// here with no app update — see backend GET /api/programs.
  Future<void> _loadPrograms() async {
    setState(() {
      _programsState = LoadState.loading;
      _programsError = '';
    });
    try {
      final nstpProgram = widget.portalType.toUpperCase();
      final items = await ProgramService.instance.list(nstpProgram: nstpProgram, status: 'Active');
      if (!mounted) return;
      final names = items.map((p) => p['name']?.toString() ?? '').where((n) => n.isNotEmpty).toList();
      final campuses = <String, String?>{
        for (final p in items)
          if ((p['name']?.toString() ?? '').isNotEmpty)
            p['name'].toString(): (p['campus']?.toString().isNotEmpty ?? false) ? p['campus'].toString() : null,
      };
      setState(() {
        _programs = names;
        _programCampuses = campuses;
        _programsState = names.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _programsState = LoadState.error;
        _programsError = describeError(error);
      });
    }
  }

  String? _validate() {
    if (_studentIdController.text.trim().isEmpty) {
      return 'Please enter your Student ID.';
    }
    if (_nameController.text.trim().isEmpty) {
      return 'Please enter your name.';
    }
    if (!LoginValidators.isMarsuEmail(_emailController.text)) {
      return 'Please use your official MARSU email address (e.g. juandelacruz@marsu.edu.ph).';
    }
    if (!_passwordStrength.isAcceptable) {
      return 'Please create a stronger password before continuing.';
    }
    if (_selectedProgram == null) {
      return 'Please select your course/program.';
    }
    if (_selectedYear == null) {
      return 'Please select your year.';
    }
    if (_effectiveCampus == null) {
      return 'Please select your campus.';
    }
    if (_isRestrictedRotcCampus) {
      return 'ROTC is not offered at $_effectiveCampus. Only CWTS is available at this campus.';
    }
    return null;
  }

  Future<void> _goNext() async {
    final error = _validate();
    if (error != null) {
      AppSnack.error(context, error);
      return;
    }

    // Verify against the NSTP masterlist before letting the trainee move on
    // — a mismatch is caught right here instead of only surfacing after
    // they've filled in every later step.
    setState(() => _isVerifying = true);
    try {
      await AuthService.instance.validateEnrollment(
        studentId: _studentIdController.text.trim(),
        name: _nameController.text.trim(),
        course: _selectedProgram ?? '',
        program: widget.portalType.toUpperCase(),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _isVerifying = false);
      AppSnack.error(context, describeError(error));
      return;
    }
    if (!mounted) return;
    setState(() => _isVerifying = false);

    final draft = RegisterDraft(portalType: widget.portalType)
      ..studentId = _studentIdController.text.trim()
      ..name = _nameController.text.trim()
      ..email = _emailController.text.trim()
      ..password = _passwordController.text
      ..course = _selectedProgram ?? ''
      ..yearLevel = _selectedYear ?? ''
      ..campus = _effectiveCampus ?? '';

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RegisterAdditionalInfoScreen(draft: draft),
      ),
    );
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
                'Step 1 of 3 — fill in your basic details',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade500,
                ),
              ),
              RegisterProgramBanner(nstpProgram: widget.portalType.toUpperCase()),
              _buildLabel('Student ID'),
              const SizedBox(height: 6),
              _buildTextField(
                controller: _studentIdController,
                hint: 'Enter your Student ID',
                icon: Icons.person_outline,
                focusNode: _studentIdFocus,
                tooltip: 'Use the student number indicated on your COR.',
              ),
              const SizedBox(height: 16),
              _buildLabel('Name'),
              const SizedBox(height: 6),
              _buildTextField(
                controller: _nameController,
                hint: 'Enter your name',
                icon: Icons.person_outline,
                focusNode: _nameFocus,
                tooltip: 'Enter your complete legal name as it appears on your COR.',
              ),
              const SizedBox(height: 16),
              _buildLabel('Email'),
              const SizedBox(height: 6),
              _buildTextField(
                controller: _emailController,
                hint: 'juandelacruz@marsu.edu.ph',
                icon: Icons.mail_outline,
                keyboardType: TextInputType.emailAddress,
                focusNode: _emailFocus,
                tooltip: 'Must be your official MARSU email address — we\'ll send your verification code and login access here.',
              ),
              const SizedBox(height: 16),
              _buildLabel('Password'),
              const SizedBox(height: 6),
              _buildTextField(
                controller: _passwordController,
                hint: 'Create your password',
                icon: Icons.lock_outline,
                obscure: _obscurePassword,
                focusNode: _passwordFocus,
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
              PasswordStrengthIndicator(result: _passwordStrength),
              const SizedBox(height: 16),
              _buildLabel('Course/Program'),
              const SizedBox(height: 6),
              _buildProgramField(),
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
              const SizedBox(height: 16),
              _buildLabel('Campus'),
              const SizedBox(height: 6),
              if (_fixedCampusForSelectedProgram != null)
                _buildLockedCampusField(_fixedCampusForSelectedProgram!)
              else
                _buildDropdown(
                  hint: 'Select your campus',
                  value: _selectedCampus,
                  items: kCampuses,
                  onChanged: (value) {
                    setState(() => _selectedCampus = value);
                  },
                ),
              if (_isRestrictedRotcCampus) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info_outline, color: AppColors.error, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'ROTC is not offered at $_effectiveCampus. Only CWTS is available at this campus — please register through the CWTS portal instead.',
                          style: const TextStyle(fontSize: 12, color: AppColors.error, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: (_isRestrictedRotcCampus || _isVerifying) ? null : _goNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: AppColors.primaryMaroon.withValues(alpha: 0.6),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _isVerifying
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
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
                    onTap: () => Navigator.pop(context),
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

  /// The program dropdown, sourced from GET /api/programs — loading/error
  /// states inline so the rest of the form stays usable while it fetches.
  Widget _buildProgramField() {
    if (_programsState == LoadState.loading) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryMaroon),
            ),
            const SizedBox(width: 10),
            Text('Loading programs...', style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
          ],
        ),
      );
    }
    if (_programsState == LoadState.error || _programsState == LoadState.empty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.errorLight,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                _programsState == LoadState.empty
                    ? 'No programs are configured yet. Contact your administrator.'
                    : _programsError,
                style: const TextStyle(fontSize: 12.5, color: AppColors.error),
              ),
            ),
            if (_programsState == LoadState.error)
              TextButton(
                onPressed: _loadPrograms,
                child: const Text('Retry', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
              ),
          ],
        ),
      );
    }
    return _buildDropdown(
      hint: 'Select your course/program',
      value: _selectedProgram,
      items: _programs,
      onChanged: (value) => setState(() => _selectedProgram = value),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
    bool obscure = false,
    Widget? suffix,
    FocusNode? focusNode,
    String? tooltip,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: controller,
          focusNode: focusNode,
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
        ),
        if (tooltip != null) _buildFieldHint(visible: focusNode?.hasFocus ?? false, text: tooltip),
      ],
    );
  }

  /// A small hint that fades in under a field while it's focused (tapped
  /// into) and fades out once the user moves on — the mobile equivalent of a
  /// desktop hover tooltip, since touch has no hover state.
  Widget _buildFieldHint({required bool visible, required String text}) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 150),
      child: !visible
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 13, color: AppColors.primaryMaroon.withValues(alpha: 0.7)),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      text,
                      style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600, height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  /// Shown instead of the Campus dropdown once the selected college has a
  /// fixed campus (see _programCampuses) — read-only, since campus is no
  /// longer a free choice for that college.
  Widget _buildLockedCampusField(String campus) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: Row(
            children: [
              Icon(Icons.lock_outline, size: 16, color: Colors.grey.shade600),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  campus,
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade800, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            'Automatically set based on your selected college.',
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
          ),
        ),
      ],
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
