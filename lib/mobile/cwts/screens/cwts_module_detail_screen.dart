import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/services/services.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/attachment_preview_screen.dart';

/// Read-only view of a posted module's full content — description, every
/// instruction line, and the officer's attached file — for modules with no
/// deadline (pure reference material, not a gradable requirement). Modules
/// *with* a deadline are graded requirements and open through
/// [CwtsActivityDetailScreen] instead, which adds the submission workflow.
class CwtsModuleDetailScreen extends StatefulWidget {
  final String moduleId;
  final String title;

  const CwtsModuleDetailScreen({
    super.key,
    required this.moduleId,
    required this.title,
  });

  @override
  State<CwtsModuleDetailScreen> createState() => _CwtsModuleDetailScreenState();
}

class _CwtsModuleDetailScreenState extends State<CwtsModuleDetailScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  Map<String, dynamic> _module = const {};

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
      final data = await ModuleService.instance.get(widget.moduleId);
      if (!mounted) return;
      setState(() {
        _module = data;
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

  List<String> _instructions() {
    final raw = (_module['instructions'] as List?) ?? const [];
    return raw.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
  }

  void _openAttachment(String fileUrl) {
    openAttachmentPreview(
      context,
      fileUrl: fileUrl,
      fileName: Fmt.str(_module['fileName'], 'Attachment'),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          Fmt.str(_module['title'], widget.title),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: AppColors.white, fontSize: 17, fontWeight: FontWeight.w600),
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
              AppCard(
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.blueLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.menu_book, color: AppColors.blue, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            Fmt.str(_module['title'], widget.title),
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Posted ${Fmt.date(_module['createdAt'])}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              const SectionHeader(title: 'Description'),
              const SizedBox(height: 8),
              Text(
                Fmt.str(_module['description'], 'No description was provided for this module.'),
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.5),
              ),
              const SizedBox(height: 20),

              if (_instructions().isNotEmpty) ...[
                const SectionHeader(title: 'Instructions'),
                const SizedBox(height: 10),
                ..._instructions().map(
                  (line) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _buildBulletPoint(line),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              const SectionHeader(title: 'Attachment'),
              const SizedBox(height: 10),
              _buildAttachmentCard(),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAttachmentCard() {
    final fileUrl = Fmt.str(_module['fileUrl']);
    final fileName = Fmt.str(_module['fileName'], 'No attachment');

    return AppCard(
      padding: const EdgeInsets.all(14),
      onTap: fileUrl.isEmpty ? null : () => _openAttachment(fileUrl),
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
                  fileUrl.isEmpty ? 'Nothing attached for this module' : Fmt.fileSize(_module['fileSize']),
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          Icon(
            Icons.visibility_outlined,
            color: fileUrl.isEmpty ? AppColors.textSecondary : AppColors.primaryMaroon,
            size: 22,
          ),
        ],
      ),
    );
  }

  Widget _buildBulletPoint(String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 6),
          width: 5,
          height: 5,
          decoration: const BoxDecoration(color: AppColors.textSecondary, shape: BoxShape.circle),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
          ),
        ),
      ],
    );
  }
}
