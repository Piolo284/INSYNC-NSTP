import 'package:flutter/material.dart';
import 'cwts_officer_document_review_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Officer's review queue for documents uploaded by the trainees they
/// supervise (own program/brigade) — not a self-upload screen. An officer
/// never uploads their own documents here, only approves/rejects theirs.
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

  List<Map<String, dynamic>> _pendingDocs = const [];
  List<Map<String, dynamic>> _reviewedDocs = const [];

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
      final docs = await DocumentService.instance.reviewQueue();
      if (!mounted) return;
      final uploaded = docs.where((d) => Fmt.str(d['fileUrl']).isNotEmpty).toList();
      setState(() {
        _pendingDocs = uploaded
            .where((d) => !['Approved', 'Rejected'].contains(Fmt.str(d['status'])))
            .toList();
        _reviewedDocs = uploaded
            .where((d) => ['Approved', 'Rejected'].contains(Fmt.str(d['status'])))
            .toList();
        _state = docs.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  Future<void> _openDocument(Map<String, dynamic> doc) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CwtsOfficerDocumentReviewScreen(document: doc),
      ),
    );
    if (changed == true) await _load();
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
          'Document Review',
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
          Container(
            color: AppColors.white,
            child: TabBar(
              controller: _tabController,
              tabs: [
                Tab(text: 'Pending (${_pendingDocs.length})'),
                Tab(text: 'Reviewed (${_reviewedDocs.length})'),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No trainee documents on file yet.',
              emptyIcon: Icons.folder_open_outlined,
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildDocList(
                    _pendingDocs,
                    emptyText: 'Nothing waiting for review.',
                    emptyIcon: Icons.task_alt_outlined,
                  ),
                  _buildDocList(
                    _reviewedDocs,
                    emptyText: 'No documents reviewed yet.',
                    emptyIcon: Icons.history_outlined,
                  ),
                ],
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
          final status = Fmt.str(doc['status'], 'Under Review');

          return AppCard(
            margin: const EdgeInsets.only(bottom: 12),
            onTap: () => _openDocument(doc),
            child: Row(
              children: [
                UserAvatar(imagePath: Fmt.str(doc['ownerProfileImage']), radius: 20, iconSize: 18),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        Fmt.str(doc['ownerName'], 'Trainee'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Uploaded ${Fmt.date(doc['uploadedAt'], fallback: '—')}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
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
