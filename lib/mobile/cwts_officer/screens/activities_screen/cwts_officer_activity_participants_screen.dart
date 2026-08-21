import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';
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

  Color _statusColor(String status) {
    switch (status) {
      case 'Present':
        return Colors.green;
      case 'Late':
        return Colors.amber.shade700;
      case 'Absent':
        return Colors.red;
      case 'Excused':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  /// Lets an officer correct a participant's status inline.
  Future<void> _changeStatus(Map<String, dynamic> participant) async {
    const options = ['Present', 'Late', 'Absent', 'Excused'];

    final picked = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 16),
            Text(
              Fmt.str(participant['name'], 'Trainee'),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            ...options.map(
              (option) => ListTile(
                leading: Icon(Icons.circle, size: 12, color: _statusColor(option)),
                title: Text(option, style: const TextStyle(fontSize: 14)),
                trailing: participant['status'] == option
                    ? const Icon(Icons.check, color: AppColors.primaryMaroon)
                    : null,
                onTap: () => Navigator.pop(sheetContext, option),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
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
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Participants',
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
          // ===== STATS CARDS =====
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
            child: Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    label: 'Present',
                    value: '${Fmt.toInt(_stats['present'])}',
                    color: Colors.green,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard(
                    label: 'Late',
                    value: '${Fmt.toInt(_stats['late'])}',
                    color: Colors.amber.shade700,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard(
                    label: 'Absent',
                    value: '${Fmt.toInt(_stats['absent'])}',
                    color: Colors.red,
                  ),
                ),
              ],
            ),
          ),
          Divider(color: Colors.grey.shade200, height: 1),

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
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Search trainee..',
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

          // ===== TOTAL COUNT =====
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Trainee List',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade800,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  '${_filteredParticipants.length} of ${_participants.length}',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
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
                  separatorBuilder: (_, __) => Divider(
                    color: Colors.grey.shade200,
                    height: 1,
                  ),
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
        borderRadius: BorderRadius.circular(12),
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
    final statusColor = _statusColor(status);

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
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      Fmt.str(participant['studentId']),
                      Fmt.str(participant['course']),
                      Fmt.str(participant['yearLevel']),
                    ].where((s) => s.isNotEmpty).join(' • '),
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ),
            // Status Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                status,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: statusColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
