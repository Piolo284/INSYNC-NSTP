import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import 'register_documents_screen.dart';
import 'register_draft.dart';
import 'register_program_banner.dart';
import 'register_submit.dart';

/// Step 2 of 3 — "Are you a PWD / SK Chairperson / student with a medical
/// condition?" Picking anything other than "None of the above" routes on to
/// [RegisterDocumentsScreen] to collect the matching requirement document(s);
/// picking "None" finishes registration immediately, since there is nothing
/// left to collect.
class RegisterAdditionalInfoScreen extends StatefulWidget {
  final RegisterDraft draft;

  const RegisterAdditionalInfoScreen({super.key, required this.draft});

  @override
  State<RegisterAdditionalInfoScreen> createState() =>
      _RegisterAdditionalInfoScreenState();
}

class _RegisterAdditionalInfoScreenState
    extends State<RegisterAdditionalInfoScreen> {
  String _selected = kCategoryNone;
  bool _isSubmitting = false;

  static const _options = [
    (
      value: kCategoryPwd,
      label: 'I am an PWD',
      icon: Icons.accessible_rounded,
    ),
    (
      value: kCategorySkChair,
      label: 'I am an SK Chairperson',
      icon: Icons.person_outline,
    ),
    (
      value: kCategoryMedical,
      label: 'I am an student with a medical condition',
      icon: Icons.medical_information_outlined,
    ),
    (
      value: kCategoryNone,
      label: 'None of the above',
      icon: Icons.person_outline,
    ),
  ];

  Future<void> _goNext() async {
    widget.draft.specialCategory = _selected;

    if (widget.draft.needsDocumentStep) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => RegisterDocumentsScreen(draft: widget.draft),
        ),
      );
      return;
    }

    // Nothing further to collect — finish registration right here.
    setState(() => _isSubmitting = true);
    await submitRegistration(context: context, draft: widget.draft);
    if (mounted) setState(() => _isSubmitting = false);
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
          icon: const Icon(Icons.arrow_back_ios, color: Colors.black87, size: 20),
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
                  child: const Icon(Icons.school, color: AppColors.primaryMaroon, size: 45),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Additional Information',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black87),
              ),
              const SizedBox(height: 4),
              Text(
                'This helps us determine if you need to provide additional requirements',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
              ),
              RegisterProgramBanner(nstpProgram: widget.draft.nstpProgram),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Are you a PWD/Student with a medical condition or SK Chairperson?',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade800),
                ),
              ),
              const SizedBox(height: 14),
              ..._options.map(
                (option) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _OptionCard(
                    icon: option.icon,
                    label: option.label,
                    selected: _selected == option.value,
                    onTap: () => setState(() => _selected = option.value),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _goNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: AppColors.primaryMaroon.withValues(alpha: 0.6),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Text(
                          widget.draft.needsDocumentStep ? 'NEXT' : 'SUBMIT & REGISTER',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1),
                        ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'You can change this later in your profile',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _OptionCard({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryMaroon.withValues(alpha: 0.06) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? AppColors.primaryMaroon : Colors.grey.shade300,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: AppColors.primaryMaroon, size: 22),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: Colors.black87,
                ),
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle, color: AppColors.primaryMaroon, size: 20),
          ],
        ),
      ),
    );
  }
}
