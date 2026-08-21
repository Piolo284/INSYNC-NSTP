import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';
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
          decoration: InputDecoration(
            hintText: 'Enter your $label',
            hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text('Cancel', style: TextStyle(color: Colors.grey.shade700)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text.trim()),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryMaroon,
              foregroundColor: Colors.white,
              elevation: 0,
            ),
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
          'Personal Information',
          style: TextStyle(
            color: Colors.white,
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
          child: Column(
            children: [
              const SizedBox(height: 24),
              Center(
                child: Column(
                  children: [
                    UserAvatar(
                      imagePath: Fmt.str(_profile['profileImage']),
                      radius: 45,
                      iconColor: Colors.grey,
                    ),
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: () => AppSnack.info(
                        context,
                        'Photo uploads are handled by your NSTP officer for now.',
                      ),
                      child: const Text(
                        'Change Profile',
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
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    children: [
                      _buildInfoTile(
                        icon: Icons.badge_outlined,
                        label: Session.instance.role == 'cadet'
                            ? 'Cadet ID'
                            : 'Student ID',
                        value: Fmt.str(
                          _profile['studentId'] ?? _profile['cadetId'],
                          '—',
                        ),
                      ),
                      _buildDivider(),
                      _buildInfoTile(
                        icon: Icons.person_outline,
                        label: 'Full name',
                        value: Fmt.str(
                            _profile['fullName'] ?? _profile['name'], '—'),
                      ),
                      _buildDivider(),
                      _buildInfoTile(
                        icon: Icons.school_outlined,
                        label: 'Program',
                        value: Fmt.str(_profile['course'], '—'),
                      ),
                      _buildDivider(),
                      _buildInfoTile(
                        icon: Icons.calendar_today_outlined,
                        label: 'Year & Section',
                        value: [
                          Fmt.str(_profile['yearLevel']),
                          Fmt.str(_profile['section']),
                        ].where((s) => s.isNotEmpty).join(' - ').isEmpty
                            ? '—'
                            : [
                                Fmt.str(_profile['yearLevel']),
                                Fmt.str(_profile['section']),
                              ].where((s) => s.isNotEmpty).join(' - '),
                      ),
                      _buildDivider(),
                      _buildInfoTile(
                        icon: Icons.mail_outline,
                        label: 'Email Address',
                        value: Fmt.str(_profile['email'], '—'),
                      ),
                      _buildDivider(),
                      _buildInfoTile(
                        icon: Icons.phone_android_outlined,
                        label: 'Contact Number',
                        value: Fmt.str(_profile['contactNumber'], '—'),
                        trailing: _editLink(
                          'Contact Number',
                          'contactNumber',
                          Fmt.str(_profile['contactNumber']),
                        ),
                      ),
                      _buildDivider(),
                      _buildInfoTile(
                        icon: Icons.location_on_outlined,
                        label: 'Address',
                        value: Fmt.str(_profile['address'], '—'),
                        trailing: _editLink(
                          'Address',
                          'address',
                          Fmt.str(_profile['address']),
                        ),
                      ),
                      _buildDivider(),
                      _buildInfoTile(
                        icon: Icons.phone_in_talk_outlined,
                        label: 'Emergency Contact',
                        value: Fmt.str(_profile['emergencyContact'], '—'),
                        trailing: _editLink(
                          'Emergency Contact',
                          'emergencyContact',
                          Fmt.str(_profile['emergencyContact']),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _editLink(String label, String field, String current) {
    return GestureDetector(
      onTap: () => _editField(label, field, current),
      child: const Text(
        'Edit',
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.primaryMaroon,
        ),
      ),
    );
  }

  Widget _buildInfoTile({
    required IconData icon,
    required String label,
    required String value,
    Widget? trailing,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            color: AppColors.primaryMaroon,
            size: 22,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) trailing,
        ],
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
