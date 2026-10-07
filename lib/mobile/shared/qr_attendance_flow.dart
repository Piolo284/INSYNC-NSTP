import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/status_badge.dart';

/// Shared QR attendance screen used by both the CWTS and ROTC scanners.
///
/// The visual design is the original one (black screen, white 280×280 frame,
/// helper text, maroon action button). What changed is the behaviour behind the
/// button: it now posts the scanned session code to the API, which validates
/// the session window, blocks duplicate attendance, records the row, and emails
/// a verification code that this screen then confirms.
///
/// The 280×280 frame now hosts a live [MobileScanner] camera preview. A
/// successful detection calls [submitSessionCode] with the decoded QR
/// payload, exactly the same call the manual-entry fallback makes — so the
/// rest of the flow (verification-code dialog, success screen) is unaware of
/// how the code was collected. The manual entry sheet is kept as a "Can't
/// scan? Enter code manually" link, for accessibility or when the camera
/// permission is denied.
class QrAttendanceScaffold extends StatefulWidget {
  final Color accentColor;
  final VoidCallback? onBackToDashboard;

  const QrAttendanceScaffold({
    super.key,
    this.accentColor = AppColors.primaryMaroon,
    this.onBackToDashboard,
  });

  @override
  State<QrAttendanceScaffold> createState() => _QrAttendanceScaffoldState();
}

class _QrAttendanceScaffoldState extends State<QrAttendanceScaffold> {
  bool _isBusy = false;

  final MobileScannerController _scannerController = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );

  /// Guards against firing [submitSessionCode] more than once per detected
  /// code while the first submission is still in flight.
  bool _hasPendingDetection = false;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.black,
      appBar: AppBar(
        backgroundColor: AppColors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () {
            Navigator.pop(context);
            widget.onBackToDashboard?.call();
          },
        ),
        title: const Text(
          'Scan QR Code',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          const SizedBox(height: 28),
          // Orients a first-time user: Scan → Verification → Confirmation →
          // Attendance Result. Purely a label — every other step already
          // renders as its own dialog in that same order.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: widget.accentColor.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Text(
              'STEP 1 OF 3 · SCAN',
              style: TextStyle(
                color: Colors.white,
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              'Align the QR code within the frame to scan your attendance',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white70,
                fontSize: 14,
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 32),
          Expanded(
            child: Center(
              child: Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.white, width: 2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    color: Colors.grey.shade900,
                    child: _buildScannerFrame(),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 40),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextButton(
              onPressed: _isBusy ? null : _promptForSessionCode,
              style: TextButton.styleFrom(
                foregroundColor: Colors.white,
              ),
              child: const Text(
                "Can't scan? Enter code manually",
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  /// The live camera preview, or a busy/permission-error state in its place.
  Widget _buildScannerFrame() {
    if (_isBusy) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Colors.white54),
        ),
      );
    }

    return MobileScanner(
      controller: _scannerController,
      onDetect: _onBarcodeDetected,
      errorBuilder: (context, error) => _buildScannerError(error),
      placeholderBuilder: (context) => const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Colors.white54),
        ),
      ),
    );
  }

  Widget _buildScannerError(MobileScannerException error) {
    final isPermissionDenied =
        error.errorCode == MobileScannerErrorCode.permissionDenied;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.no_photography_outlined,
            color: Colors.white24,
            size: 64,
          ),
          const SizedBox(height: 12),
          Text(
            isPermissionDenied
                ? 'Camera permission was denied. Enable it in your device '
                    'settings, or enter the code manually below.'
                : 'Camera unavailable. Enter the code manually below.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
          ),
        ],
      ),
    );
  }

  /// Called by [MobileScanner] whenever it decodes one or more barcodes.
  /// Only the first QR payload of the first detection is used — later
  /// detections are ignored until [_isBusy] clears again.
  void _onBarcodeDetected(BarcodeCapture capture) {
    if (_isBusy || _hasPendingDetection) return;

    final value = capture.barcodes
        .map((barcode) => barcode.rawValue ?? '')
        .firstWhere((v) => v.isNotEmpty, orElse: () => '');
    if (value.isEmpty) return;

    _hasPendingDetection = true;
    submitSessionCode(value.trim()).whenComplete(() {
      _hasPendingDetection = false;
    });
  }

  /// Collects the QR payload, then hands it to [submitSessionCode].
  Future<void> _promptForSessionCode() async {
    // Pause camera detections while the manual-entry dialog is open, so a
    // code caught in the background does not also fire a submission.
    _hasPendingDetection = true;
    final controller = TextEditingController();

    final code = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Text(
          'Attendance QR Code',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter the code shown under the officer\'s QR code.',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                hintText: 'NSTP-CWTS-XXXXXXXX',
                hintStyle:
                    const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.primaryMaroon, width: 1.5),
                ),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 14),
              ),
              onSubmitted: (value) =>
                  Navigator.pop(dialogContext, value.trim()),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () =>
                Navigator.pop(dialogContext, controller.text.trim()),
            style: ElevatedButton.styleFrom(
              backgroundColor: widget.accentColor,
              foregroundColor: AppColors.white,
              elevation: 0,
            ),
            child: const Text('Scan'),
          ),
        ],
      ),
    );

    controller.dispose();
    if (code == null || code.isEmpty) {
      _hasPendingDetection = false;
      return;
    }
    await submitSessionCode(code);
    _hasPendingDetection = false;
  }

  /// Step 1: validate the session and trigger the verification email.
  Future<void> submitSessionCode(String sessionCode) async {
    setState(() => _isBusy = true);

    try {
      final result = await AttendanceService.instance.scan(sessionCode);

      if (!mounted) return;
      setState(() => _isBusy = false);

      await _promptForVerificationCode(
        attendanceId: Fmt.str(result['attendanceId']),
        status: Fmt.str(result['status'], 'Present'),
        time: Fmt.str(result['time']),
        message: Fmt.str(result['message']),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _isBusy = false);
      AppSnack.error(context, describeError(error));
    }
  }

  /// Step 2: confirm the emailed code and finalise the record.
  Future<void> _promptForVerificationCode({
    required String attendanceId,
    required String status,
    required String time,
    required String message,
  }) async {
    // The code only ever arrives by email — the server never returns it, so
    // there is nothing to pre-fill here.
    final controller = TextEditingController();

    final entered = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Text(
          'Verification',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // QR status + scan time, so the trainee can see their scan was
            // read correctly before they go looking for the emailed code.
            Row(
              children: [
                const Icon(Icons.qr_code_2, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                const Text(
                  'QR code recognized',
                  style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                ),
                const Spacer(),
                StatusBadge(status, dense: true),
              ],
            ),
            if (time.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                'Scanned at $time',
                style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
              ),
            ],
            const SizedBox(height: 12),
            Text(
              message.isEmpty
                  ? 'Enter the 6-digit code sent to your email.'
                  : message,
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                letterSpacing: 8,
              ),
              decoration: InputDecoration(
                counterText: '',
                hintText: '000000',
                hintStyle: const TextStyle(
                  color: AppColors.border,
                  letterSpacing: 8,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.primaryMaroon, width: 1.5),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onSubmitted: (value) =>
                  Navigator.pop(dialogContext, value.trim()),
            ),
            const SizedBox(height: 4),
            Text(
              'You will be marked: $status',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: StatusStyle.of(status).color,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () =>
                Navigator.pop(dialogContext, controller.text.trim()),
            style: ElevatedButton.styleFrom(
              backgroundColor: widget.accentColor,
              foregroundColor: AppColors.white,
              elevation: 0,
            ),
            child: const Text('Verify'),
          ),
        ],
      ),
    );

    controller.dispose();
    if (entered == null || entered.isEmpty) return;
    if (!mounted) return;

    setState(() => _isBusy = true);

    try {
      final result = await AttendanceService.instance.verify(
        verificationCode: entered,
        attendanceId: attendanceId.isEmpty ? null : attendanceId,
      );

      if (!mounted) return;
      setState(() => _isBusy = false);
      // `result` is the finalised attendance record (session title, date,
      // time, status) plus the server's confirmation message — all of it
      // already returned by the same `verify` call, just now shown in full
      // instead of only the message string.
      await _showSuccessDialog(
        message: Fmt.str(result['message'], 'Attendance recorded.'),
        sessionTitle: Fmt.str(result['title']),
        date: Fmt.str(result['date']) ,
        time: Fmt.str(result['time']),
        status: Fmt.str(result['status'], 'Present'),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _isBusy = false);
      AppSnack.error(context, describeError(error));
    }
  }

  Future<void> _showSuccessDialog({
    required String message,
    required String sessionTitle,
    required String date,
    required String time,
    required String status,
  }) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: AppColors.greenLight,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, color: AppColors.success, size: 32),
              ),
              const SizedBox(height: 20),
              const Text(
                'Attendance Result',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Attendance Recorded!',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
              if (sessionTitle.isNotEmpty || date.isNotEmpty || time.isNotEmpty) ...[
                const SizedBox(height: 18),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.scaffoldBg,
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                  child: Column(
                    children: [
                      if (sessionTitle.isNotEmpty)
                        _resultRow('Session', sessionTitle),
                      if (date.isNotEmpty) _resultRow('Date', Fmt.date(date)),
                      if (time.isNotEmpty) _resultRow('Time', time),
                      _resultStatusRow('Status', status),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(dialogContext);
                    Navigator.pop(context);
                    widget.onBackToDashboard?.call();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: widget.accentColor,
                    foregroundColor: AppColors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Done',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// One "label: value" line inside the attendance-result summary box.
  Widget _resultRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Same as [_resultRow] but renders the value as a [StatusBadge].
  Widget _resultStatusRow(String label, String status) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const Spacer(),
          StatusBadge(status, dense: true),
        ],
      ),
    );
  }
}
