import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/widgets/app_card.dart';

/// These are per-device delivery preferences, so they are stored with
/// SharedPreferences (keyed by user) rather than in MongoDB. Previously the
/// toggles reset every time the screen was reopened.
class CwtsNotificationSettingsScreen extends StatefulWidget {
  const CwtsNotificationSettingsScreen({super.key});

  @override
  State<CwtsNotificationSettingsScreen> createState() =>
      _CwtsNotificationSettingsScreenState();
}

class _CwtsNotificationSettingsScreenState
    extends State<CwtsNotificationSettingsScreen> {
  bool announcement = true;
  bool newActivities = true;
  bool moduleReleased = true;
  bool activityDeadlines = true;
  bool gradesPosted = true;
  bool attendanceConfirmation = true;
  bool emailNotification = true;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  String _key(String name) => 'notif_${Session.instance.userId}_$name';

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      announcement = prefs.getBool(_key('announcement')) ?? true;
      newActivities = prefs.getBool(_key('newActivities')) ?? true;
      moduleReleased = prefs.getBool(_key('moduleReleased')) ?? true;
      activityDeadlines = prefs.getBool(_key('activityDeadlines')) ?? true;
      gradesPosted = prefs.getBool(_key('gradesPosted')) ?? true;
      attendanceConfirmation =
          prefs.getBool(_key('attendanceConfirmation')) ?? true;
      emailNotification = prefs.getBool(_key('emailNotification')) ?? true;
    });
  }

  Future<void> _persist(String name, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key(name), value);
  }

  /// Updates the toggle in place and writes it to disk.
  void _set(String name, bool value, void Function() apply) {
    setState(apply);
    _persist(name, value);
  }

  @override
  Widget build(BuildContext context) {
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
          'Notification Settings',
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
            const SectionHeader(title: 'Push Notifications'),
            const SizedBox(height: 10),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _buildToggleItem(
                    label: 'Announcement',
                    value: announcement,
                    onChanged: (val) => _set(
                        'announcement', val, () => announcement = val),
                  ),
                  _buildDivider(),
                  _buildToggleItem(
                    label: 'New Activities',
                    value: newActivities,
                    onChanged: (val) => _set(
                        'newActivities', val, () => newActivities = val),
                  ),
                  _buildDivider(),
                  _buildToggleItem(
                    label: 'Module Released',
                    value: moduleReleased,
                    onChanged: (val) => _set(
                        'moduleReleased', val, () => moduleReleased = val),
                  ),
                  _buildDivider(),
                  _buildToggleItem(
                    label: 'Activity Deadlines Reminder',
                    value: activityDeadlines,
                    onChanged: (val) => _set('activityDeadlines', val,
                        () => activityDeadlines = val),
                  ),
                  _buildDivider(),
                  _buildToggleItem(
                    label: 'Grades Posted',
                    value: gradesPosted,
                    onChanged: (val) =>
                        _set('gradesPosted', val, () => gradesPosted = val),
                  ),
                  _buildDivider(),
                  _buildToggleItem(
                    label: 'Attendance Confirmation',
                    value: attendanceConfirmation,
                    onChanged: (val) => _set('attendanceConfirmation', val,
                        () => attendanceConfirmation = val),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const SectionHeader(title: 'Email Notifications'),
            const SizedBox(height: 10),
            AppCard(
              padding: EdgeInsets.zero,
              child: _buildToggleItem(
                label: 'Email Notification',
                value: emailNotification,
                onChanged: (val) => _set(
                    'emailNotification', val, () => emailNotification = val),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildToggleItem({
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return const Divider(height: 1, color: AppColors.border, indent: 16, endIndent: 16);
  }
}
