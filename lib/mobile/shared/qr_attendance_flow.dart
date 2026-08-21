import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_view.dart';

/// Shared QR attendance screen used by both the CWTS and ROTC scanners.
///
/// The visual design is the original one (black screen, white 280×280 frame,
/// helper text, maroon action button). What changed is the behaviour behind the
/// button: it now posts the scanned session code to the API, which validates
/// the session window, blocks duplicate attendance, records the row, and emails
/// a verification code that this screen then confirms.
///
/// The project has no camera plugin, so the code is entered/pasted in a sheet.
/// Swapping in a real scanner later only means calling [submitSessionCode] with
/// the decoded QR payload.
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () {
            Navigator.pop(context);
            widget.onBackToDashboard?.call();
          },
        ),
        title: const Text(
          'Scan QR Code',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          const SizedBox(height: 40),
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
          const SizedBox(height: 40),
          Expanded(
            child: Center(
              child: Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white, width: 2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    color: Colors.grey.shade900,
                    child: Center(
                      child: _isBusy
                          ? const CircularProgressIndicator(
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(Colors.white54),
                            )
                          : const Icon(
                              Icons.qr_code_scanner,
                              color: Colors.white24,
                              size: 100,
                            ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 40),
          Padding(
            padding: const EdgeInsets.all(20),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isBusy ? null : _promptForSessionCode,
                style: ElevatedButton.styleFrom(
                  backgroundColor: widget.accentColor,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor:
                      widget.accentColor.withValues(alpha: 0.5),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Scan Attendance QR',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  /// Collects the QR payload, then hands it to [submitSessionCode].
  Future<void> _promptForSessionCode() async {
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
            Text(
              'Enter the code shown under the officer\'s QR code.',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                hintText: 'NSTP-CWTS-XXXXXXXX',
                hintStyle:
                    TextStyle(fontSize: 13, color: Colors.grey.shade400),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
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
            child: Text(
              'Cancel',
              style: TextStyle(color: Colors.grey.shade700),
            ),
          ),
          ElevatedButton(
            onPressed: () =>
                Navigator.pop(dialogContext, controller.text.trim()),
            style: ElevatedButton.styleFrom(
              backgroundColor: widget.accentColor,
              foregroundColor: Colors.white,
              elevation: 0,
            ),
            child: const Text('Scan'),
          ),
        ],
      ),
    );

    controller.dispose();
    if (code == null || code.isEmpty) return;
    await submitSessionCode(code);
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
        message: Fmt.str(result['message']),
        devCode: Fmt.str(result['devVerificationCode']),
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
    required String message,
    required String devCode,
  }) async {
    final controller = TextEditingController(text: devCode);

    final entered = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Text(
          'Verify Attendance',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.isEmpty
                  ? 'Enter the 6-digit code sent to your email.'
                  : message,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
            ),
            if (devCode.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF9E6),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Text(
                  'Development mode: email is not configured, so the code is '
                  'filled in for you.',
                  style: TextStyle(
                      fontSize: 11, color: Colors.amber.shade900, height: 1.3),
                ),
              ),
            ],
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
                hintStyle: TextStyle(
                  color: Colors.grey.shade300,
                  letterSpacing: 8,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
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
                color: status == 'Late'
                    ? Colors.orange.shade800
                    : Colors.green.shade700,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(
              'Cancel',
              style: TextStyle(color: Colors.grey.shade700),
            ),
          ),
          ElevatedButton(
            onPressed: () =>
                Navigator.pop(dialogContext, controller.text.trim()),
            style: ElevatedButton.styleFrom(
              backgroundColor: widget.accentColor,
              foregroundColor: Colors.white,
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
      await _showSuccessDialog(Fmt.str(
        result['message'],
        'Attendance recorded.',
      ));
    } catch (error) {
      if (!mounted) return;
      setState(() => _isBusy = false);
      AppSnack.error(context, describeError(error));
    }
  }

  Future<void> _showSuccessDialog(String message) async {
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
                decoration: BoxDecoration(
                  color: Colors.green.shade100,
                  shape: BoxShape.circle,
                ),
                child:
                    Icon(Icons.check, color: Colors.green.shade600, size: 32),
              ),
              const SizedBox(height: 20),
              const Text(
                'Attendance Recorded!',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade600,
                  height: 1.4,
                ),
              ),
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
                    foregroundColor: Colors.white,
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
}
