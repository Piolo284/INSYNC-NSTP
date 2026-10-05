import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';

/// Full notification center for the CWTS officer — the mobile analogue of
/// the web admin's notification bell dropdown, but a dedicated screen since
/// officers get a higher volume of system notifications (submissions,
/// attendance, announcements) than a compact sheet comfortably holds.
class CwtsOfficerNotificationsScreen extends StatefulWidget {
  const CwtsOfficerNotificationsScreen({super.key});

  @override
  State<CwtsOfficerNotificationsScreen> createState() =>
      _CwtsOfficerNotificationsScreenState();
}

class _CwtsOfficerNotificationsScreenState
    extends State<CwtsOfficerNotificationsScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _items = const [];
  bool _isMarkingAll = false;

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
      final result = await NotificationService.instance.mine(limit: 100);
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

  Future<void> _markAllRead() async {
    setState(() => _isMarkingAll = true);
    try {
      await NotificationService.instance.markAllRead();
      await _load();
    } catch (error) {
      if (mounted) AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isMarkingAll = false);
    }
  }

  Future<void> _markRead(Map<String, dynamic> item) async {
    if (item['isRead'] == true) return;
    try {
      await NotificationService.instance.markRead(Fmt.str(item['_id']));
      if (!mounted) return;
      setState(() {
        item['isRead'] = true;
      });
    } catch (error) {
      if (mounted) AppSnack.error(context, describeError(error));
    }
  }

  bool get _hasUnread => _items.any((item) => item['isRead'] != true);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text(
          'Notifications',
          style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w600),
        ),
        actions: [
          TextButton(
            onPressed: _hasUnread && !_isMarkingAll ? _markAllRead : null,
            child: _isMarkingAll
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white),
                  )
                : const Text(
                    'Mark all read',
                    style: TextStyle(color: AppColors.white, fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
          ),
        ],
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        emptyText: 'No notifications yet.',
        emptyIcon: Icons.notifications_none,
        child: RefreshIndicator(
          color: AppColors.primaryMaroon,
          onRefresh: _load,
          child: ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            itemCount: _items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) => _buildTile(_items[index]),
          ),
        ),
      ),
    );
  }

  Widget _buildTile(Map<String, dynamic> item) {
    final isRead = item['isRead'] == true;
    return AppCard(
      onTap: () => _markRead(item),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isRead ? AppColors.grey100 : AppColors.orangeLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.notifications_outlined,
              size: 20,
              color: isRead ? AppColors.textSecondary : AppColors.warning,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(item['title'], 'Notification'),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  Fmt.str(item['message']),
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
                ),
                const SizedBox(height: 6),
                Text(
                  Fmt.date(item['createdAt'], fallback: ''),
                  style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          if (!isRead)
            Container(
              margin: const EdgeInsets.only(top: 4, left: 6),
              width: 8,
              height: 8,
              decoration: const BoxDecoration(color: AppColors.primaryMaroon, shape: BoxShape.circle),
            ),
        ],
      ),
    );
  }
}
