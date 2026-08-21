import 'package:flutter/material.dart';
import 'cwts_activity_detail_screen.dart';
import '../../../core/config/app_config.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_view.dart';

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

  Color _statusColor(String status) {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => widget.onBackToDashboard != null
              ? widget.onBackToDashboard!()
              : Navigator.maybePop(context),
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
            icon: const Icon(Icons.refresh, color: Colors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            decoration: const BoxDecoration(
              color: AppColors.primaryMaroon,
            ),
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: TabBar(
                controller: _tabController,
                labelColor: AppColors.primaryMaroon,
                unselectedLabelColor: Colors.grey.shade500,
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
        itemCount: activities.length,
        itemBuilder: (context, index) {
          final activity = activities[index];
          final status = Fmt.str(activity['myStatus'], 'To Do');

          return GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CwtsActivityDetailScreen(
                    moduleId: Fmt.str(activity['_id']),
                    title: Fmt.str(activity['title'], 'Activity'),
                    dueDate: Fmt.dateTime(activity['deadline']),
                    status: status,
                    statusColor: _statusColor(status),
                  ),
                ),
              ).then((_) => _load());
            },
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
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
                          Fmt.dateTime(activity['deadline']),
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    status,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _statusColor(status),
                    ),
                  ),
                ],
              ),
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
        itemCount: modules.length,
        itemBuilder: (context, index) {
          final module = modules[index];
          final fileUrl = Fmt.str(module['fileUrl']);

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
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
                        Fmt.str(module['title'], 'Module'),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        Fmt.date(module['createdAt']),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        Fmt.str(
                          module['description'],
                          'No description provided.',
                        ),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
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
