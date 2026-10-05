import 'package:flutter/material.dart';
import '../constants/app_colors.dart';
import '../services/services.dart';
import '../utils/formatters.dart';
import 'async_view.dart';

/// Notification list shown from a home screen's bell icon — shared by every
/// trainee/officer dashboard (opened via `showModalBottomSheet`) so the list,
/// read/unread styling, and "Mark all read" behavior stay identical
/// everywhere instead of being copy-pasted per dashboard.
class NotificationsSheet extends StatefulWidget {
  const NotificationsSheet({super.key});

  @override
  State<NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<NotificationsSheet> {
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
                          fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
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

/// Shows [NotificationsSheet] as a bottom sheet — the one-line call every
/// dashboard's bell icon makes.
Future<void> showNotificationsSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const NotificationsSheet(),
  );
}
