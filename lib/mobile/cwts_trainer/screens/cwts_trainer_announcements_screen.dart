import 'package:flutter/material.dart';
import 'package:marsu_nstp_portal/core/constants/app_colors.dart';
import 'package:marsu_nstp_portal/core/services/services.dart';
import 'package:marsu_nstp_portal/core/utils/formatters.dart';
import 'package:marsu_nstp_portal/core/widgets/async_view.dart';
import 'package:marsu_nstp_portal/mobile/cwts_officer/screens/cwts_officer_announcement_screen.dart';

/// Instructor announcements. The list is read from MongoDB; creating, editing
/// and deleting reuse the same editor the officer screen already provides.
class CwtsTrainerAnnouncementsScreen extends StatefulWidget {
  const CwtsTrainerAnnouncementsScreen({super.key});

  @override
  State<CwtsTrainerAnnouncementsScreen> createState() =>
      _CwtsTrainerAnnouncementsScreenState();
}

class _CwtsTrainerAnnouncementsScreenState
    extends State<CwtsTrainerAnnouncementsScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> announcements = const [];

  /// Rotating accents so the cards keep their original varied look.
  static const List<List<Color>> _palette = [
    [AppColors.blue, AppColors.blueLight],
    [AppColors.orange, AppColors.orangeLight],
    [AppColors.success, AppColors.greenLight],
    [AppColors.pink, AppColors.pinkLight],
  ];

  static const List<IconData> _icons = [
    Icons.campaign_outlined,
    Icons.notifications_active_outlined,
    Icons.calendar_month_outlined,
    Icons.menu_book_outlined,
  ];

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
      final items = await AnnouncementService.instance.list(
        program: Session.instance.program,
      );
      if (!mounted) return;
      setState(() {
        announcements = items;
        _state = items.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  /// Delegates to the officer announcements screen, which already implements
  /// the full create / edit / delete / send flow.
  Future<void> _manage() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const CwtsOfficerAnnouncementScreen(),
      ),
    );
    await _load();
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
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text(
          'Announcement',
          style: TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _load,
          ),
          IconButton(
            icon: const Icon(Icons.add, color: Colors.white),
            onPressed: _manage,
          ),
        ],
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        emptyText: 'No announcements yet. Tap + to post one.',
        emptyIcon: Icons.campaign_outlined,
        child: RefreshIndicator(
          color: AppColors.primaryMaroon,
          onRefresh: _load,
          child: ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            itemCount: announcements.length,
            itemBuilder: (context, index) {
              return _buildAnnouncementCard(announcements[index], index);
            },
          ),
        ),
      ),
    );
  }

  Widget _buildAnnouncementCard(Map<String, dynamic> item, int index) {
    final colors = _palette[index % _palette.length];
    final icon = _icons[index % _icons.length];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.grey300),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon Box
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: colors[1],
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              color: colors[0],
              size: 24,
            ),
          ),
          const SizedBox(width: 14),

          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(item['title'], 'Announcement'),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    Fmt.date(item['date']),
                    Fmt.str(item['time']),
                    Fmt.str(item['targetAudience'], 'All'),
                  ].where((s) => s.isNotEmpty && s != '—').join(' • '),
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  Fmt.str(item['content'], 'No details provided.'),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.grey900,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),

          // Manage
          IconButton(
            icon: const Icon(Icons.more_horiz, color: Colors.grey, size: 20),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: _manage,
          ),
        ],
      ),
    );
  }
}
