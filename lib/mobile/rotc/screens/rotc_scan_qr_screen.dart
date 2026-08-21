import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../shared/qr_attendance_flow.dart';

/// Cadet QR attendance — same real scan → email code → verify flow as CWTS,
/// scoped to ROTC sessions by the API.
class RotcScanQrScreen extends StatelessWidget {
  final VoidCallback? onBackToDashboard;

  const RotcScanQrScreen({super.key, this.onBackToDashboard});

  @override
  Widget build(BuildContext context) {
    return QrAttendanceScaffold(
      accentColor: AppColors.primaryMaroon,
      onBackToDashboard: onBackToDashboard,
    );
  }
}
