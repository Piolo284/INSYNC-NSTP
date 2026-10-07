import 'package:flutter/material.dart';
import '../../rotc/screens/rotc_activities_modules_screen.dart';
import '../../rotc/screens/rotc_announcement_screen.dart';
import '../../rotc/screens/rotc_scan_qr_screen.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/profile_header.dart';

/// Home tab of the ROTC Special Class shell — the dedicated dashboard for a
/// PWD/Medical-Condition cadet who cannot undergo field training. Reuses the
/// same underlying services as the regular RotcDashboardScreen (attendance,
/// activities), which already come back correctly scoped to the Special
/// Class track server-side, but adds the one thing that's genuinely new:
/// who the assigned Special Class officer is.
class RotcSpecialDashboardScreen extends StatefulWidget {
  final VoidCallback onOpenDrawer;

  const RotcSpecialDashboardScreen({super.key, required this.onOpenDrawer});

  @override
  State<RotcSpecialDashboardScreen> createState() => _RotcSpecialDashboardScreenState();
}

class _RotcSpecialDashboardScreenState extends State<RotcSpecialDashboardScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';

  Map<String, dynamic>? _officer;
  List<Map<String, dynamic>> _records = const [];
  List<Map<String, dynamic>> _activities = const [];

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
      final results = await Future.wait([
        SpecialClassService.instance.officer(),
        AttendanceService.instance.myRecords(),
        ActivityService.instance.list(program: 'ROTC', upcomingOnly: true),
      ]);
      if (!mounted) return;
      setState(() {
        _officer = results[0] as Map<String, dynamic>?;
        _records = (results[1] as List).cast<Map<String, dynamic>>();
        _activities = (results[2] as List).cast<Map<String, dynamic>>();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: AppColors.white),
          onPressed: widget.onOpenDrawer,
        ),
        title: const Text(
          'ROTC Inclusive Learning',
          style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primaryMaroon,
        onRefresh: _load,
        child: AsyncView(
          state: _state,
          message: _error,
          onRetry: _load,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildProfileHeader(),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildTrackBanner(),
                      const SizedBox(height: 20),
                      _buildOfficerCard(),
                      const SizedBox(height: 20),
                      _buildAttendanceSection(),
                      const SizedBox(height: 20),
                      _buildActivitiesSection(),
                      const SizedBox(height: 20),
                      _buildQuickActions(),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProfileHeader() {
    // Rebuilds as soon as the session changes (e.g. a new profile photo).
    return ValueListenableBuilder<int>(
      valueListenable: Session.instance.changes,
      builder: (_, _, _) => _profileHeaderContent(),
    );
  }

  Widget _profileHeaderContent() {
    final session = Session.instance;
    return ProfileHeader(
      greeting: '${Fmt.greeting()} 👋',
      name: session.name.isEmpty ? 'Cadet' : session.name,
      subtitle: 'ROTC · Inclusive Learning Section',
      imagePath: session.profileImage,
    );
  }

  Widget _buildTrackBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primaryMaroon.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primaryMaroon.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.shield_outlined, color: AppColors.primaryMaroon, size: 20),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              "You're in the Inclusive Learning Section — activities here replace field training/drills.",
              style: TextStyle(fontSize: 12.5, color: AppColors.primaryMaroon, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOfficerCard() {
    final officer = _officer;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Your Inclusive Learning Section Officer'),
        const SizedBox(height: 12),
        AppCard(
          child: officer == null
              ? const Text(
                  'No officer has been assigned yet. Please check back later or contact the ROTC Administrator.',
                  style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                )
              : Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(color: AppColors.cwtsCardBg, shape: BoxShape.circle),
                      child: const Icon(Icons.person, color: AppColors.primaryMaroon, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            Fmt.str(officer['fullName'], 'Officer'),
                            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            [Fmt.str(officer['email']), Fmt.str(officer['contactNumber'])]
                                .where((s) => s.isNotEmpty)
                                .join(' · '),
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildAttendanceSection() {
    final present = _records.where((r) => r['status'] == 'Present').length;
    final late = _records.where((r) => r['status'] == 'Late').length;
    final absent = _records.where((r) => r['status'] == 'Absent').length;
    final excused = _records.where((r) => r['status'] == 'Excused').length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Your Attendance'),
        const SizedBox(height: 12),
        AppCard(
          child: Row(
            children: [
              _buildStat('Present', present, AppColors.success),
              _buildStat('Late', late, AppColors.warning),
              _buildStat('Absent', absent, AppColors.error),
              _buildStat('Excused', excused, AppColors.blue),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStat(String label, int value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text('$value', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: color)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  Widget _buildActivitiesSection() {
    final items = _activities.take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Upcoming Inclusive Learning Activities',
          actionLabel: 'View all',
          onAction: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const RotcActivitiesModulesScreen()),
            ).then((_) => _load());
          },
        ),
        const SizedBox(height: 12),
        AppCard(
          padding: items.isEmpty ? const EdgeInsets.symmetric(vertical: 8) : EdgeInsets.zero,
          child: items.isEmpty
              ? const AsyncView(
                  state: LoadState.empty,
                  compact: true,
                  emptyText: 'No Inclusive Learning Section activities scheduled yet.',
                  emptyIcon: Icons.event_note_outlined,
                  child: SizedBox.shrink(),
                )
              : Column(
                  children: [
                    for (var i = 0; i < items.length; i++) ...[
                      _buildActivityRow(items[i]),
                      if (i < items.length - 1) const Divider(height: 1, indent: 16, endIndent: 16),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildActivityRow(Map<String, dynamic> activity) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: AppColors.orangeLight, borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.event_outlined, color: AppColors.orange, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(activity['title'], 'Activity'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  [Fmt.date(activity['date']), Fmt.str(activity['location'])]
                      .where((s) => s.isNotEmpty && s != '—')
                      .join(' • '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Quick Actions'),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const RotcScanQrScreen()))
                      .then((_) => _load());
                },
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Scan QR'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const RotcAnnouncementScreen()))
                      .then((_) => _load());
                },
                icon: const Icon(Icons.campaign_outlined),
                label: const Text('Announcements'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
