import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/attachment_preview_screen.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Officer reviews one absence dispute: the trainee's explanation, any
/// supporting document, and one of three decisions (attendanceContestController):
///  * Approve as Excuse  — the record becomes Excused (stays in the history,
///    never counted as an absence);
///  * Approve as Present — the record becomes Present (no longer an absence);
///  * Reject Contest     — the record stays Absent; a reason is required.
/// Either approval recalculates the trainee's absences and at-risk status.
class CwtsOfficerContestDetailScreen extends StatefulWidget {
  final String contestId;

  const CwtsOfficerContestDetailScreen({super.key, required this.contestId});

  @override
  State<CwtsOfficerContestDetailScreen> createState() =>
      _CwtsOfficerContestDetailScreenState();
}

class _CwtsOfficerContestDetailScreenState
    extends State<CwtsOfficerContestDetailScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  Map<String, dynamic> _contest = const {};
  bool _isSaving = false;

  final TextEditingController _noteController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });
    try {
      final data = await AttendanceService.instance.getContest(widget.contestId);
      if (!mounted) return;
      setState(() {
        _contest = data;
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

  Map<String, dynamic> get _student {
    final s = _contest['studentId'];
    return s is Map ? s.cast<String, dynamic>() : const {};
  }

  Map<String, dynamic> get _attendance {
    final a = _contest['attendanceId'];
    return a is Map ? a.cast<String, dynamic>() : const {};
  }

  bool get _isPending => Fmt.str(_contest['status'], 'Pending') == 'Pending';

  /// "Approved as Present" / "Approved as Excuse" / "Rejected" / "Pending".
  String get _decisionLabel {
    final status = Fmt.str(_contest['status'], 'Pending');
    if (status != 'Approved') return status;
    return Fmt.str(_contest['approvedAs'], 'Excused') == 'Present'
        ? 'Approved as Present'
        : 'Approved as Excuse';
  }

  void _openAttachment(String fileUrl) {
    openAttachmentPreview(
      context,
      fileUrl: fileUrl,
      fileName: Fmt.str(_contest['attachmentName'], 'Supporting document'),
    );
  }

  /// [approvedAs] is 'Excused' or 'Present' for an approval, null to reject.
  Future<void> _decide({String? approvedAs}) async {
    final rejecting = approvedAs == null;
    final note = _noteController.text.trim();
    if (rejecting && note.isEmpty) {
      AppSnack.error(context, 'Please write the reason for rejecting this contest.');
      return;
    }

    final String message;
    if (rejecting) {
      message = 'The record stays Absent and keeps counting toward the absence limit.';
    } else if (approvedAs == 'Present') {
      message = 'The record changes to Present and no longer counts as an absence. '
          "The trainee's absence count and at-risk status are recalculated.";
    } else {
      message = 'The record changes to Excused. It stays in the attendance history but does not '
          "count as an absence. The trainee's absence count and at-risk status are recalculated.";
    }
    final confirmed = await showConfirmDialog(
      context,
      title: rejecting
          ? 'Reject Contest?'
          : (approvedAs == 'Present' ? 'Approve as Present?' : 'Approve as Excuse?'),
      message: message,
      confirmLabel: rejecting ? 'Reject' : 'Approve',
      danger: rejecting,
    );
    if (!confirmed || !mounted) return;

    setState(() => _isSaving = true);
    try {
      await AttendanceService.instance.reviewContest(
        widget.contestId,
        status: rejecting ? 'Rejected' : 'Approved',
        approvedAs: approvedAs,
        reviewNote: note,
      );
      if (!mounted) return;
      await _showSuccessDialog(approvedAs);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _showSuccessDialog(String? approvedAs) {
    final approved = approvedAs != null;
    return showDialog<void>(
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
                  color: approved ? AppColors.greenLight : AppColors.errorLight,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  approved ? Icons.check : Icons.close,
                  color: approved ? AppColors.success : AppColors.error,
                  size: 32,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                approved
                    ? (approvedAs == 'Present' ? 'Approved as Present' : 'Approved as Excuse')
                    : 'Contest Rejected',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                approved
                    ? 'The attendance record has been updated to ${approvedAs == 'Present' ? 'Present' : 'Excused'}.'
                    : 'The attendance record stays Absent.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('OK'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Contest Details',
          style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w600),
        ),
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  UserAvatar(imagePath: Fmt.str(_student['profileImage']), radius: 24, iconSize: 24),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          Fmt.str(_student['name'], 'Trainee'),
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          Fmt.str(_student['studentId']),
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  StatusBadge(_decisionLabel),
                ],
              ),
              const Divider(height: 32),

              const SectionHeader(title: 'Attendance Record'),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  children: [
                    InfoRow(
                      icon: Icons.event_note_outlined,
                      label: 'Attendance / Event',
                      value: Fmt.str(_attendance['title'], '—'),
                    ),
                    InfoRow(
                      icon: Icons.calendar_today_outlined,
                      label: 'Date of Absence',
                      value: Fmt.date(_attendance['date']),
                    ),
                    InfoRow(
                      icon: Icons.event_busy_outlined,
                      label: 'Original Status',
                      value: Fmt.str(_contest['originalStatus'], 'Absent'),
                      valueColor: AppColors.error,
                    ),
                    InfoRow(
                      icon: Icons.fact_check_outlined,
                      label: _isPending ? 'Current Status' : 'Final Status',
                      value: Fmt.str(_attendance['status'], 'Absent'),
                      valueColor: _statusColor(Fmt.str(_attendance['status'], 'Absent')),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              const SectionHeader(title: 'Trainee\'s Explanation'),
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.grey50,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  Fmt.str(_contest['reason'], 'No reason provided.'),
                  style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, height: 1.5),
                ),
              ),
              const SizedBox(height: 20),

              const SectionHeader(title: 'Supporting Document'),
              const SizedBox(height: 10),
              _buildAttachmentCard(),
              const SizedBox(height: 20),

              if (_isPending) ...[
                const SectionHeader(title: 'Officer Note / Reason'),
                const SizedBox(height: 8),
                TextField(
                  controller: _noteController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Optional when approving, required when rejecting. The trainee sees it with your decision.',
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isSaving ? null : () => _decide(approvedAs: 'Excused'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.blue,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.assignment_turned_in_outlined, size: 18),
                    label: const Text('Approve as Excuse'),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isSaving ? null : () => _decide(approvedAs: 'Present'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.how_to_reg_outlined, size: 18),
                    label: const Text('Approve as Present'),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _isSaving ? null : () => _decide(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: _isSaving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.error),
                          )
                        : const Icon(Icons.close, size: 18),
                    label: const Text('Reject Contest'),
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Excuse: stays in the history as Excused and is not counted as an absence. '
                  'Present: the absence is removed. Both recalculate the trainee\'s absences and at-risk status.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary, height: 1.4),
                ),
              ] else ...[
                const SectionHeader(title: 'Decision'),
                const SizedBox(height: 10),
                AppCard(
                  child: Column(
                    children: [
                      InfoRow(
                        icon: Icons.gavel_outlined,
                        label: 'Decision',
                        value: _decisionLabel,
                        valueColor: _statusColor(Fmt.str(_contest['status'])),
                      ),
                      InfoRow(
                        icon: Icons.person_outline,
                        label: 'Reviewed by',
                        value: _contest['reviewedBy'] is Map
                            ? Fmt.str((_contest['reviewedBy'] as Map)['name'], '—')
                            : '—',
                      ),
                      InfoRow(
                        icon: Icons.schedule_outlined,
                        label: 'Reviewed on',
                        value: Fmt.dateTime(_contest['reviewedAt']),
                      ),
                    ],
                  ),
                ),
                if (Fmt.str(_contest['reviewNote']).isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const SectionHeader(title: 'Officer Note'),
                  const SizedBox(height: 8),
                  Text(
                    Fmt.str(_contest['reviewNote']),
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                  ),
                ],
              ],
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Present':
      case 'Approved':
        return AppColors.success;
      case 'Excused':
        return AppColors.blue;
      case 'Late':
        return AppColors.lateStatus;
      default:
        return AppColors.error;
    }
  }

  Widget _buildAttachmentCard() {
    final fileUrl = Fmt.str(_contest['attachmentUrl']);
    final fileName = Fmt.str(_contest['attachmentName'], 'No attachment');

    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.orangeLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.description_outlined, color: AppColors.orange, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  fileUrl.isEmpty ? 'The trainee did not attach evidence' : Fmt.fileSize(_contest['attachmentSize']),
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(
              Icons.open_in_new,
              color: fileUrl.isEmpty ? AppColors.textSecondary : AppColors.primaryMaroon,
              size: 20,
            ),
            onPressed: fileUrl.isEmpty ? null : () => _openAttachment(fileUrl),
          ),
        ],
      ),
    );
  }
}
