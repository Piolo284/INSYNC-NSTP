import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Past attendance sessions (QR and manual), each drillable into its full
/// record list — the "review past sessions" counterpart to the Attendance
/// tab's live/today view.
class CwtsOfficerAttendanceHistoryScreen extends StatefulWidget {
  const CwtsOfficerAttendanceHistoryScreen({super.key});

  @override
  State<CwtsOfficerAttendanceHistoryScreen> createState() =>
      _CwtsOfficerAttendanceHistoryScreenState();
}

class _CwtsOfficerAttendanceHistoryScreenState
    extends State<CwtsOfficerAttendanceHistoryScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _sessions = const [];

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
      final sessions = await AttendanceService.instance.sessions(
        program: Session.instance.program,
        status: 'Closed',
      );
      sessions.sort((a, b) => Fmt.str(b['date']).compareTo(Fmt.str(a['date'])));
      if (!mounted) return;
      setState(() {
        _sessions = sessions;
        _state = sessions.isEmpty ? LoadState.empty : LoadState.ready;
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
          'Attendance History',
          style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        emptyText: 'No closed attendance sessions yet.',
        emptyIcon: Icons.history,
        child: RefreshIndicator(
          color: AppColors.primaryMaroon,
          onRefresh: _load,
          child: ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            itemCount: _sessions.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) => _buildSessionCard(_sessions[index]),
          ),
        ),
      ),
    );
  }

  Widget _buildSessionCard(Map<String, dynamic> session) {
    return AppCard(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => _SessionRecordsScreen(session: session),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  Fmt.str(session['title'], 'Attendance Session'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ),
              const StatusBadge('Closed', dense: true),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.calendar_today_outlined, size: 13, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(Fmt.date(session['date']), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              const SizedBox(width: 12),
              const Icon(Icons.schedule_outlined, size: 13, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(
                '${Fmt.str(session['startTime'])} - ${Fmt.str(session['endTime'])}',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.people_outline, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(
                '${Fmt.toInt(session['recordCount'])} recorded',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
              const Spacer(),
              const Icon(Icons.chevron_right, color: AppColors.textSecondary, size: 18),
            ],
          ),
        ],
      ),
    );
  }
}

/// Read-only record list for one closed session (no live polling — the
/// session is over).
class _SessionRecordsScreen extends StatefulWidget {
  const _SessionRecordsScreen({required this.session});

  final Map<String, dynamic> session;

  @override
  State<_SessionRecordsScreen> createState() => _SessionRecordsScreenState();
}

class _SessionRecordsScreenState extends State<_SessionRecordsScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _records = const [];

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
      final records = await AttendanceService.instance.list(
        sessionId: Fmt.str(widget.session['_id']),
        limit: 500,
      );
      if (!mounted) return;
      setState(() {
        _records = records;
        _state = records.isEmpty ? LoadState.empty : LoadState.ready;
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
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          Fmt.str(widget.session['title'], 'Session Records'),
          style: const TextStyle(color: AppColors.white, fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        emptyText: 'No attendance recorded for this session.',
        emptyIcon: Icons.people_outline,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _records.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final record = _records[index];
            final student = record['studentId'];
            final user = student is Map ? student : const {};
            return AppCard(
              child: Row(
                children: [
                  UserAvatar(imagePath: Fmt.str(user['profileImage']), radius: 20, iconSize: 18),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          Fmt.str(user['name'], 'Trainee'),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${Fmt.str(user['studentId'], '—')}  •  ${Fmt.str(record['time'], '---')}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  StatusBadge(Fmt.str(record['status'], 'Present'), dense: true),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
