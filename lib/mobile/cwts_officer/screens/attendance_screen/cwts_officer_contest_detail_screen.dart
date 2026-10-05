import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Officer reviews one absence dispute: the trainee's reason, any attached
/// evidence, and an Approve/Reject decision. Approving flips the underlying
/// attendance record to Excused server-side (see attendanceContestController).
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

  Future<void> _openAttachment(String fileUrl) async {
    final uri = Uri.tryParse(AppConfig.resolveFileUrl(fileUrl));
    if (uri == null) {
      AppSnack.error(context, 'That file link looks invalid.');
      return;
    }
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened && mounted) {
        AppSnack.error(context, 'Could not open the file. No app is available to view it.');
      }
    } catch (error) {
      if (mounted) AppSnack.error(context, describeError(error));
    }
  }

  Future<void> _decide(String status) async {
    setState(() => _isSaving = true);
    try {
      await AttendanceService.instance.reviewContest(
        widget.contestId,
        status: status,
        reviewNote: _noteController.text.trim(),
      );
      if (!mounted) return;
      await _showSuccessDialog(status);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _showSuccessDialog(String status) {
    final approved = status == 'Approved';
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
                approved ? 'Contest Approved' : 'Contest Rejected',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                approved
                    ? 'The attendance record has been updated to Excused.'
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
                  StatusBadge(Fmt.str(_contest['status'], 'Pending')),
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
                      label: 'Activity',
                      value: Fmt.str(_attendance['title'], '—'),
                    ),
                    InfoRow(
                      icon: Icons.calendar_today_outlined,
                      label: 'Date',
                      value: Fmt.date(_attendance['date']),
                    ),
                    const InfoRow(
                      icon: Icons.event_busy_outlined,
                      label: 'Original Status',
                      value: 'Absent',
                      valueColor: AppColors.error,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              const SectionHeader(title: 'Trainee\'s Reason'),
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

              const SectionHeader(title: 'Evidence'),
              const SizedBox(height: 10),
              _buildAttachmentCard(),
              const SizedBox(height: 20),

              if (_isPending) ...[
                const SectionHeader(title: 'Review Note (optional)'),
                const SizedBox(height: 8),
                TextField(
                  controller: _noteController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Add a note the trainee will see with your decision',
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _isSaving ? null : () => _decide('Rejected'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.error,
                          side: const BorderSide(color: AppColors.error),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Reject'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _isSaving ? null : () => _decide('Approved'),
                        child: _isSaving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.white),
                                ),
                              )
                            : const Text('Approve'),
                      ),
                    ),
                  ],
                ),
              ] else if (Fmt.str(_contest['reviewNote']).isNotEmpty) ...[
                const SectionHeader(title: 'Officer Note'),
                const SizedBox(height: 8),
                Text(
                  Fmt.str(_contest['reviewNote']),
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                ),
              ],
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
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
