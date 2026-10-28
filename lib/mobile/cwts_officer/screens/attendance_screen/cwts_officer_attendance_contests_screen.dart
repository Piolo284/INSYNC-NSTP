import 'package:flutter/material.dart';
import 'cwts_officer_contest_detail_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Officer's review queue for trainee-filed absence disputes — brigade- and
/// program-scoped server-side, same as every other officer-facing list.
class CwtsOfficerAttendanceContestsScreen extends StatefulWidget {
  const CwtsOfficerAttendanceContestsScreen({super.key});

  @override
  State<CwtsOfficerAttendanceContestsScreen> createState() =>
      _CwtsOfficerAttendanceContestsScreenState();
}

class _CwtsOfficerAttendanceContestsScreenState
    extends State<CwtsOfficerAttendanceContestsScreen> {
  static const List<String> _filters = ['Pending', 'Approved', 'Rejected', 'All'];
  String _selectedFilter = 'Pending';

  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _contests = const [];

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
      final contests = await AttendanceService.instance.listContests(
        status: _selectedFilter == 'All' ? null : _selectedFilter,
      );
      if (!mounted) return;
      setState(() {
        _contests = contests;
        _state = contests.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  void _selectFilter(String filter) {
    setState(() => _selectedFilter = filter);
    _load();
  }

  Map<String, dynamic> _attendanceOf(Map<String, dynamic> contest) {
    final a = contest['attendanceId'];
    return a is Map ? a.cast<String, dynamic>() : const {};
  }

  Map<String, dynamic> _studentOf(Map<String, dynamic> contest) {
    final s = contest['studentId'];
    return s is Map ? s.cast<String, dynamic>() : const {};
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
          'Attendance Contests',
          style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w600),
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
            width: double.infinity,
            color: AppColors.cardBg,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: _filters
                  .map(
                    (f) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(f),
                        selected: _selectedFilter == f,
                        onSelected: (_) => _selectFilter(f),
                        selectedColor: AppColors.primaryMaroon,
                        labelStyle: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _selectedFilter == f ? AppColors.white : AppColors.textPrimary,
                        ),
                        backgroundColor: AppColors.scaffoldBg,
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No $_selectedFilter contests.',
              emptyIcon: Icons.fact_check_outlined,
              child: RefreshIndicator(
                color: AppColors.primaryMaroon,
                onRefresh: _load,
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: _contests.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _buildTile(_contests[index]),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTile(Map<String, dynamic> contest) {
    final student = _studentOf(contest);
    final attendance = _attendanceOf(contest);

    return AppCard(
      onTap: () async {
        final changed = await Navigator.push<bool>(
          context,
          MaterialPageRoute(
            builder: (_) => CwtsOfficerContestDetailScreen(contestId: Fmt.str(contest['_id'])),
          ),
        );
        if (changed == true) await _load();
      },
      child: Row(
        children: [
          UserAvatar(imagePath: Fmt.str(student['profileImage']), radius: 20, iconSize: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(student['name'], 'Trainee'),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  '${Fmt.str(attendance['title'], 'Attendance')} • ${Fmt.date(attendance['date'])}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 4),
                Text(
                  Fmt.str(contest['reason']),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusBadge(
            Fmt.str(contest['status']) == 'Approved'
                ? (Fmt.str(contest['approvedAs'], 'Excused') == 'Present' ? 'Approved as Present' : 'Approved as Excuse')
                : Fmt.str(contest['status'], 'Pending'),
            dense: true,
          ),
        ],
      ),
    );
  }
}
