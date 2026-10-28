import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../services/services.dart';
import '../utils/formatters.dart';

/// Shared UI for the attendance standing the backend computes live from
/// counted (Absent) attendance — see backend utils/attendanceStanding.js.
///
///  * [AttendanceWarningBanner] — the Dashboard Overview warning shown once a
///    trainee is at risk for dropping (one absence from the limit) or
///    restricted (at/over the limit).
///  * [FeatureLockedView] — full-screen "Feature Locked" state for screens the
///    backend refuses while restricted (opening modules/activities, QR
///    attendance).
///  * [RestrictionGate] — wraps one of those screens: checks the standing on
///    open and shows [FeatureLockedView] instead of the screen when locked.

const String kRestrictionReason =
    'This feature is currently restricted because you have reached 5 counted absences. '
    'Please see your NSTP officer or admin for assistance.';

bool isRestricted(Map<String, dynamic>? standing) => standing?['restricted'] == true;
bool isAtRisk(Map<String, dynamic>? standing) => standing?['atRisk'] == true;

String restrictionReason(Map<String, dynamic>? standing) {
  final limit = Fmt.toInt(standing?['limit'], 5);
  return 'This feature is currently restricted because you have reached $limit counted absences. '
      'Please see your NSTP officer or admin for assistance.';
}

/// Ring color for [ProfileHeader.alertColor] — null in good standing.
Color? attendanceAlertColor(Map<String, dynamic>? standing) {
  if (!isAtRisk(standing)) return null;
  return isRestricted(standing) ? AppColors.error : const Color(0xFFF59E0B);
}

/// The eye-catching pill under the trainee's name on the home screen: amber
/// "Needs attention" from the warning threshold (3 absences), white/red
/// "Attendance locked" at the limit (5). Pulses gently so it's noticed.
class AttendanceHeaderAlert extends StatefulWidget {
  final Map<String, dynamic>? standing;

  const AttendanceHeaderAlert({super.key, required this.standing});

  @override
  State<AttendanceHeaderAlert> createState() => _AttendanceHeaderAlertState();
}

class _AttendanceHeaderAlertState extends State<AttendanceHeaderAlert>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
    lowerBound: 0.55,
    upperBound: 1,
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final standing = widget.standing;
    if (!isAtRisk(standing)) return const SizedBox.shrink();

    final restricted = isRestricted(standing);
    final absences = Fmt.toInt(standing?['countedAbsences']);
    final bg = restricted ? Colors.white : const Color(0xFFFBBF24);
    final fg = restricted ? AppColors.error : const Color(0xFF451A03);
    final label = restricted
        ? '$absences absences · Attendance locked — see your officer'
        : '$absences absences · Needs attention';

    return FadeTransition(
      opacity: _pulse,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(restricted ? Icons.lock : Icons.warning_amber_rounded, size: 15, color: fg),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: fg),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AttendanceWarningBanner extends StatelessWidget {
  final Map<String, dynamic>? standing;

  /// Opens the trainee's attendance history (where an absence can be
  /// contested), when the host screen can navigate there.
  final VoidCallback? onViewAttendance;

  const AttendanceWarningBanner({super.key, required this.standing, this.onViewAttendance});

  @override
  Widget build(BuildContext context) {
    if (!isAtRisk(standing)) return const SizedBox.shrink();

    final restricted = isRestricted(standing);
    final absences = Fmt.toInt(standing?['countedAbsences']);
    final limit = Fmt.toInt(standing?['limit'], 5);
    final color = restricted ? AppColors.error : AppColors.warning;
    final features = ((standing?['restrictedFeatures'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: restricted ? AppColors.errorLight : AppColors.orangeLight,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(restricted ? Icons.lock_outline : Icons.warning_amber_rounded, color: color, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  restricted ? 'At Risk / Restricted' : 'Attendance Warning',
                  style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: color),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$absences / $limit absences',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.white),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            Fmt.str(standing?['message']),
            style: TextStyle(fontSize: 12.5, height: 1.45, color: color),
          ),
          if (restricted && features.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...features.map(
              (f) => Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  children: [
                    Icon(Icons.block, size: 14, color: color),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text('$f — locked', style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (onViewAttendance != null) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: onViewAttendance,
                style: TextButton.styleFrom(
                  foregroundColor: color,
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('View attendance history', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class FeatureLockedView extends StatelessWidget {
  final String message;

  const FeatureLockedView({super.key, this.message = kRestrictionReason});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(color: AppColors.errorLight, shape: BoxShape.circle),
              child: const Icon(Icons.lock_outline, color: AppColors.error, size: 34),
            ),
            const SizedBox(height: 18),
            const Text(
              'Feature Locked',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 4),
            const Text(
              'Access Restricted',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.error),
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, height: 1.5, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            const Text(
              'You can still view your profile, attendance history, grades and announcements. '
              'If an absence was a mistake, contest it from your attendance history — access is restored automatically once your counted absences drop below the limit.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, height: 1.5, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shows [child] only when the signed-in trainee is not restricted. The
/// backend enforces the same rule on every locked endpoint; this just spares
/// the trainee a screen that would fail. A failed standing check falls
/// through to [child] so the backend's own answer decides.
class RestrictionGate extends StatefulWidget {
  final Widget child;

  /// Wraps the locked state (e.g. in the host screen's Scaffold/AppBar).
  final Widget Function(BuildContext context, Widget lockedView)? lockedBuilder;

  const RestrictionGate({super.key, required this.child, this.lockedBuilder});

  @override
  State<RestrictionGate> createState() => _RestrictionGateState();
}

class _RestrictionGateState extends State<RestrictionGate> {
  bool _checking = true;
  Map<String, dynamic>? _standing;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    if (!Session.instance.isTrainee) {
      setState(() => _checking = false);
      return;
    }
    try {
      final standing = await AttendanceService.instance.standing();
      if (!mounted) return;
      setState(() {
        _standing = standing;
        _checking = false;
      });
    } catch (_) {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      final spinner = const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppColors.primaryMaroon),
        ),
      );
      return widget.lockedBuilder?.call(context, spinner) ?? spinner;
    }
    if (isRestricted(_standing)) {
      final locked = FeatureLockedView(message: restrictionReason(_standing));
      return widget.lockedBuilder?.call(context, locked) ?? locked;
    }
    return widget.child;
  }
}

/// Compact "Feature Locked" notice above a module/activity list whose items
/// the server returned as `locked` (titles stay visible, content doesn't).
class LockedListNotice extends StatelessWidget {
  final List<Map<String, dynamic>> items;

  const LockedListNotice({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    if (!items.any((m) => m['locked'] == true)) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.errorLight,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.35)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline, color: AppColors.error, size: 20),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Feature Locked — $kRestrictionReason',
              style: TextStyle(fontSize: 12.5, height: 1.4, color: AppColors.error, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
