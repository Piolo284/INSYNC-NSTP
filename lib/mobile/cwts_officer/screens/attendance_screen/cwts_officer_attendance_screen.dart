import 'package:flutter/material.dart';
import 'cwts_officer_attendance_list_screen.dart';
import 'cwts_officer_create_qr_screen.dart';
import 'cwts_officer_manual_attendance_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/user_avatar.dart';

class CwtsOfficerAttendanceScreen extends StatefulWidget {
  const CwtsOfficerAttendanceScreen({super.key});

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
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        automaticallyImplyLeading: false,
        title: const Text(
          'Attendance',
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
                // ===== DATE DROPDOWN =====
                Container(
                  width: double.infinity,
                  color: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: GestureDetector(
                      onTap: _pickDate,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              Fmt.dateWithDay(_selectedDate),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: Colors.grey.shade800,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Icon(Icons.calendar_today_outlined,
                                size: 16, color: Colors.grey.shade600),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                // ===== STATS CARDS =====
                Container(
                  color: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      _buildStatCard(
                        label: 'Present',
                        value: '${Fmt.toInt(_today['present'])}',
                        percentage:
                            '(${Fmt.toDouble(_today['presentPercent']).toStringAsFixed(1)}%)',
                        bgColor: const Color(0xFFE8F5E9),
                        valueColor: Colors.green.shade700,
                      ),
                      const SizedBox(width: 10),
                      _buildStatCard(
                        label: 'Late',
                        value: '${Fmt.toInt(_today['late'])}',
                        percentage:
                            '(${Fmt.toDouble(_today['latePercent']).toStringAsFixed(1)}%)',
                        bgColor: const Color(0xFFFFF9C4),
                        valueColor: Colors.amber.shade800,
                      ),
                      const SizedBox(width: 10),
                      _buildStatCard(
                        label: 'Absent',
                        value: '${Fmt.toInt(_today['absent'])}',
                        percentage:
                            '(${Fmt.toDouble(_today['absentPercent']).toStringAsFixed(1)}%)',
                        bgColor: const Color(0xFFFFEBEE),
                        valueColor: Colors.red.shade700,
                      ),
                    ],
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
                          label: const Text('Create Qr Code'),
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
                            foregroundColor: Colors.white,
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
                const SizedBox(height: 24),

                // ===== STUDENTS NEAR ABSENCE LIMIT =====
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'STUDENTS NEAR ABSENCE LIMIT',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                          letterSpacing: 0.5,
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  const CwtsOfficerAttendanceListScreen(
                                category: 'At-Risk Students',
                              ),
                            ),
                          ).then((_) => _load());
                        },
                        child: const Text(
                          'See All',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primaryMaroon,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: _atRiskStudents.isEmpty
                      ? const AsyncView(
                          state: LoadState.empty,
                          compact: true,
                          emptyText: 'No trainee is near the absence limit.',
                          emptyIcon: Icons.verified_outlined,
                          child: SizedBox.shrink(),
                        )
                      : Column(
                          children:
                              _atRiskStudents.take(3).toList().asMap().entries.map(
                            (entry) {
                              final s = entry.value;
                              final isLast = entry.key ==
                                  _atRiskStudents.take(3).length - 1;
                              return Column(
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Row(
                                      children: [
                                        UserAvatar(
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
                                                  color: Colors.black87,
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                '${Fmt.toInt(s['absents'])}/${Fmt.toInt(s['totalSessions'])} Absents',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.grey.shade500,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Container(
                                          width: 28,
                                          height: 28,
                                          decoration: BoxDecoration(
                                            color: Colors.red.shade50,
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(
                                            Icons.error_outline,
                                            color: Colors.red.shade600,
                                            size: 16,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (!isLast)
                                    Divider(
                                        color: Colors.grey.shade100, height: 1),
                                ],
                              );
                            },
                          ).toList(),
                        ),
                ),
                const SizedBox(height: 24),

                // ===== ATTENDANCE TREND =====
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'ATTENDANCE TREND (This Month)',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
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
                                        style: TextStyle(
                                            fontSize: 10,
                                            color: Colors.grey.shade500),
                                      ),
                                    )
                                    .toList(),
                              ),
                            ),
                          ],
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

  Widget _buildStatCard({
    required String label,
    required String value,
    required String percentage,
    required Color bgColor,
    required Color valueColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: valueColor,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: valueColor,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              percentage,
              style: TextStyle(
                fontSize: 11,
                color: valueColor.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildYLabel(String text) {
    return SizedBox(
      height: 28,
      child: Text(
        text,
        style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
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
      ..color = Colors.grey.shade200
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
      canvas.drawCircle(point, radius / 2, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter oldDelegate) =>
      oldDelegate.data != data;
}
