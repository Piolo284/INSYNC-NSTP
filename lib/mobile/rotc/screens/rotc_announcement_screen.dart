import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/attachment_preview_screen.dart';

class RotcAnnouncementScreen extends StatefulWidget {
  final VoidCallback? onBackToDashboard;

  const RotcAnnouncementScreen({super.key, this.onBackToDashboard});

  @override
  State<RotcAnnouncementScreen> createState() => _RotcAnnouncementScreenState();
}

class _RotcAnnouncementScreenState extends State<RotcAnnouncementScreen> {
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

  bool _isNew(dynamic createdAt) {
    final date = Fmt.parse(createdAt);
    if (date == null) return false;
    return DateTime.now().difference(date).inDays <= 7;
  }

  void _openDetail(Map<String, dynamic> announcement) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _AnnouncementDetailScreen(announcement: announcement),
      ),
    );
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
                        Icons.campaign,
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

/// Clean, single-announcement detail view — reached by tapping a list card.
class _AnnouncementDetailScreen extends StatelessWidget {
  final Map<String, dynamic> announcement;

  const _AnnouncementDetailScreen({required this.announcement});

  @override
  Widget build(BuildContext context) {
    final isPinned = announcement['isPinned'] == true;
    final imageUrl = Fmt.str(announcement['imageUrl']);

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text(
          'Announcement',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // The program's AnnouncementTemplate poster for this announcement
            // (see admin/src/utils/announcementGenerator.js) — tap to view
            // full-screen. Falls back to nothing if no template was configured.
            if (imageUrl.isNotEmpty) ...[
              GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AttachmentPreviewScreen(
                      fileUrl: imageUrl,
                      fileName: Fmt.str(
                        announcement['imageName'],
                        'announcement.png',
                      ),
                    ),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppColors.radius),
                  child: Image.network(
                    AppConfig.resolveFileUrl(imageUrl),
                    fit: BoxFit.contain,
                    width: double.infinity,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isPinned) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.goldLight,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(
                            Icons.push_pin,
                            size: 13,
                            color: AppColors.primaryDark,
                          ),
                          SizedBox(width: 5),
                          Text(
                            'Pinned Announcement',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  Text(
                    Fmt.str(announcement['title'], 'Announcement'),
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  InfoRow(
                    icon: Icons.calendar_today_outlined,
                    label: 'Date',
                    value: Fmt.dateWithDay(announcement['date']),
                  ),
                  if (Fmt.str(announcement['time']).isNotEmpty)
                    InfoRow(
                      icon: Icons.access_time,
                      label: 'Time',
                      value: Fmt.str(announcement['time']),
                    ),
                  if (Fmt.str(announcement['location']).isNotEmpty)
                    InfoRow(
                      icon: Icons.location_on_outlined,
                      label: 'Location',
                      value: Fmt.str(announcement['location']),
                    ),
                  const SizedBox(height: 10),
                  const Divider(),
                  const SizedBox(height: 10),
                  Text(
                    Fmt.str(announcement['content'], 'No details provided.'),
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                      height: 1.6,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
