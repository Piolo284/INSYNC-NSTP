import 'package:flutter/material.dart';
import 'cwts_trainer_attendance_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/user_avatar.dart';

class CwtsTrainerDashboardScreen extends StatefulWidget {
  final VoidCallback? onOpenDrawer;

  const CwtsTrainerDashboardScreen({super.key, this.onOpenDrawer});

  @override
  State<CwtsTrainerDashboardScreen> createState() =>
      _CwtsTrainerDashboardScreenState();
}

class _CwtsTrainerDashboardScreenState
    extends State<CwtsTrainerDashboardScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';

  Map<String, dynamic> _overview = const {};
  Map<String, dynamic> _classOverview = const {};
  List<Map<String, dynamic>> _recentActivities = const [];

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
      final data = await DashboardService.instance.instructor();
      if (!mounted) return;
      setState(() {
        _overview = (data['overview'] as Map?)?.cast<String, dynamic>() ?? {};
        _classOverview =
            (data['classOverview'] as Map?)?.cast<String, dynamic>() ?? {};
        _recentActivities = (data['recentActivities'] as List? ?? [])
            .cast<Map<String, dynamic>>();
        _state = LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  /// Attendance rate as a 0–1 fraction for the circular indicator.
  double get _attendanceFraction {
    final rate = Fmt.toInt(_overview['attendanceRate']).clamp(0, 100);
    return rate / 100;
  }

  @override
  Widget build(BuildContext context) {
    final session = Session.instance;

    return Scaffold(
      backgroundColor: AppColors.primaryMaroon,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // ===== HEADER =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.menu,
                            color: Colors.white, size: 24),
                        onPressed: widget.onOpenDrawer,
                      ),
                      const Text(
                        'Dashboard',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.refresh,
                        color: Colors.white, size: 24),
                    onPressed: _load,
                  ),
                ],
              ),
            ),

            // ===== PROFILE GREETING =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  UserAvatar(
                    imagePath: session.profileImage,
                    radius: 28,
                    backgroundColor: Colors.white.withValues(alpha: 0.3),
                    iconSize: 24,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${Fmt.greeting()},',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          session.name.isEmpty
                              ? 'Instructor'
                              : '${session.name} !',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Instructor',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ===== WHITE SHEET =====
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                  child: AsyncView(
                    state: _state,
                    message: _error,
                    onRetry: _load,
                    child: RefreshIndicator(
                      color: AppColors.primaryMaroon,
                      onRefresh: _load,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // ===== OVERVIEW =====
                            const Text(
                              'Overview',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 14),

                            // ===== 4 STAT CARDS =====
                            Row(
                              children: [
                                _buildOverviewCard(
                                  value: '${Fmt.toInt(_overview['modules'])}',
                                  label: 'Modules',
                                  bgColor: const Color(0xFFE8F5E9),
                                  valueColor: Colors.green.shade700,
                                ),
                                const SizedBox(width: 10),
                                _buildOverviewCard(
                                  value:
                                      '${Fmt.toInt(_overview['enrolledStudents'])}',
                                  label: 'Enrolled\nStudents',
                                  bgColor: const Color(0xFFFFEBEE),
                                  valueColor: Colors.red.shade400,
                                ),
                                const SizedBox(width: 10),
                                _buildOverviewCard(
                                  value:
                                      '${Fmt.toInt(_overview['attendanceRate'])}%',
                                  label: 'Attendance\nRate',
                                  bgColor: const Color(0xFFE3F2FD),
                                  valueColor: Colors.green.shade700,
                                ),
                                const SizedBox(width: 10),
                                _buildOverviewCard(
                                  value:
                                      '${Fmt.toInt(_overview['announcements'])}',
                                  label: 'Announce-\nments',
                                  bgColor: const Color(0xFFFFF9C4),
                                  valueColor: Colors.amber.shade800,
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),

                            // ===== CLASS OVERVIEW =====
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Class Overview',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.black87,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade100,
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    session.program,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade700,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),

                            // ===== ATTENDANCE CIRCLE =====
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.grey.shade200),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.03),
                                    blurRadius: 10,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  // Circular Progress
                                  SizedBox(
                                    width: 90,
                                    height: 90,
                                    child: Stack(
                                      fit: StackFit.expand,
                                      children: [
                                        CircularProgressIndicator(
                                          value: _attendanceFraction,
                                          strokeWidth: 8,
                                          backgroundColor: Colors.grey.shade200,
                                          valueColor:
                                              AlwaysStoppedAnimation<Color>(
                                                  Colors.green.shade600),
                                        ),
                                        Center(
                                          child: Text(
                                            '${Fmt.toInt(_overview['attendanceRate'])}%',
                                            style: TextStyle(
                                              fontSize: 20,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.green.shade700,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 24),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'Attendance Role',
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            color: Colors.black87,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        _buildAttendanceLegend(
                                          'Present',
                                          '${Fmt.toInt(_classOverview['present'])}',
                                          Colors.green,
                                        ),
                                        const SizedBox(height: 8),
                                        _buildAttendanceLegend(
                                          'Absent',
                                          '${Fmt.toInt(_classOverview['absent'])}',
                                          Colors.red.shade400,
                                        ),
                                        const SizedBox(height: 8),
                                        _buildAttendanceLegend(
                                          'Excused',
                                          '${Fmt.toInt(_classOverview['excused'])}',
                                          Colors.amber,
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),

                            // ===== VIEW ATTENDANCE BUTTON =====
                            GestureDetector(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        const CwtsTrainerAttendanceScreen(),
                                  ),
                                ).then((_) => _load());
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 14),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  border:
                                      Border.all(color: Colors.grey.shade200),
                                ),
                                child: Row(
                                  children: [
                                    Icon(Icons.qr_code_scanner,
                                        color: Colors.grey.shade600, size: 20),
                                    const SizedBox(width: 12),
                                    Text(
                                      'View Attendance',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                        color: Colors.grey.shade800,
                                      ),
                                    ),
                                    const Spacer(),
                                    Icon(Icons.arrow_forward_ios,
                                        color: Colors.grey.shade400, size: 14),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 24),

                            // ===== RECENT ACTIVITIES =====
                            const Text(
                              'Recent Activities',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 14),
                            if (_recentActivities.isEmpty)
                              const AsyncView(
                                state: LoadState.empty,
                                compact: true,
                                emptyText: 'No recent activity.',
                                emptyIcon: Icons.history,
                                child: SizedBox.shrink(),
                              )
                            else
                              ..._recentActivities.map(
                                (a) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _buildActivityItem(
                                    title: Fmt.str(a['title'], 'Activity'),
                                    date: Fmt.dateTimeShort(a['date']),
                                    icon: a['status'] == 'Graded'
                                        ? Icons.assignment_turned_in_outlined
                                        : Icons.assignment_outlined,
                                    iconColor: Colors.deepOrange,
                                  ),
                                ),
                              ),
                            const SizedBox(height: 16),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOverviewCard({
    required String value,
    required String label,
    required Color bgColor,
    required Color valueColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            FittedBox(
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: valueColor,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10,
                color: Colors.grey.shade700,
                fontWeight: FontWeight.w500,
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttendanceLegend(String label, String value, Color color) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey.shade600,
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
        ),
      ],
    );
  }

  Widget _buildActivityItem({
    required String title,
    required String date,
    required IconData icon,
    required Color iconColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  date,
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
