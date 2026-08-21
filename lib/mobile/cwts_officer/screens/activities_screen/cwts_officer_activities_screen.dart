import 'dart:async';

import 'package:flutter/material.dart';
import 'cwts_officer_activity_detail_screen.dart';
import 'cwts_officer_add_activity_screen.dart';
import '../../../../../core/constants/app_colors.dart';
import '../../../../../core/services/services.dart';
import '../../../../../core/utils/formatters.dart';
import '../../../../../core/widgets/async_view.dart';
import '../../../../../core/widgets/user_avatar.dart';

class CwtsOfficerActivitiesScreen extends StatefulWidget {
  const CwtsOfficerActivitiesScreen({super.key});

  @override
  State<CwtsOfficerActivitiesScreen> createState() =>
      _CwtsOfficerActivitiesScreenState();
}

class _CwtsOfficerActivitiesScreenState
    extends State<CwtsOfficerActivitiesScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _activities = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final items = await ActivityService.instance.list(
        program: Session.instance.program,
        search: _searchController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _activities = items;
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

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  Future<void> _openAddActivity() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const CwtsOfficerAddActivityScreen()),
    );
    if (created == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text(
          'Activities',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: Colors.white),
            onPressed: _openAddActivity,
          ),
        ],
      ),
      body: Column(
        children: [
          // ===== SEARCH BAR =====
          Padding(
            padding: const EdgeInsets.all(16),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                decoration: InputDecoration(
                  hintText: 'Search activities',
                  hintStyle: TextStyle(
                    color: Colors.grey.shade400,
                    fontSize: 14,
                  ),
                  prefixIcon: Icon(Icons.search, color: Colors.grey.shade400),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
              ),
            ),
          ),

          // ===== RECENT ACTIVITIES HEADER =====
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'RECENT ACTIVITIES',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ===== ACTIVITIES LIST =====
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: _searchController.text.isEmpty
                  ? 'No activities yet. Tap + to create one.'
                  : 'No activity matches "${_searchController.text}".',
              emptyIcon: Icons.event_note_outlined,
              child: RefreshIndicator(
                color: AppColors.primaryMaroon,
                onRefresh: _load,
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _activities.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    return _buildActivityCard(_activities[index]);
                  },
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAddActivity,
        backgroundColor: AppColors.primaryMaroon,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildActivityCard(Map<String, dynamic> activity) {
    return GestureDetector(
      onTap: () async {
        final changed = await Navigator.push<bool>(
          context,
          MaterialPageRoute(
            builder: (_) => CwtsOfficerActivityDetailScreen(
              activityId: Fmt.str(activity['_id']),
            ),
          ),
        );
        if (changed == true) await _load();
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Activity Image
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: RemoteImage(
                path: Fmt.str(activity['image']),
                width: 80,
                height: 80,
              ),
            ),
            const SizedBox(width: 14),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    Fmt.str(activity['title'], 'Activity'),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    Fmt.str(activity['description'], 'No description.'),
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: 12,
                        color: Colors.grey.shade500,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        Fmt.date(activity['date']),
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade500,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Icon(
                        Icons.people_outline,
                        size: 12,
                        color: Colors.grey.shade500,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${Fmt.toInt(activity['participants'])}',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
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
