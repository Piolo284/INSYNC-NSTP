import 'package:flutter/material.dart';
import 'attendance_screen/cwts_officer_attendance_list_screen.dart';
import 'cwts_officer_announcement_screen.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/user_avatar.dart';

class CwtsOfficerDashboardScreen extends StatefulWidget {
  final VoidCallback? onOpenDrawer;

  const CwtsOfficerDashboardScreen({
    super.key,
    this.onOpenDrawer,
  });

  @override
  State<CwtsOfficerDashboardScreen> createState() =>
      _CwtsOfficerDashboardScreenState();
}

class _CwtsOfficerDashboardScreenState
    extends State<CwtsOfficerDashboardScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';

  Map<String, dynamic> _overview = const {};
  List<Map<String, dynamic>> _announcements = const [];
  List<Map<String, dynamic>> _trendData = const [];

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
      final data = await DashboardService.instance.officer();
      if (!mounted) return;
      setState(() {
        _overview = (data['overview'] as Map?)?.cast<String, dynamic>() ?? {};
        _announcements =
            (data['announcements'] as List? ?? []).cast<Map<String, dynamic>>();
        _trendData =
            (data['trend'] as List? ?? []).cast<Map<String, dynamic>>();
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

  void _navigateToList(String category) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CwtsOfficerAttendanceListScreen(category: category),
      ),
    ).then((_) => _load());
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
            // ===== HEADER BAR =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.menu, color: Colors.white, size: 24),
                    onPressed: widget.onOpenDrawer,
                  ),
                  IconButton(
                    icon: const Icon(Icons.refresh,
                        color: Colors.white, size: 24),
                    onPressed: _load,
                  ),
                ],
              ),
            ),

            // ===== PROFILE INFO =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              '${Fmt.greeting()}! ',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                            const Text('👋', style: TextStyle(fontSize: 14)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          session.name.isEmpty ? 'Officer' : session.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          Fmt.dayDateLong(DateTime.now()),
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                  UserAvatar(
                    imagePath: session.profileImage,
                    radius: 34,
                    backgroundColor: Colors.white.withValues(alpha: 0.25),
                    iconSize: 28,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // ===== WHITE CONTENT SHEET =====
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
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
                        padding: const EdgeInsets.fromLTRB(20, 28, 20, 32),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // ===== SECTION TITLE =====
                            const Text(
                              'OVERVIEW',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 18),

                            // ===== ROW 1: PRESENTS & ABSENTS =====
                            Row(
                              children: [
                                Expanded(
                                  child: _buildStatCard(
                                    icon: Icons.check_rounded,
                                    iconBgColor: const Color(0xFF6B1A2A),
                                    label: 'Presents',
                                    value: Fmt.count(_overview['presents']),
                                    onTap: () => _navigateToList('Presents'),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildStatCard(
                                    icon: Icons.close_rounded,
                                    iconBgColor: const Color(0xFF6B1A2A),
                                    label: 'Absents',
                                    value: Fmt.count(_overview['absents']),
                                    onTap: () => _navigateToList('Absents'),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            // ===== ROW 2: LATE & AT-RISK =====
                            Row(
                              children: [
                                Expanded(
                                  child: _buildStatCard(
                                    icon: Icons.access_time_rounded,
                                    iconBgColor: const Color(0xFFF5A623),
                                    label: 'Late',
                                    value: Fmt.count(_overview['late']),
                                    onTap: () =>
                                        _navigateToList('Late Students'),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildStatCard(
                                    icon: Icons.warning_amber_rounded,
                                    iconBgColor: const Color(0xFFE53935),
                                    label: 'At - Risk',
                                    value: Fmt.count(_overview['atRisk']),
                                    onTap: () =>
                                        _navigateToList('At-Risk Students'),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            // ===== ROW 3: TOTAL STUDENTS (CENTERED) =====
                            Row(
                              children: [
                                const Spacer(),
                                Expanded(
                                  child: _buildStatCard(
                                    icon: Icons.people_rounded,
                                    iconBgColor: const Color(0xFF6B1A2A),
                                    label: 'Total Students',
                                    value:
                                        Fmt.count(_overview['totalStudents']),
                                    onTap: () {},
                                  ),
                                ),
                                const Spacer(),
                              ],
                            ),
                            const SizedBox(height: 28),

                            // ===== ATTENDANCE TREND =====
                            _buildAttendanceTrend(),
                            const SizedBox(height: 28),

                            // ===== RECENT ANNOUNCEMENTS =====
                            _buildRecentAnnouncements(),
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

  // ===== STAT CARD WIDGET =====
  Widget _buildStatCard({
    required IconData icon,
    required Color iconBgColor,
    required String label,
    required String value,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade100),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 12,
              spreadRadius: 0,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Icon Circle
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: iconBgColor,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Icon(
                  icon,
                  color: Colors.white,
                  size: 22,
                ),
              ),
            ),
            const SizedBox(width: 14),
            // Label & Value
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w500,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primaryMaroon,
                      height: 1.0,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===== ATTENDANCE TREND =====
  Widget _buildAttendanceTrend() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'ATTENDANCE TREND (This Month)',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade100),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: _trendData.length < 2
              ? const AsyncView(
                  state: LoadState.empty,
                  compact: true,
                  emptyText: 'Not enough attendance data for a trend yet.',
                  emptyIcon: Icons.show_chart,
                  child: SizedBox.shrink(),
                )
              : Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildYLabel('100%'),
                            _buildYLabel('75%'),
                            _buildYLabel('50%'),
                            _buildYLabel('25%'),
                            _buildYLabel('0%'),
                          ],
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: SizedBox(
                            height: 140,
                            child: CustomPaint(
                              size: const Size(double.infinity, 140),
                              painter: _LineChartPainter(data: _trendData),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.only(left: 36),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: _trendLabels()
                            .map(
                              (label) => Text(
                                label,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.grey.shade500,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  /// Shows at most five evenly spaced date labels so a busy month stays legible.
  List<String> _trendLabels() {
    if (_trendData.isEmpty) return const [];
    if (_trendData.length <= 5) {
      return _trendData.map((d) => Fmt.date(d['date'], fallback: '')).toList();
    }
    final step = (_trendData.length - 1) / 4;
    return List.generate(5, (i) {
      final index = (i * step).round().clamp(0, _trendData.length - 1);
      return Fmt.date(_trendData[index]['date'], fallback: '');
    });
  }

  Widget _buildYLabel(String text) {
    return SizedBox(
      height: 28,
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          color: Colors.grey.shade500,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  // ===== RECENT ANNOUNCEMENTS =====
  Widget _buildRecentAnnouncements() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Text(
              'RECENT ANNOUNCEMENTS',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
                letterSpacing: 0.8,
              ),
            ),
            GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const CwtsOfficerAnnouncementScreen(),
                  ),
                ).then((_) => _load());
              },
              child: const Text(
                'View All',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primaryMaroon,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (_announcements.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade100),
            ),
            child: const AsyncView(
              state: LoadState.empty,
              compact: true,
              emptyText: 'No announcements yet.',
              emptyIcon: Icons.campaign_outlined,
              child: SizedBox.shrink(),
            ),
          )
        else
          ..._announcements.take(3).map(_buildAnnouncementTile),
      ],
    );
  }

  Widget _buildAnnouncementTile(Map<String, dynamic> announcement) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.campaign_rounded,
              color: Colors.deepOrange,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(announcement['title'], 'Announcement'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    Fmt.date(announcement['date']),
                    Fmt.str(announcement['location']),
                  ].where((s) => s.isNotEmpty && s != '—').join(' • '),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                    fontWeight: FontWeight.w400,
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

// ===== LINE CHART PAINTER =====
class _LineChartPainter extends CustomPainter {
  final List<Map<String, dynamic>> data;

  _LineChartPainter({required this.data});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;

    final paint = Paint()
      ..color = AppColors.primaryMaroon
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final dotPaint = Paint()
      ..color = AppColors.primaryMaroon
      ..style = PaintingStyle.fill;

    final gridPaint = Paint()
      ..color = Colors.grey.shade200
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    // Horizontal grid lines
    for (int i = 0; i <= 4; i++) {
      final y = size.height - (i * size.height / 4);
      canvas.drawLine(
        Offset(0, y),
        Offset(size.width, y),
        gridPaint,
      );
    }

    // Data points
    final points = <Offset>[];
    final stepX = size.width / (data.length - 1);

    for (int i = 0; i < data.length; i++) {
      final x = i * stepX;
      final value = Fmt.toDouble(data[i]['value']).clamp(0.0, 1.0);
      final y = size.height - value * size.height;
      points.add(Offset(x, y));
    }

    // Draw line
    final path = Path();
    path.moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(path, paint);

    // Draw dots — kept small when the month has many sessions.
    final radius = data.length > 12 ? 3.0 : 5.0;
    for (final point in points) {
      canvas.drawCircle(point, radius, dotPaint);
      canvas.drawCircle(point, radius / 2, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter oldDelegate) =>
      oldDelegate.data != data;
}
