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

/// Officer reviews one trainee-uploaded document: preview it, then
/// Approve/Reject. Mirrors the attendance-contest review screen's shape.
class CwtsOfficerDocumentReviewScreen extends StatefulWidget {
  final Map<String, dynamic> document;

  const CwtsOfficerDocumentReviewScreen({super.key, required this.document});

  @override
  State<CwtsOfficerDocumentReviewScreen> createState() =>
      _CwtsOfficerDocumentReviewScreenState();
}

class _CwtsOfficerDocumentReviewScreenState
    extends State<CwtsOfficerDocumentReviewScreen> {
  bool _isSaving = false;
  late String _status;

  @override
  void initState() {
    super.initState();
    _status = Fmt.str(widget.document['status'], 'Under Review');
  }

  bool get _isDecided => _status == 'Approved' || _status == 'Rejected';

  Future<void> _openFile(String fileUrl) async {
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
      await DocumentService.instance.review(
        Fmt.str(widget.document['_id']),
        status: status,
      );
      if (!mounted) return;
      setState(() => _status = status);
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
                approved ? 'Document Approved' : 'Document Rejected',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                approved
                    ? 'The trainee will be notified that this document was accepted.'
                    : 'The trainee will be notified to re-upload this document.',
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
    final doc = widget.document;
    final fileUrl = Fmt.str(doc['fileUrl']);
    final fileName = Fmt.str(doc['fileName'], 'No file');

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
          'Document Review',
          style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w600),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                UserAvatar(imagePath: Fmt.str(doc['ownerProfileImage']), radius: 24, iconSize: 24),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        Fmt.str(doc['ownerName'], 'Trainee'),
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        Fmt.str(doc['ownerIdNumber']),
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                StatusBadge(_status),
              ],
            ),
            const Divider(height: 32),

            const SectionHeader(title: 'Document'),
            const SizedBox(height: 10),
            AppCard(
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
                          Fmt.str(doc['title'], 'Document'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          fileUrl.isEmpty ? 'Not uploaded yet' : '$fileName • ${Fmt.fileSize(doc['fileSize'])}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
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
                    onPressed: fileUrl.isEmpty ? null : () => _openFile(fileUrl),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            InfoRow(
              icon: Icons.event_outlined,
              label: 'Uploaded',
              value: Fmt.date(doc['uploadedAt'], fallback: '—'),
            ),
            const SizedBox(height: 20),

            if (fileUrl.isNotEmpty && !_isDecided) ...[
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
            ] else if (!_isDecided) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.grey50,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Text(
                  'This trainee has not uploaded this document yet — nothing to review.',
                  style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
                ),
              ),
            ],
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
