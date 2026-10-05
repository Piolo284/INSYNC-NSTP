import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Trainee profile, read from MongoDB. Address and emergency contact stay
/// editable through the same "Edit" links the design already had.
class CwtsPersonalInfoScreen extends StatefulWidget {
  const CwtsPersonalInfoScreen({super.key});

  @override
  State<CwtsPersonalInfoScreen> createState() => _CwtsPersonalInfoScreenState();
}

class _CwtsPersonalInfoScreenState extends State<CwtsPersonalInfoScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  Map<String, dynamic> _profile = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final data = await AuthService.instance.refresh();
      final profile = (data['profile'] as Map?)?.cast<String, dynamic>() ?? {};
      final user = (data['user'] as Map?)?.cast<String, dynamic>() ?? {};

      if (!mounted) return;
      setState(() {
        // Fall back to the User document for fields the role profile omits.
        _profile = {...user, ...profile};
        _state = LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  Future<void> _editField(String label, String field, String current) async {
    final controller = TextEditingController(text: current);

    final value = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Edit $label',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          minLines: 1,
          decoration: InputDecoration(hintText: 'Enter your $label'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    controller.dispose();
    if (value == null || !mounted) return;

    try {
      await UserService.instance.updateMyProfile({field: value});
      if (!mounted) return;
      AppSnack.success(context, '$label updated.');
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final idLabel = Session.instance.role == 'cadet' ? 'Cadet Number' : 'Student Number';
    final idValue = Fmt.str(_profile['studentId'] ?? _profile['cadetId'], '—');
    final fullName = Fmt.str(_profile['fullName'] ?? _profile['name'], '—');
    final course = Fmt.str(_profile['course'], '—');
    final yearSection = [
      Fmt.str(_profile['yearLevel']),
      Fmt.str(_profile['section']),
    ].where((s) => s.isNotEmpty).join(' - ');
    final nstpProgram = Fmt.str(_profile['program'], '—');
    final campus = Fmt.str(_profile['campus'], '—');
    final status = Fmt.str(_profile['status'], '—');
    final email = Fmt.str(_profile['email'], '—');
    final contactNumber = Fmt.str(_profile['contactNumber'], '—');
    final address = Fmt.str(_profile['address'], '—');
    final emergencyContact = Fmt.str(_profile['emergencyContact'], '—');

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
          'Personal Information',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 30),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Column(
                  children: [
                    UserAvatar(
                      imagePath: Fmt.str(_profile['profileImage']),
                      radius: 45,
                      backgroundColor: AppColors.goldLight,
                      iconColor: AppColors.primaryMaroon,
                    ),
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: () => AppSnack.info(
                        context,
                        'Photo uploads are handled by your NSTP officer for now.',
                      ),
                      child: const Text(
                        'Change Photo',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primaryMaroon,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              const SectionHeader(title: 'Basic Information'),
              const SizedBox(height: 10),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _infoTile(icon: Icons.badge_outlined, label: idLabel, value: idValue),
                    _tileDivider(),
                    _infoTile(icon: Icons.person_outline, label: 'Full Name', value: fullName),
                    _tileDivider(),
                    _infoTile(icon: Icons.school_outlined, label: 'Program', value: course),
                    _tileDivider(),
                    _infoTile(
                      icon: Icons.calendar_today_outlined,
                      label: 'Year & Section',
                      value: yearSection.isEmpty ? '—' : yearSection,
                    ),
                    _tileDivider(),
                    _infoTile(
                      icon: Icons.military_tech_outlined,
                      label: 'NSTP Program',
                      value: nstpProgram,
                    ),
                    _tileDivider(),
                    _infoTile(
                      icon: Icons.location_city_outlined,
                      label: 'Campus',
                      value: campus,
                    ),
                    _tileDivider(),
                    _infoTile(
                      icon: Icons.verified_user_outlined,
                      label: 'Account Status',
                      valueWidget: StatusBadge(status),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              const SectionHeader(title: 'Contact Information'),
              const SizedBox(height: 10),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _infoTile(icon: Icons.mail_outline, label: 'Email Address', value: email),
                    _tileDivider(),
                    _infoTile(
                      icon: Icons.phone_android_outlined,
                      label: 'Contact Number',
                      value: contactNumber,
                      onEdit: () => _editField(
                        'Contact Number',
                        'contactNumber',
                        contactNumber == '—' ? '' : contactNumber,
                      ),
                    ),
                    _tileDivider(),
                    _infoTile(
                      icon: Icons.location_on_outlined,
                      label: 'Address',
                      value: address,
                      onEdit: () => _editField(
                        'Address',
                        'address',
                        address == '—' ? '' : address,
                      ),
                    ),
                    _tileDivider(),
                    _infoTile(
                      icon: Icons.phone_in_talk_outlined,
                      label: 'Emergency Contact',
                      value: emergencyContact,
                      onEdit: () => _editField(
                        'Emergency Contact',
                        'emergencyContact',
                        emergencyContact == '—' ? '' : emergencyContact,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoTile({
    required IconData icon,
    required String label,
    String? value,
    Widget? valueWidget,
    VoidCallback? onEdit,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.primaryMaroon, size: 20),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 4),
                valueWidget ??
                    Text(
                      value ?? '—',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textPrimary,
                        height: 1.4,
                      ),
                    ),
              ],
            ),
          ),
          if (onEdit != null)
            InkWell(
              onTap: onEdit,
              borderRadius: BorderRadius.circular(20),
              child: const Padding(
                padding: EdgeInsets.all(6),
                child: Icon(Icons.edit_outlined, color: AppColors.primaryMaroon, size: 18),
              ),
            ),
        ],
      ),
    );
  }

  Widget _tileDivider() {
    return const Divider(height: 1, color: AppColors.border, indent: 16, endIndent: 16);
  }
}
