import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';

/// Requirement checklist, backed by the documents collection.
/// Uploading attaches the real file and moves the item to "Under Review".
class CwtsDocumentsScreen extends StatefulWidget {
  const CwtsDocumentsScreen({super.key});

  @override
  State<CwtsDocumentsScreen> createState() => _CwtsDocumentsScreenState();
}

class _CwtsDocumentsScreenState extends State<CwtsDocumentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  LoadState _state = LoadState.loading;
  String _error = '';

  List<Map<String, dynamic>> uploadedDocs = const [];
  List<Map<String, dynamic>> pendingDocs = const [];

  /// Offered when the officer has no checklist row for them yet.
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
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final result = await DocumentService.instance.mine();
      if (!mounted) return;
      final uploaded = (result['uploaded'] as List).cast<Map<String, dynamic>>();
      final pending = (result['pending'] as List).cast<Map<String, dynamic>>();
      setState(() {
        uploadedDocs = uploaded;
        pendingDocs = pending;
        _state = (uploaded.isEmpty && pending.isEmpty)
            ? LoadState.empty
            : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  /// Asks which requirement is being uploaded, then attaches the file.
  Future<void> _uploadDocument({String? presetTitle}) async {
    var title = presetTitle;

    if (title == null) {
      final known = {
        ...uploadedDocs.map((d) => Fmt.str(d['title'])),
        ...pendingDocs.map((d) => Fmt.str(d['title'])),
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

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'],
      );
      if (result == null || result.files.isEmpty || !mounted) return;

      await DocumentService.instance.upload(
        title: title,
        filePath: result.files.first.path,
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
          // Tab Bar (colors come from the app-wide TabBarTheme).
          Container(
            color: AppColors.white,
            child: TabBar(
              controller: _tabController,
              tabs: [
                Tab(text: 'Uploaded (${uploadedDocs.length})'),
                Tab(text: 'Pending (${pendingDocs.length})'),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          // Tab Content
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No documents on file yet.',
              emptyIcon: Icons.folder_open_outlined,
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildDocList(
                    uploadedDocs,
                    emptyText: 'Nothing uploaded yet.',
                    emptyIcon: Icons.cloud_upload_outlined,
                    dateField: 'uploadedAt',
                    datePrefix: 'Uploaded on',
                    fallbackStatus: 'Uploaded',
                  ),
                  _buildDocList(
                    pendingDocs,
                    emptyText: 'All requirements are submitted.',
                    emptyIcon: Icons.verified_outlined,
                    dateField: 'createdAt',
                    datePrefix: 'Requested',
                    fallbackStatus: 'Missing',
                  ),
                ],
              ),
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

  Widget _buildDocList(
    List<Map<String, dynamic>> docs, {
    required String emptyText,
    required IconData emptyIcon,
    required String dateField,
    required String datePrefix,
    required String fallbackStatus,
  }) {
    if (docs.isEmpty) {
      return AsyncView(
        state: LoadState.empty,
        emptyText: emptyText,
        emptyIcon: emptyIcon,
        child: const SizedBox.shrink(),
      );
    }

    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: _load,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: docs.length,
        itemBuilder: (context, index) {
          final doc = docs[index];
          final title = Fmt.str(doc['title'], 'Document');
          final status = Fmt.str(doc['status'], fallbackStatus);
          final style = StatusStyle.of(status);

          return AppCard(
            margin: const EdgeInsets.only(bottom: 12),
            onTap: () => _uploadDocument(presetTitle: title),
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
              ],
            ),
          );
        },
      ),
    );
  }
}
