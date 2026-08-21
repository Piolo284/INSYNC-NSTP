import 'package:flutter/material.dart';
import 'cwts_activities_modules_screen.dart';
import 'cwts_activity_detail_screen.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/user_avatar.dart';

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
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: Colors.white),
          onPressed: widget.onOpenDrawer,
        ),
        title: Text(
          Session.instance.brigade.isEmpty
              ? 'Brigade Makakalikasan'
              : Session.instance.brigade,
          style: const TextStyle(
            color: Colors.white,
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
                    color: Colors.white),
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
                      color: Colors.red.shade600,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '$_unreadNotifications',
                      style: const TextStyle(
                        color: Colors.white,
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
          state: _state == LoadState.ready ? LoadState.ready : _state,
          message: _error,
          onRetry: _load,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildProfileCard(),
                const SizedBox(height: 20),
                _buildOverviewSection(),
                const SizedBox(height: 20),
                _buildAnnouncementsSection(),
                const SizedBox(height: 20),
                _buildToDoSection(),
                const SizedBox(height: 80),
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
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _NotificationsSheet(),
    ).then((_) => _loadNotificationBadge());
  }

  Widget _buildProfileCard() {
    final session = Session.instance;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '${Fmt.greeting()}! ',
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.black87,
                      ),
                    ),
                    const Text('👋', style: TextStyle(fontSize: 14)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  session.name.isEmpty ? 'Trainee' : '${session.name}!',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  Fmt.dateLong(DateTime.now()),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
          UserAvatar(
            imagePath: session.profileImage,
            radius: 30,
            iconColor: Colors.grey,
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Overview',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              _buildStatColumn(
                label: 'Tasks',
                value: '${Fmt.toInt(_overview['tasks'])}',
                sublabel: 'To do',
                valueColor: Colors.black87,
              ),
              Container(
                width: 1,
                height: 50,
                color: Colors.grey.shade300,
              ),
              _buildStatColumn(
                label: 'Absents',
                value: '${Fmt.toInt(_overview['absents'])}',
                sublabel: 'Total',
                valueColor: Colors.red,
              ),
              Container(
                width: 1,
                height: 50,
                color: Colors.grey.shade300,
              ),
              _buildStatColumn(
                label: 'Late',
                value: '${Fmt.toInt(_overview['late'])}',
                sublabel: 'Total',
                valueColor: Colors.orange.shade700,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatColumn({
    required String label,
    required String value,
    required String sublabel,
    required Color valueColor,
  }) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: valueColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            sublabel,
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnnouncementsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Announcements',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 12),
        if (announcements.isEmpty)
          Container(
            height: 130,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8F0),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFFFE8D0)),
            ),
            child: const AsyncView(
              state: LoadState.empty,
              compact: true,
              emptyText: 'No announcements yet.',
              emptyIcon: Icons.campaign_outlined,
              child: SizedBox.shrink(),
            ),
          )
        else ...[
          SizedBox(
            height: 130,
            child: PageView.builder(
              itemCount: announcements.length,
              onPageChanged: (index) {
                setState(() => _currentAnnouncementPage = index);
              },
              itemBuilder: (context, index) {
                final announcement = announcements[index];
                return Container(
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF8F0),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFFFE8D0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.campaign,
                        color: AppColors.primaryMaroon,
                        size: 40,
                      ),
                      const SizedBox(width: 16),
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
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Text(
                                  Fmt.date(announcement['date']),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8),
                                  child: Container(
                                    width: 1,
                                    height: 12,
                                    color: Colors.grey.shade400,
                                  ),
                                ),
                                Expanded(
                                  child: Text(
                                    Fmt.str(announcement['location'], 'MARSU'),
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                                ),
                              ],
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
                      : Colors.grey.shade400,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildToDoSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'To Do Activities',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const CwtsActivitiesModulesScreen(),
                  ),
                ).then((_) => _load());
              },
              child: const Text(
                'View All',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primaryMaroon,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: _toDo.isEmpty
              ? const AsyncView(
                  state: LoadState.empty,
                  compact: true,
                  emptyText: 'Nothing to do right now.',
                  emptyIcon: Icons.task_alt,
                  child: SizedBox.shrink(),
                )
              : Column(
                  children: [
                    for (var i = 0; i < _toDo.take(3).length; i++) ...[
                      _buildToDoItem(_toDo[i]),
                      if (i < _toDo.take(3).length - 1)
                        Divider(
                          height: 1,
                          color: Colors.grey.shade100,
                          indent: 16,
                          endIndent: 16,
                        ),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildToDoItem(Map<String, dynamic> task) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFE3F2FD),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.menu_book,
              color: Colors.blue,
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
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Due: ${Fmt.date(task['deadline'], fallback: 'No deadline')}',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
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
                    status: Fmt.str(task['status'], 'To Do'),
                    statusColor: statusColorFor(Fmt.str(task['status'])),
                  ),
                ),
              ).then((_) => _load());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryMaroon,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            child: const Text(
              'Proceed',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Shared status colours for module/submission states.
Color statusColorFor(String status) {
  switch (status) {
    case 'Graded':
      return Colors.green;
    case 'Submitted':
      return Colors.amber.shade700;
    case 'Missing':
      return Colors.red;
    default:
      return Colors.blue;
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
                color: Colors.grey.shade300,
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
                      color: Colors.black87,
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
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primaryMaroon,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: Colors.grey.shade200),
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
                  separatorBuilder: (_, __) =>
                      Divider(height: 1, color: Colors.grey.shade100),
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
                          color: isRead
                              ? Colors.grey.shade100
                              : const Color(0xFFFFF3E0),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          Icons.campaign_outlined,
                          size: 20,
                          color: isRead
                              ? Colors.grey.shade500
                              : Colors.deepOrange,
                        ),
                      ),
                      title: Text(
                        Fmt.str(item['title'], 'Notification'),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight:
                              isRead ? FontWeight.w500 : FontWeight.w700,
                          color: Colors.black87,
                        ),
                      ),
                      subtitle: Text(
                        Fmt.str(item['message']),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      trailing: Text(
                        Fmt.date(item['createdAt'], fallback: ''),
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.grey.shade500,
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
