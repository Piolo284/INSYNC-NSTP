import 'package:flutter/material.dart';
import 'cwts_officer_attendance_contests_screen.dart';
import 'cwts_officer_attendance_history_screen.dart';
import 'cwts_officer_attendance_list_screen.dart';
import 'cwts_officer_create_qr_screen.dart';
import 'cwts_officer_manual_attendance_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

class CwtsOfficerAttendanceScreen extends StatefulWidget {
  const CwtsOfficerAttendanceScreen({super.key, this.onOpenDrawer});

  /// Set only when this screen is the officer's sole tab (an Attendance
  /// Officer has no Home tab to open the drawer from), so the app bar can
  /// offer a menu button in its place.
  final VoidCallback? onOpenDrawer;

  @override
  State<CwtsOfficerAttendanceScreen> createState() =>
      _CwtsOfficerAttendanceScreenState();
}

class _CwtsOfficerAttendanceScreenState
    extends State<CwtsOfficerAttendanceScreen> {
  DateTime _selectedDate = DateTime.now();

  LoadState _state = LoadState.loading;
  String _error = '';

  Map<String, dynamic> _today = const {};
  List<Map<String, dynamic>> _atRiskStudents = const [];
  List<Map<String, dynamic>> _trendData = const [];

  bool _isFinalizing = false;

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
      final results = await Future.wait([
        AttendanceService.instance.summary(date: _selectedDate),
        AttendanceService.instance.atRisk(),
      ]);

      if (!mounted) return;
      final summary = results[0] as Map<String, dynamic>;
      setState(() {
        _today = (summary['today'] as Map?)?.cast<String, dynamic>() ?? {};
        _trendData =
            (summary['trend'] as List? ?? []).cast<Map<String, dynamic>>();
        _atRiskStudents = results[1] as List<Map<String, dynamic>>;
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

  /// Opens the drill-down list for one status card, scoped to whichever day
  /// is currently selected on this dashboard (not the full history).
  void _openStatusList(String category) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CwtsOfficerAttendanceListScreen(
          category: category,
          initialDate: _selectedDate,
        ),
      ),
    ).then((_) => _load());
  }

  /// "Finalize the day" — anyone who checked in but never checked out (no
  /// matching QR check-out scan, and no officer check-out mark) is flipped
  /// to Absent. Safe to run more than once — it only ever touches rows still
  /// missing a checkout.
  Future<void> _finalizeDay() async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Finalize Attendance?',
      message:
          'Anyone who checked in on ${Fmt.dateWithDay(_selectedDate)} but never '
          'checked out will be marked Absent. This cannot be undone.',
      confirmLabel: 'Finalize',
      danger: true,
    );
    if (!confirmed || !mounted) return;

    setState(() => _isFinalizing = true);
    try {
      final marked = await AttendanceService.instance.finalizeDay(
        date: _selectedDate,
        program: Session.instance.program,
      );
      if (!mounted) return;
      AppSnack.success(
        context,
        marked == 0
            ? 'Everyone who checked in also checked out.'
            : '$marked student(s) marked Absent for missing check-out.',
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isFinalizing = false);
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2024),
      lastDate: DateTime(2030),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme:
              const ColorScheme.light(primary: AppColors.primaryMaroon),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      await _load();
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
        automaticallyImplyLeading: false,
        leading: widget.onOpenDrawer == null
            ? null
            : IconButton(
                icon: const Icon(Icons.menu, color: AppColors.white),
                onPressed: widget.onOpenDrawer,
              ),
        title: const Text(
          'Attendance',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: AppColors.white, size: 20),
            tooltip: 'Search / Filter',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const CwtsOfficerAttendanceListScreen(category: 'All Attendance'),
              ),
            ).then((_) => _load()),
          ),
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
        child: RefreshIndicator(
          color: AppColors.primaryMaroon,
          onRefresh: _load,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (Session.instance.isSpecialClassOfficer)
                  Container(
                    width: double.infinity,
                    color: AppColors.primaryMaroon.withValues(alpha: 0.08),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Text(
                      '${Session.instance.program} Inclusive Learning Section attendance — program-wide, '
                      'for PWD/Medical Condition trainees only.',
                      style: const TextStyle(fontSize: 11.5, color: AppColors.primaryMaroon, fontWeight: FontWeight.w600),
                    ),
                  ),
                // ===== DATE PICKER =====
                Container(
                  width: double.infinity,
                  color: AppColors.cardBg,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: GestureDetector(
                      onTap: _pickDate,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.cardBg,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              Fmt.dateWithDay(_selectedDate),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Icon(Icons.calendar_today_outlined,
                                size: 16, color: AppColors.textSecondary),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                // ===== STATS CARDS =====
                Container(
                  color: AppColors.cardBg,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _StatCard(
                            label: 'Present',
                            value: '${Fmt.toInt(_today['present'])}',
                            percentage:
                                '(${Fmt.toDouble(_today['presentPercent']).toStringAsFixed(1)}%)',
                            status: 'Present',
                            onTap: () => _openStatusList('Presents'),
                          ),
                          const SizedBox(width: 10),
                          _StatCard(
                            label: 'Late',
                            value: '${Fmt.toInt(_today['late'])}',
                            percentage:
                                '(${Fmt.toDouble(_today['latePercent']).toStringAsFixed(1)}%)',
                            status: 'Late',
                            onTap: () => _openStatusList('Late Students'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _StatCard(
                            label: 'Absent',
                            value: '${Fmt.toInt(_today['absent'])}',
                            percentage:
                                '(${Fmt.toDouble(_today['absentPercent']).toStringAsFixed(1)}%)',
                            status: 'Absent',
                            onTap: () => _openStatusList('Absents'),
                          ),
                          const SizedBox(width: 10),
                          _StatCard(
                            label: 'Excused',
                            value: '${Fmt.toInt(_today['excused'])}',
                            percentage: Fmt.toInt(_today['total']) == 0
                                ? '(0.0%)'
                                : '(${(Fmt.toInt(_today['excused']) / Fmt.toInt(_today['total']) * 100).toStringAsFixed(1)}%)',
                            status: 'Excused',
                            onTap: () => _openStatusList('Excused Students'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ===== ATTENDANCE HISTORY QUICK LINK =====
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const CwtsOfficerAttendanceHistoryScreen(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.history, size: 18),
                      label: const Text('View Attendance History'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.border),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // ===== ATTENDANCE CONTESTS QUICK LINK =====
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const CwtsOfficerAttendanceContestsScreen(),
                          ),
                        ).then((_) => _load());
                      },
                      icon: const Icon(Icons.fact_check_outlined, size: 18),
                      label: const Text('Attendance Contests'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.border),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // ===== ACTION BUTTONS =====
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    const CwtsOfficerCreateQrScreen(),
                              ),
                            ).then((_) => _load());
                          },
                          icon: const Icon(Icons.qr_code, size: 18),
                          label: const Text('Create QR Code'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primaryMaroon,
                            side: const BorderSide(
                                color: AppColors.primaryMaroon),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    const CwtsOfficerManualAttendanceScreen(),
                              ),
                            ).then((_) => _load());
                          },
                          icon: const Icon(Icons.edit_note, size: 18),
                          label: const Text('Manual Attendance'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primaryMaroon,
                            foregroundColor: AppColors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // ===== FINALIZE ATTENDANCE =====
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: TextButton.icon(
                      onPressed: _isFinalizing ? null : _finalizeDay,
                      icon: _isFinalizing
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: AppColors.error),
                            )
                          : const Icon(Icons.fact_check, size: 16),
                      label: Text(
                        'Finalize Attendance for ${Fmt.dateWithDay(_selectedDate)}',
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.error,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // ===== STUDENTS NEAR ABSENCE LIMIT =====
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SectionHeader(
                    title: 'Students Near Absence Limit',
                    actionLabel: 'See All',
                    onAction: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const CwtsOfficerAttendanceListScreen(
                            category: 'At-Risk Students',
                          ),
                        ),
                      ).then((_) => _load());
                    },
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: AppCard(
                    padding: EdgeInsets.zero,
                    child: _atRiskStudents.isEmpty
                        ? const AsyncView(
                            state: LoadState.empty,
                            compact: true,
                            emptyText: 'No trainee is near the absence limit.',
                            emptyIcon: Icons.verified_outlined,
                            child: SizedBox.shrink(),
                          )
                        : Column(
                            children: _atRiskStudents
                                .take(3)
                                .toList()
                                .asMap()
                                .entries
                                .map((entry) {
                              final s = entry.value;
                              final isLast = entry.key ==
                                  _atRiskStudents.take(3).length - 1;
                              return Column(
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Row(
                                      children: [
                                        const UserAvatar(
                                          imagePath: null,
                                          radius: 20,
                                          iconSize: 18,
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                Fmt.str(s['name'], 'Trainee'),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w600,
                                                  color: AppColors.textPrimary,
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                '${Fmt.toInt(s['absents'])}/${Fmt.toInt(s['totalSessions'])} Absents',
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color:
                                                      AppColors.textSecondary,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Container(
                                          width: 28,
                                          height: 28,
                                          decoration: const BoxDecoration(
                                            color: AppColors.errorLight,
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Icon(
                                            Icons.error_outline,
                                            color: AppColors.error,
                                            size: 16,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (!isLast)
                                    const Divider(
                                        color: AppColors.border, height: 1),
                                ],
                              );
                            }).toList(),
                          ),
                  ),
                ),
                const SizedBox(height: 24),

                // ===== ATTENDANCE TREND =====
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: SectionHeader(title: 'Attendance Trend (This Month)'),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: AppCard(
                    child: _trendData.length < 2
                        ? const AsyncView(
                            state: LoadState.empty,
                            compact: true,
                            emptyText:
                                'Not enough attendance data for a trend yet.',
                            emptyIcon: Icons.show_chart,
                            child: SizedBox.shrink(),
                          )
                        : Column(
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Column(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      _buildYLabel('100%'),
                                      _buildYLabel('75%'),
                                      _buildYLabel('50%'),
                                      _buildYLabel('25%'),
                                      _buildYLabel('0%'),
                                    ],
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: SizedBox(
                                      height: 140,
                                      child: CustomPaint(
                                        size: const Size(double.infinity, 140),
                                        painter:
                                            _LineChartPainter(data: _trendData),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Padding(
                                padding: const EdgeInsets.only(left: 32),
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: _trendLabels()
                                      .map(
                                        (label) => Text(
                                          label,
                                          style: const TextStyle(
                                              fontSize: 10,
                                              color: AppColors.textSecondary),
                                        ),
                                      )
                                      .toList(),
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

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
        style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
      ),
    );
  }
}

/// One "Present/Late/Absent" count tile — color follows the same
/// status→color mapping [StatusBadge] uses, so the dashboard summary and any
/// status badge shown elsewhere always agree visually.
class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.percentage,
    required this.status,
    this.onTap,
  });

  final String label;
  final String value;
  final String percentage;
  final String status;

  /// Opens the day's student list for this status when tapped.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final style = StatusStyle.of(status);
    return Expanded(
      child: Material(
        color: style.background,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Column(
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: style.color,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: style.color,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  percentage,
                  style: TextStyle(
                    fontSize: 11,
                    color: style.color.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LineChartPainter extends CustomPainter {
  final List<Map<String, dynamic>> data;
  _LineChartPainter({required this.data});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;

    final paint = Paint()
      ..color = AppColors.primaryMaroon
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;

    final dotPaint = Paint()
      ..color = AppColors.primaryMaroon
      ..style = PaintingStyle.fill;

    final gridPaint = Paint()
      ..color = AppColors.border
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    for (int i = 0; i <= 4; i++) {
      final y = size.height - (i * size.height / 4);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final points = <Offset>[];
    final stepX = size.width / (data.length - 1);

    for (int i = 0; i < data.length; i++) {
      final x = i * stepX;
      final value = Fmt.toDouble(data[i]['value']).clamp(0.0, 1.0);
      final y = size.height - value * size.height;
      points.add(Offset(x, y));
    }

    final path = Path();
    path.moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(path, paint);

    final radius = data.length > 12 ? 3.0 : 5.0;
    for (final point in points) {
      canvas.drawCircle(point, radius, dotPaint);
      canvas.drawCircle(point, radius / 2, Paint()..color = AppColors.white);
    }
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter oldDelegate) =>
      oldDelegate.data != data;
}
