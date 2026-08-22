import 'package:flutter/material.dart';
import 'cwts_activity_detail_screen.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/status_badge.dart';

class CwtsActivitiesModulesScreen extends StatefulWidget {
  final VoidCallback? onBackToDashboard;

  const CwtsActivitiesModulesScreen({super.key, this.onBackToDashboard});

  @override
  State<CwtsActivitiesModulesScreen> createState() =>
      _CwtsActivitiesModulesScreenState();
}

class _CwtsActivitiesModulesScreenState
    extends State<CwtsActivitiesModulesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  LoadState _state = LoadState.loading;
  String _error = '';

  /// Modules that carry a deadline are the graded "Activities";
  /// the full list is what the "Modules" tab shows.
  List<Map<String, dynamic>> activities = const [];
  List<Map<String, dynamic>> modules = const [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final all = await ModuleService.instance.list();
      if (!mounted) return;
      setState(() {
        modules = all;
        activities = all.where((m) => m['deadline'] != null).toList();
        _state = all.isEmpty ? LoadState.empty : LoadState.ready;
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
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => widget.onBackToDashboard != null
              ? widget.onBackToDashboard!()
              : Navigator.maybePop(context),
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
            icon: const Icon(Icons.refresh, color: AppColors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            decoration: const BoxDecoration(color: AppColors.primaryMaroon),
            child: Container(
              decoration: const BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: TabBar(
                controller: _tabController,
                labelColor: AppColors.primaryMaroon,
                unselectedLabelColor: AppColors.textSecondary,
                indicatorColor: AppColors.primaryMaroon,
                indicatorWeight: 2,
                labelStyle: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                unselectedLabelStyle: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
                tabs: const [
                  Tab(text: 'Activities'),
                  Tab(text: 'Modules'),
                ],
              ),
            ),
          ),
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No activities or modules yet.',
              emptyIcon: Icons.menu_book_outlined,
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildActivitiesTab(),
                  _buildModulesTab(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActivitiesTab() {
    if (activities.isEmpty) {
      return const AsyncView(
        state: LoadState.empty,
        emptyText: 'No activities assigned yet.',
        emptyIcon: Icons.assignment_outlined,
        child: SizedBox.shrink(),
      );
    }

    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: _load,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: activities.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: SectionHeader(
                title: 'Activities',
                subtitle: '${activities.length} assigned to you',
              ),
            );
          }
          final activity = activities[index - 1];
          final status = Fmt.str(activity['myStatus'], 'To Do');

          return AppCard(
            margin: const EdgeInsets.only(bottom: 12),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CwtsActivityDetailScreen(
                    moduleId: Fmt.str(activity['_id']),
                    title: Fmt.str(activity['title'], 'Activity'),
                    dueDate: Fmt.dateTime(activity['deadline']),
                    status: status,
                  ),
                ),
              ).then((_) => _load());
            },
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
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
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              Fmt.str(activity['title'], 'Activity'),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          StatusBadge(status, dense: true),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.event_outlined,
                              size: 13, color: AppColors.textSecondary),
                          const SizedBox(width: 4),
                          Text(
                            Fmt.dateTime(activity['deadline']),
                            style: const TextStyle(
                              fontSize: 12,
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
        },
      ),
    );
  }

  Widget _buildModulesTab() {
    if (modules.isEmpty) {
      return const AsyncView(
        state: LoadState.empty,
        emptyText: 'No modules posted yet.',
        emptyIcon: Icons.folder_open_outlined,
        child: SizedBox.shrink(),
      );
    }

    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: _load,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: modules.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: SectionHeader(
                title: 'Modules',
                subtitle: '${modules.length} posted',
              ),
            );
          }
          final module = modules[index - 1];
          final fileUrl = Fmt.str(module['fileUrl']);

          return AppCard(
            margin: const EdgeInsets.only(bottom: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
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
                        Fmt.str(module['title'], 'Module'),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        Fmt.date(module['createdAt']),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        Fmt.str(
                          module['description'],
                          'No description provided.',
                        ),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                if (fileUrl.isNotEmpty)
                  IconButton(
                    icon: const Icon(
                      Icons.download_outlined,
                      color: AppColors.primaryMaroon,
                      size: 20,
                    ),
                    onPressed: () {
                      AppSnack.info(
                        context,
                        'Download link: ${AppConfig.resolveFileUrl(fileUrl)}',
                      );
                    },
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
