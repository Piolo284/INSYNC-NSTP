import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';

const _imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

/// Mirrors backend/config/constants.js's DOCUMENT_TYPE_RULES — keeps the
/// picker from even offering a file type/size the server will reject, so a
/// trainee finds out before typing through the whole upload flow instead of
/// after. The server re-checks independently; this is UX only.
class _DocRule {
  const _DocRule(this.accept, this.maxMb);
  final List<String> accept; // 'image' and/or 'pdf'
  final int maxMb;
}

const _docTypeRules = <String, _DocRule>{
  'Registration Form': _DocRule(['pdf'], 5),
  'Parent Consent Form': _DocRule(['pdf'], 5),
  'Brigade Clearance': _DocRule(['pdf'], 5),
  'Medical Certificate': _DocRule(['pdf', 'image'], 5),
  'PWD ID (if applicable)': _DocRule(['pdf', 'image'], 5),
  '2 x 2 Picture': _DocRule(['image'], 1),
};
const _docTypeDefaultRule = _DocRule(['pdf', 'image'], 5);

_DocRule _ruleFor(String title) => _docTypeRules[title] ?? _docTypeDefaultRule;

List<String> _extensionsFor(_DocRule rule) => [
      if (rule.accept.contains('pdf')) 'pdf',
      if (rule.accept.contains('image')) ...['png', 'jpg', 'jpeg'],
    ];

/// Requirement checklist, backed by the documents collection.
/// Uploading attaches the real file and moves the item to "Under Review".
class CwtsDocumentsScreen extends StatefulWidget {
  const CwtsDocumentsScreen({super.key});

  @override
  State<CwtsDocumentsScreen> createState() => _CwtsDocumentsScreenState();
}

class _CwtsDocumentsScreenState extends State<CwtsDocumentsScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';

  List<Map<String, dynamic>> _docs = const [];

  /// Offered when the trainee has no checklist row for them yet.
  static const List<String> _standardDocuments = [
    'Registration Form',
    'Medical Certificate',
    'PWD ID (if applicable)',
    'Parent Consent Form',
    '2 x 2 Picture',
    'Brigade Clearance',
  ];

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
      final result = await DocumentService.instance.mine();
      if (!mounted) return;
      final all = (result['all'] as List).cast<Map<String, dynamic>>();
      setState(() {
        _docs = all;
        _state = all.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  /// Opens an already-uploaded file in an external viewer instead of the
  /// picker, so a trainee can check what they actually submitted.
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

  /// Shows what was actually picked — an image preview, or a file icon plus
  /// name/size for anything else — and waits for an explicit confirm before
  /// anything is sent to the server.
  Future<bool> _confirmUpload(PlatformFile file) async {
    final ext = (file.extension ?? '').toLowerCase();
    final isImage = _imageExtensions.contains(ext) && file.bytes != null;

    final confirmed = await showAppBottomSheet<bool>(
      context,
      title: 'Confirm Upload',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: 180,
            decoration: BoxDecoration(
              color: AppColors.grey100,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            clipBehavior: Clip.antiAlias,
            child: isImage
                ? Image.memory(Uint8List.fromList(file.bytes!), fit: BoxFit.contain)
                : Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.insert_drive_file_outlined,
                            size: 44, color: AppColors.textSecondary),
                        const SizedBox(height: 8),
                        Text(
                          ext.isEmpty ? 'FILE' : ext.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
          const SizedBox(height: 14),
          Text(
            file.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            Fmt.fileSize(file.size),
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 20),
          Builder(
            builder: (sheetContext) => Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(sheetContext, false),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(sheetContext, true),
                    child: const Text('Upload'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  /// Asks which requirement is being uploaded, then attaches the file.
  Future<void> _uploadDocument({String? presetTitle}) async {
    var title = presetTitle;

    if (title == null) {
      final known = {
        ..._docs.map((d) => Fmt.str(d['title'])),
        ..._standardDocuments,
      }.where((t) => t.isNotEmpty).toList()
        ..sort();

      title = await showAppBottomSheet<String>(
        context,
        title: 'Which document are you uploading?',
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.5,
          ),
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: known.length,
            itemBuilder: (sheetContext, index) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.description_outlined,
                  color: AppColors.primaryMaroon, size: 20),
              title: Text(known[index], style: const TextStyle(fontSize: 14)),
              onTap: () => Navigator.pop(sheetContext, known[index]),
            ),
          ),
        ),
      );
    }

    if (title == null || !mounted) return;

    final rule = _ruleFor(title);

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: _extensionsFor(rule),
        // Web never returns a real filesystem path — only bytes — so the
        // upload has to travel as bytes for the document to actually reach
        // the server.
        withData: true,
      );
      if (result == null || result.files.isEmpty || !mounted) return;

      final file = result.files.first;
      if (file.size > rule.maxMb * 1024 * 1024) {
        AppSnack.error(context, '$title must be ${rule.maxMb}MB or smaller.');
        return;
      }

      final confirmed = await _confirmUpload(file);
      if (!confirmed || !mounted) return;

      await DocumentService.instance.upload(
        title: title,
        // PlatformFile.path throws just by being read on web — never access
        // it there. fileBytes (always populated via withData: true above)
        // is what actually carries the upload on every platform anyway.
        filePath: kIsWeb ? null : file.path,
        fileBytes: file.bytes,
        fileName: file.name,
      );

      if (!mounted) return;
      AppSnack.success(context, '$title uploaded for review.');
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
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
          'Documents',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No documents on file yet.',
              emptyIcon: Icons.folder_open_outlined,
              child: _buildDocList(),
            ),
          ),
          // Bottom Button
          Container(
            color: AppColors.white,
            padding: const EdgeInsets.all(20),
            child: SafeArea(
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () => _uploadDocument(),
                  child: const Text(
                    'Upload New Document',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocList() {
    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: _load,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: _docs.length,
        itemBuilder: (context, index) {
          final doc = _docs[index];
          final title = Fmt.str(doc['title'], 'Document');
          final status = Fmt.str(doc['status'], 'Missing');
          final style = StatusStyle.of(status);
          final fileUrl = Fmt.str(doc['fileUrl']);
          final hasFile = fileUrl.isNotEmpty;
          final dateField = hasFile ? 'uploadedAt' : 'createdAt';
          final datePrefix = hasFile ? 'Uploaded on' : 'Requested';

          return AppCard(
            margin: const EdgeInsets.only(bottom: 12),
            // Already-uploaded requirements open the actual file so a
            // trainee can check what they submitted; requirements with
            // nothing on file yet go straight to the picker.
            onTap: hasFile
                ? () => _openFile(fileUrl)
                : () => _uploadDocument(presetTitle: title),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: style.background,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.description_outlined, color: style.color, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$datePrefix ${Fmt.date(doc[dateField], fallback: '—')}',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusBadge(status, dense: true),
                if (hasFile)
                  IconButton(
                    icon: const Icon(Icons.file_upload_outlined, size: 18),
                    color: AppColors.textSecondary,
                    tooltip: 'Replace file',
                    onPressed: () => _uploadDocument(presetTitle: title),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
