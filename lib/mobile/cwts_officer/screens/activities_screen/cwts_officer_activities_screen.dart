import 'dart:async';

import 'package:flutter/material.dart';
import 'cwts_officer_activity_detail_screen.dart';
import 'cwts_officer_add_activity_screen.dart';
import '../../../../../core/constants/app_colors.dart';
import '../../../../../core/services/services.dart';
import '../../../../../core/utils/formatters.dart';
import '../../../../../core/widgets/app_card.dart';
import '../../../../../core/widgets/async_view.dart';
import '../../../../../core/widgets/user_avatar.dart';

class CwtsOfficerActivitiesScreen extends StatefulWidget {
  /// Lets the back arrow jump to the shell's Home tab instead of trying to
  /// pop a route — this screen is a bottom-nav tab, not a pushed page, so
  /// there's normally nothing on the Navigator stack for it to pop.
  final ValueChanged<int>? onNavigateToTab;

  const CwtsOfficerActivitiesScreen({super.key, this.onNavigateToTab});

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
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white),
          onPressed: () {
            if (widget.onNavigateToTab != null) {
              widget.onNavigateToTab!(0);
            } else {
              Navigator.maybePop(context);
            }
          },
        ),
        title: const Text(
          'Activities',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: AppColors.white),
            onPressed: _openAddActivity,
          ),
        ],
      ),
      body: Column(
        children: [
          if (Session.instance.isSpecialClassOfficer)
            Container(
              width: double.infinity,
              color: AppColors.primaryMaroon.withValues(alpha: 0.08),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Text(
                '${Session.instance.program} Inclusive Learning Section activities — program-wide, '
                'for PWD/Medical Condition trainees only.',
                style: const TextStyle(fontSize: 11.5, color: AppColors.primaryMaroon, fontWeight: FontWeight.w600),
              ),
            ),
          // ===== SEARCH BAR =====
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Search activities',
                prefixIcon: const Icon(Icons.search),
                contentPadding: const EdgeInsets.symmetric(vertical: 4),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SectionHeader(
              title: 'Activities',
              subtitle: '${_activities.length} recorded',
            ),
          ),
          const SizedBox(height: 8),

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
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  itemCount: _activities.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
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
        child: const Icon(Icons.add, color: AppColors.white),
      ),
    );
  }

  Widget _buildActivityCard(Map<String, dynamic> activity) {
    return AppCard(
      padding: const EdgeInsets.all(12),
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
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  Fmt.str(activity['description'], 'No description.'),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_outlined,
                      size: 12,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      Fmt.date(activity['date']),
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Icon(
                      Icons.people_outline,
                      size: 12,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${Fmt.toInt(activity['participants'])}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
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
  }
}
