import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../shared/qr_attendance_flow.dart';

/// Trainee QR attendance. The camera frame stays exactly as designed; the
/// button now runs the real scan → email code → verify flow against MongoDB.
class CwtsScanQrScreen extends StatelessWidget {
  final VoidCallback? onBackToDashboard;

  const CwtsScanQrScreen({super.key, this.onBackToDashboard});

  @override
  Widget build(BuildContext context) {
    return QrAttendanceScaffold(
      accentColor: AppColors.primaryMaroon,
      onBackToDashboard: onBackToDashboard,
    );
  }
}
