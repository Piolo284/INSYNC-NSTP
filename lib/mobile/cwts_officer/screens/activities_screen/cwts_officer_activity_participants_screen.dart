import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

class CwtsOfficerActivityParticipantsScreen extends StatefulWidget {
  final String activityId;
  final String activityTitle;

  const CwtsOfficerActivityParticipantsScreen({
    super.key,
    required this.activityId,
    required this.activityTitle,
  });

  @override
  State<CwtsOfficerActivityParticipantsScreen> createState() =>
      _CwtsOfficerActivityParticipantsScreenState();
}

class _CwtsOfficerActivityParticipantsScreenState
    extends State<CwtsOfficerActivityParticipantsScreen> {
  final TextEditingController _searchController = TextEditingController();

  LoadState _state = LoadState.loading;
  String _error = '';

  List<Map<String, dynamic>> _participants = const [];
  Map<String, dynamic> _stats = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final result =
          await ActivityService.instance.participants(widget.activityId);
      if (!mounted) return;
      final list = (result['data'] as List).cast<Map<String, dynamic>>();
      setState(() {
        _participants = list;
        _stats = result['stats'] as Map<String, dynamic>;
        _state = list.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  List<Map<String, dynamic>> get _filteredParticipants {
    final query = _searchController.text.toLowerCase();
    if (query.isEmpty) return _participants;
    return _participants.where((p) {
      return Fmt.str(p['name']).toLowerCase().contains(query) ||
          Fmt.str(p['studentId']).toLowerCase().contains(query);
    }).toList();
  }

  /// Lets an officer correct a participant's status inline.
  Future<void> _changeStatus(Map<String, dynamic> participant) async {
    const options = ['Present', 'Late', 'Absent', 'Excused'];

    final picked = await showAppBottomSheet<String>(
      context,
      title: Fmt.str(participant['name'], 'Trainee'),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: options
            .map(
              (option) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: StatusBadge(option, dense: true),
                title: Text(option, style: const TextStyle(fontSize: 14)),
                trailing: participant['status'] == option
                    ? const Icon(Icons.check, color: AppColors.primaryMaroon)
                    : null,
                onTap: () => Navigator.pop(context, option),
              ),
            )
            .toList(),
      ),
    );

    if (picked == null || picked == participant['status'] || !mounted) return;

    try {
      await AttendanceService.instance.update(
        Fmt.str(participant['attendanceId']),
        status: picked,
      );
      if (!mounted) return;
      AppSnack.success(context, 'Marked $picked.');
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
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
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Participants',
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
          // ===== STATS CARDS =====
          Container(
            color: AppColors.white,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
            child: Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    label: 'Present',
                    value: '${Fmt.toInt(_stats['present'])}',
                    color: AppColors.success,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard(
                    label: 'Late',
                    value: '${Fmt.toInt(_stats['late'])}',
                    color: AppColors.warning,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard(
                    label: 'Absent',
                    value: '${Fmt.toInt(_stats['absent'])}',
                    color: AppColors.error,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // ===== SEARCH BAR =====
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Search trainee..',
                prefixIcon: const Icon(Icons.search),
                contentPadding: const EdgeInsets.symmetric(vertical: 4),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
              ),
            ),
          ),

          // ===== TOTAL COUNT =====
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Trainee List',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  '${_filteredParticipants.length} of ${_participants.length}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ===== PARTICIPANTS LIST =====
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No attendance recorded for this activity yet.',
              emptyIcon: Icons.people_outline,
              child: RefreshIndicator(
                color: AppColors.primaryMaroon,
                onRefresh: _load,
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _filteredParticipants.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    return _buildParticipantTile(_filteredParticipants[index]);
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard({
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildParticipantTile(Map<String, dynamic> participant) {
    final status = Fmt.str(participant['status'], 'Present');

    return InkWell(
      onTap: () => _changeStatus(participant),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            // Avatar
            UserAvatar(
              imagePath: Fmt.str(participant['profileImage']),
              radius: 24,
              iconSize: 22,
            ),
            const SizedBox(width: 14),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    Fmt.str(participant['name'], 'Trainee'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      Fmt.str(participant['studentId']),
                      Fmt.str(participant['course']),
                      Fmt.str(participant['yearLevel']),
                    ].where((s) => s.isNotEmpty).join(' • '),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            StatusBadge(status),
          ],
        ),
      ),
    );
  }
}
