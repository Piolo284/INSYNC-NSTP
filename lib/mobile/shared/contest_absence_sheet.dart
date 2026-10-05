import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/widgets/app_dialogs.dart';
import '../../core/widgets/async_view.dart';

/// Opens the "Contest this absence" form for one Absent attendance record.
/// Shared by both the CWTS trainee and ROTC cadet attendance screens — the
/// dispute flow (reason + optional evidence image, officer reviews) is
/// identical for both programs. Returns `true` if a contest was filed, so
/// the caller can refresh its list.
Future<bool?> showContestAbsenceSheet(
  BuildContext context, {
  required String attendanceId,
  required String activityTitle,
  required String date,
}) {
  return showAppBottomSheet<bool>(
    context,
    title: 'Contest This Absence',
    child: _ContestAbsenceForm(
      attendanceId: attendanceId,
      activityTitle: activityTitle,
      date: date,
    ),
  );
}

class _ContestAbsenceForm extends StatefulWidget {
  final String attendanceId;
  final String activityTitle;
  final String date;

  const _ContestAbsenceForm({
    required this.attendanceId,
    required this.activityTitle,
    required this.date,
  });

  @override
  State<_ContestAbsenceForm> createState() => _ContestAbsenceFormState();
}

class _ContestAbsenceFormState extends State<_ContestAbsenceForm> {
  final TextEditingController _reasonController = TextEditingController();
  PlatformFile? _pickedFile;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  bool get _hasAttachment => _pickedFile != null;

  Future<void> _pickAttachment() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        // Web never returns a real filesystem path — only bytes — so the
        // upload has to travel as bytes for the attachment to actually
        // reach the officer reviewing the contest.
        withData: true,
      );
      final file = result?.files.first;
      if (file == null || !mounted) return;
      setState(() => _pickedFile = file);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  Future<void> _submit() async {
    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      AppSnack.error(context, 'Please explain why you were absent.');
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await AttendanceService.instance.fileContest(
        attendanceId: widget.attendanceId,
        reason: reason,
        filePath: kIsWeb ? null : _pickedFile?.path,
        fileBytes: _pickedFile?.bytes,
        fileName: _pickedFile?.name,
      );
      if (!mounted) return;
      AppSnack.success(context, 'Your contest was submitted for review.');
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${widget.activityTitle} — ${widget.date}',
          style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 16),
        const Text(
          'Reason',
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _reasonController,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Explain why you were absent that day or session...',
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Evidence (optional)',
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            border: Border.all(color: _hasAttachment ? AppColors.primaryMaroon : AppColors.border),
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
          ),
          child: Row(
            children: [
              Icon(
                _hasAttachment ? Icons.check_circle : Icons.image_outlined,
                color: AppColors.primaryMaroon,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _hasAttachment
                      ? _pickedFile!.name
                      : 'e.g. a medical certificate photo',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: _hasAttachment ? AppColors.primaryMaroon : AppColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: _isSubmitting ? null : _pickAttachment,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primaryMaroon,
                  side: const BorderSide(color: AppColors.primaryMaroon),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                child: Text(_hasAttachment ? 'Change' : 'Attach'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: _isSubmitting ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.white),
                    ),
                  )
                : const Text('Submit for Review'),
          ),
        ),
      ],
    );
  }
}
