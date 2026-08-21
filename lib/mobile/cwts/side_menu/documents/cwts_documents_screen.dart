import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '/../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';

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

      title = await showModalBottomSheet<String>(
        context: context,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (sheetContext) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.symmetric(vertical: 16),
            children: [
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Text(
                  'Which document are you uploading?',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
              ),
              ...known.map(
                (t) => ListTile(
                  leading: const Icon(Icons.description_outlined,
                      color: AppColors.primaryMaroon, size: 20),
                  title: Text(t, style: const TextStyle(fontSize: 14)),
                  onTap: () => Navigator.pop(sheetContext, t),
                ),
              ),
            ],
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
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios,
            color: Colors.white,
            size: 20,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Documents',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          // Tab Bar
          Container(
            color: Colors.white,
            child: TabBar(
              controller: _tabController,
              labelColor: AppColors.primaryMaroon,
              unselectedLabelColor: Colors.grey.shade500,
              indicatorColor: AppColors.primaryMaroon,
              indicatorWeight: 2,
              labelStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
              unselectedLabelStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              tabs: [
                Tab(text: 'Uploaded (${uploadedDocs.length})'),
                Tab(text: 'Pending (${pendingDocs.length})'),
              ],
            ),
          ),
          Divider(height: 1, color: Colors.grey.shade200),
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
                  _buildUploadedList(),
                  _buildPendingList(),
                ],
              ),
            ),
          ),
          // Bottom Button
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(20),
            child: SafeArea(
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () => _uploadDocument(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
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

  Widget _buildUploadedList() {
    if (uploadedDocs.isEmpty) {
      return const AsyncView(
        state: LoadState.empty,
        emptyText: 'Nothing uploaded yet.',
        emptyIcon: Icons.cloud_upload_outlined,
        child: SizedBox.shrink(),
      );
    }

    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        itemCount: uploadedDocs.length,
        separatorBuilder: (context, index) => Divider(
          height: 1,
          color: Colors.grey.shade100,
          indent: 56,
        ),
        itemBuilder: (context, index) {
          final doc = uploadedDocs[index];
          return _buildDocumentItem(
            title: Fmt.str(doc['title'], 'Document'),
            subtitle:
                'Uploaded on ${Fmt.date(doc['uploadedAt'], fallback: '—')}',
            isUploaded: true,
            onTap: () => _uploadDocument(presetTitle: Fmt.str(doc['title'])),
          );
        },
      ),
    );
  }

  Widget _buildPendingList() {
    if (pendingDocs.isEmpty) {
      return const AsyncView(
        state: LoadState.empty,
        emptyText: 'All requirements are submitted.',
        emptyIcon: Icons.verified_outlined,
        child: SizedBox.shrink(),
      );
    }

    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        itemCount: pendingDocs.length,
        separatorBuilder: (context, index) => Divider(
          height: 1,
          color: Colors.grey.shade100,
          indent: 56,
        ),
        itemBuilder: (context, index) {
          final doc = pendingDocs[index];
          return _buildPendingItem(
            title: Fmt.str(doc['title'], 'Document'),
            subtitle: 'Requested ${Fmt.date(doc['createdAt'], fallback: '—')}',
            status: Fmt.str(doc['status'], 'Missing'),
            onTap: () => _uploadDocument(presetTitle: Fmt.str(doc['title'])),
          );
        },
      ),
    );
  }

  Widget _buildDocumentItem({
    required String title,
    required String subtitle,
    required bool isUploaded,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            // Document Icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color:
                    isUploaded ? const Color(0xFFE8F5E9) : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.description_outlined,
                color:
                    isUploaded ? Colors.green.shade700 : Colors.grey.shade400,
                size: 22,
              ),
            ),
            const SizedBox(width: 16),
            // Title & Date
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isUploaded ? Colors.black87 : Colors.grey.shade500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ),
            // Checkmark
            if (isUploaded)
              Icon(
                Icons.check_circle,
                color: Colors.green.shade600,
                size: 22,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingItem({
    required String title,
    required String subtitle,
    required String status,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            // Document Icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.description_outlined,
                color: Colors.orange.shade700,
                size: 22,
              ),
            ),
            const SizedBox(width: 16),
            // Title & Date
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ),
            // Status Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                status,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.orange.shade700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
