import 'package:flutter/material.dart';
import '../../shared/announcement_link.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';

class CwtsAnnouncementScreen extends StatefulWidget {
  final VoidCallback? onBackToDashboard;

  const CwtsAnnouncementScreen({super.key, this.onBackToDashboard});

  @override
  State<CwtsAnnouncementScreen> createState() => _CwtsAnnouncementScreenState();
}

class _CwtsAnnouncementScreenState extends State<CwtsAnnouncementScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> announcements = const [];

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
      final items = await AnnouncementService.instance.list();
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

  /// "New" badge for anything posted in the last week — replaces the old
  /// hard-coded `isNew` flag.
  bool _isNew(dynamic createdAt) {
    final date = Fmt.parse(createdAt);
    if (date == null) return false;
    return DateTime.now().difference(date).inDays <= 7;
  }

  /// Linked announcements (a new quiz, assignment, module or activity) open
  /// that page directly; plain ones open the announcement detail.
  void _openDetail(Map<String, dynamic> announcement) {
    openAnnouncement(context, announcement);
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
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          // As a bottom-nav tab the shell passes onBackToDashboard (switch to
          // Home). Opened from "View all" it's a pushed route with no
          // callback — pop back to the screen it was opened from.
          onPressed: () {
            final backToDashboard = widget.onBackToDashboard;
            if (backToDashboard != null) {
              backToDashboard();
            } else {
              Navigator.maybePop(context);
            }
          },
        ),
        title: const Text(
          'Announcements',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        emptyText: 'No announcements yet.',
        emptyIcon: Icons.campaign_outlined,
        child: RefreshIndicator(
          color: AppColors.primaryMaroon,
          onRefresh: _load,
          child: ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            itemCount: announcements.length,
            itemBuilder: (context, index) {
              return _buildAnnouncementCard(announcements[index]);
            },
          ),
        ),
      ),
    );
  }

  Widget _buildAnnouncementCard(Map<String, dynamic> announcement) {
    final isPinned = announcement['isPinned'] == true;
    final isNew = _isNew(announcement['createdAt']);
    final imageUrl = Fmt.str(announcement['imageUrl']);
    final linked = hasAnnouncementLink(announcement);

    return AppCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.zero,
      onTap: () => _openDetail(announcement),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The program's AnnouncementTemplate poster, if one composited an
          // image for this announcement at post time (see admin/src/utils/
          // announcementGenerator.js) — this is the primary way the
          // announcement is meant to be seen; the text below is a fallback.
          if (imageUrl.isNotEmpty)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppColors.radius),
              ),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Image.network(
                  AppConfig.resolveFileUrl(imageUrl),
                  fit: BoxFit.cover,
                  loadingBuilder: (context, child, progress) => progress == null
                      ? child
                      : const ColoredBox(color: AppColors.grey100),
                  errorBuilder: (_, _, _) =>
                      const ColoredBox(color: AppColors.grey100),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: isPinned
                            ? AppColors.goldLight
                            : AppColors.orangeLight,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                      child: Icon(
                        linked
                            ? announcementLinkIcon(announcement)
                            : Icons.campaign,
                        color: isPinned
                            ? AppColors.primaryDark
                            : AppColors.orange,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            Fmt.str(announcement['title'], 'Announcement'),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              if (isPinned)
                                _pill(
                                  'Pinned',
                                  Icons.push_pin,
                                  AppColors.gold,
                                  AppColors.primaryDark,
                                ),
                              if (isNew)
                                _pill(
                                  'New',
                                  null,
                                  AppColors.errorLight,
                                  AppColors.error,
                                ),
                              if (linked)
                                _pill(
                                  announcementLinkLabel(announcement),
                                  Icons.arrow_forward,
                                  AppColors.primaryMaroon.withValues(alpha: 0.1),
                                  AppColors.primaryMaroon,
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  Fmt.str(announcement['content'], 'No details provided.'),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_outlined,
                      size: 12,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      Fmt.date(announcement['date']),
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    if (Fmt.str(announcement['time']).isNotEmpty) ...[
                      const SizedBox(width: 12),
                      const Icon(
                        Icons.access_time,
                        size: 12,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        Fmt.str(announcement['time']),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                    if (Fmt.str(announcement['location']).isNotEmpty) ...[
                      const SizedBox(width: 12),
                      const Icon(
                        Icons.location_on_outlined,
                        size: 12,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          Fmt.str(announcement['location']),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(String label, IconData? icon, Color background, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: color,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
