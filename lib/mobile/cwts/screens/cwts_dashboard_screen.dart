import 'package:flutter/material.dart';
import 'cwts_activities_modules_screen.dart';
import 'cwts_activity_detail_screen.dart';
import 'cwts_announcement_screen.dart';
import 'cwts_scan_qr_screen.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/profile_header.dart';
import '../../../core/widgets/status_badge.dart';

class CwtsDashboardScreen extends StatefulWidget {
  final VoidCallback onOpenDrawer;

  const CwtsDashboardScreen({super.key, required this.onOpenDrawer});

  @override
  State<CwtsDashboardScreen> createState() => _CwtsDashboardScreenState();
}

class _CwtsDashboardScreenState extends State<CwtsDashboardScreen> {
  int _currentAnnouncementPage = 0;

  LoadState _state = LoadState.loading;
  String _error = '';

  Map<String, dynamic> _overview = const {};
  List<Map<String, dynamic>> announcements = const [];
  List<Map<String, dynamic>> _toDo = const [];
  List<Map<String, dynamic>> _upcomingActivities = const [];

  int _unreadNotifications = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final data = await DashboardService.instance.student();

      if (!mounted) return;
      setState(() {
        _overview = (data['overview'] as Map?)?.cast<String, dynamic>() ?? {};
        announcements =
            (data['announcements'] as List? ?? []).cast<Map<String, dynamic>>();
        _toDo = (data['toDo'] as List? ?? []).cast<Map<String, dynamic>>();
        _upcomingActivities = (data['upcomingActivities'] as List? ?? [])
            .cast<Map<String, dynamic>>();
        _currentAnnouncementPage = 0;
        _state = LoadState.ready;
      });

      _loadNotificationBadge();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  /// Badge only — a failure here must never break the dashboard.
  Future<void> _loadNotificationBadge() async {
    try {
      final result = await NotificationService.instance.mine(unreadOnly: true);
      if (!mounted) return;
      setState(() => _unreadNotifications = result['unreadCount'] as int? ?? 0);
    } catch (_) {
      /* ignore */
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
        title: Text(
          Session.instance.brigade.isEmpty
              ? 'Brigade Makakalikasan'
              : Session.instance.brigade,
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined,
                    color: AppColors.white),
                onPressed: _showNotifications,
              ),
              if (_unreadNotifications > 0)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppColors.error,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '$_unreadNotifications',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
            ],
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
                      _buildOverviewSection(),
                      const SizedBox(height: 20),
                      _buildToDoSection(),
                      const SizedBox(height: 20),
                      _buildAnnouncementsSection(),
                      if (_upcomingActivities.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        _buildUpcomingActivitiesSection(),
                      ],
                      const SizedBox(height: 20),
                      _buildQuickActionsSection(),
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

  Future<void> _showNotifications() async {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _NotificationsSheet(),
    ).then((_) => _loadNotificationBadge());
  }

  Widget _buildProfileHeader() {
    final session = Session.instance;
    final yearCourse = [session.yearLevel, session.course]
        .where((s) => s.isNotEmpty)
        .join(' - ');
    final subtitleParts = [session.program, yearCourse]
        .where((s) => s.isNotEmpty)
        .join(' · ');

    return ProfileHeader(
      greeting: '${Fmt.greeting()} 👋',
      name: session.name.isEmpty ? 'Trainee' : session.name,
      subtitle: subtitleParts.isEmpty ? 'NSTP Trainee' : subtitleParts,
      imagePath: session.profileImage,
    );
  }

  Widget _buildOverviewSection() {
    final present = Fmt.toInt(_overview['present']);
    final absent = Fmt.toInt(_overview['absents']);
    final late = Fmt.toInt(_overview['late']);
    final excused = Fmt.toInt(_overview['excused']);
    final tasks = Fmt.toInt(_overview['tasks']);
    final totalSessions = present + absent + late + excused;
    final rate = totalSessions == 0
        ? 0
        : (((present + late + excused) / totalSessions) * 100).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Overview'),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildHighlightCard(
              icon: Icons.verified_outlined,
              color: AppColors.success,
              label: 'Attendance rate',
              value: '$rate%',
            ),
            const SizedBox(width: 12),
            _buildHighlightCard(
              icon: Icons.assignment_late_outlined,
              color: AppColors.warning,
              label: 'Pending tasks',
              value: '$tasks',
            ),
          ],
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Row(
            children: [
              _buildAttendanceStat('Present', present, AppColors.success),
              _buildAttendanceStat('Late', late, AppColors.warning),
              _buildAttendanceStat('Absent', absent, AppColors.error),
              _buildAttendanceStat('Excused', excused, AppColors.blue),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHighlightCard({
    required IconData icon,
    required Color color,
    required String label,
    required String value,
  }) {
    return Expanded(
      child: AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.textSecondary,
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

  Widget _buildAttendanceStat(String label, int value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(
            '$value',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildAnnouncementsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Announcements',
          actionLabel: 'View all',
          onAction: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const CwtsAnnouncementScreen(),
              ),
            ).then((_) => _load());
          },
        ),
        const SizedBox(height: 12),
        if (announcements.isEmpty)
          const AppCard(
            child: AsyncView(
              state: LoadState.empty,
              compact: true,
              emptyText: 'No announcements yet.',
              emptyIcon: Icons.campaign_outlined,
              child: SizedBox.shrink(),
            ),
          )
        else ...[
          SizedBox(
            height: 132,
            child: PageView.builder(
              itemCount: announcements.length,
              onPageChanged: (index) {
                setState(() => _currentAnnouncementPage = index);
              },
              itemBuilder: (context, index) {
                final announcement = announcements[index];
                return AppCard(
                  margin: const EdgeInsets.only(right: 10),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.goldLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.campaign,
                          color: AppColors.primaryMaroon,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              Fmt.str(announcement['title'], 'Announcement'),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              [
                                Fmt.date(announcement['date']),
                                Fmt.str(announcement['location'], 'MARSU'),
                              ].where((s) => s.isNotEmpty).join(' • '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              announcements.length,
              (index) => Container(
                width: index == _currentAnnouncementPage ? 8 : 6,
                height: index == _currentAnnouncementPage ? 8 : 6,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: index == _currentAnnouncementPage
                      ? AppColors.primaryMaroon
                      : AppColors.border,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildToDoSection() {
    final items = _toDo.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Pending Activities',
          actionLabel: 'View all',
          onAction: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const CwtsActivitiesModulesScreen(),
              ),
            ).then((_) => _load());
          },
        ),
        const SizedBox(height: 12),
        AppCard(
          padding: items.isEmpty
              ? const EdgeInsets.symmetric(vertical: 8)
              : EdgeInsets.zero,
          child: items.isEmpty
              ? const AsyncView(
                  state: LoadState.empty,
                  compact: true,
                  emptyText: 'Nothing to do right now.',
                  emptyIcon: Icons.task_alt,
                  child: SizedBox.shrink(),
                )
              : Column(
                  children: [
                    for (var i = 0; i < items.length; i++) ...[
                      _buildToDoItem(items[i]),
                      if (i < items.length - 1)
                        const Divider(height: 1, indent: 16, endIndent: 16),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildToDoItem(Map<String, dynamic> task) {
    final status = Fmt.str(task['status'], 'To Do');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.blueLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.menu_book,
              color: AppColors.blue,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(task['title'], 'Task'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Due: ${Fmt.date(task['deadline'], fallback: 'No deadline')}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    StatusBadge(status, dense: true),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          ElevatedButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CwtsActivityDetailScreen(
                    moduleId: Fmt.str(task['_id']),
                    title: Fmt.str(task['title'], 'Task'),
                    dueDate: Fmt.dateTime(task['deadline'],
                        fallback: 'No deadline'),
                    status: status,
                  ),
                ),
              ).then((_) => _load());
            },
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
            child: const Text('Proceed'),
          ),
        ],
      ),
    );
  }

  Widget _buildUpcomingActivitiesSection() {
    final items = _upcomingActivities.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Upcoming Activities'),
        const SizedBox(height: 12),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                _buildActivityRow(items[i]),
                if (i < items.length - 1)
                  const Divider(height: 1, indent: 16, endIndent: 16),
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
            decoration: BoxDecoration(
              color: AppColors.orangeLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.event_outlined,
              color: AppColors.orange,
              size: 20,
            ),
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
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    Fmt.date(activity['date']),
                    Fmt.str(activity['location']),
                  ].where((s) => s.isNotEmpty && s != '—').join(' • '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Quick Actions'),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const CwtsScanQrScreen(),
                ),
              ).then((_) => _load());
            },
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scan Attendance QR'),
          ),
        ),
      ],
    );
  }
}

/// Notification list shown from the bell icon.
class _NotificationsSheet extends StatefulWidget {
  const _NotificationsSheet();

  @override
  State<_NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<_NotificationsSheet> {
  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _items = const [];

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
      final result = await NotificationService.instance.mine(limit: 50);
      final items = (result['data'] as List).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _items = items;
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

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      maxChildSize: 0.9,
      minChildSize: 0.4,
      expand: false,
      builder: (context, controller) {
        return Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
              child: Row(
                children: [
                  const Text(
                    'Notifications',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () async {
                      try {
                        await NotificationService.instance.markAllRead();
                        await _load();
                      } catch (error) {
                        if (context.mounted) {
                          AppSnack.error(context, describeError(error));
                        }
                      }
                    },
                    child: const Text(
                      'Mark all read',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: AsyncView(
                state: _state,
                message: _error,
                onRetry: _load,
                emptyText: 'No notifications yet.',
                emptyIcon: Icons.notifications_none,
                child: ListView.separated(
                  controller: controller,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: _items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = _items[index];
                    final isRead = item['isRead'] == true;
                    return ListTile(
                      onTap: () async {
                        if (isRead) return;
                        try {
                          await NotificationService.instance
                              .markRead(Fmt.str(item['_id']));
                          await _load();
                        } catch (_) {
                          /* ignore */
                        }
                      },
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: isRead ? AppColors.grey100 : AppColors.orangeLight,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          Icons.campaign_outlined,
                          size: 20,
                          color: isRead ? AppColors.textSecondary : AppColors.warning,
                        ),
                      ),
                      title: Text(
                        Fmt.str(item['title'], 'Notification'),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight:
                              isRead ? FontWeight.w500 : FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      subtitle: Text(
                        Fmt.str(item['message']),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      trailing: Text(
                        Fmt.date(item['createdAt'], fallback: ''),
                        style: const TextStyle(
                          fontSize: 10,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
