import 'package:flutter/material.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/attachment_preview_screen.dart';
import '../../../../core/widgets/status_badge.dart';

class CwtsOfficerAnnouncementScreen extends StatefulWidget {
  const CwtsOfficerAnnouncementScreen({super.key});

  @override
  State<CwtsOfficerAnnouncementScreen> createState() =>
      _CwtsOfficerAnnouncementScreenState();
}

class _CwtsOfficerAnnouncementScreenState
    extends State<CwtsOfficerAnnouncementScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _announcements = const [];

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
      final items = await AnnouncementService.instance.list(
        program: Session.instance.program,
      );
      if (!mounted) return;
      setState(() {
        _announcements = items;
        _state = items.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  Future<void> _openEditor({Map<String, dynamic>? existing}) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppColors.radius),
        ),
      ),
      builder: (_) => _AnnouncementEditor(existing: existing),
    );

    if (saved == true) await _load();
  }

  Future<void> _delete(Map<String, dynamic> announcement) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Delete announcement?',
      message:
          'This removes "${Fmt.str(announcement['title'], 'this announcement')}" permanently.',
      confirmLabel: 'Delete',
    );

    if (!confirmed || !mounted) return;

    try {
      await AnnouncementService.instance.delete(Fmt.str(announcement['_id']));
      if (!mounted) return;
      AppSnack.success(context, 'Announcement deleted.');
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  Future<void> _resend(Map<String, dynamic> announcement) async {
    try {
      final count = await AnnouncementService.instance.send(
        Fmt.str(announcement['_id']),
      );
      if (!mounted) return;
      AppSnack.success(context, 'Sent to $count user(s).');
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Announcements',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _load,
          ),
          IconButton(
            icon: const Icon(Icons.add, color: Colors.white),
            onPressed: () => _openEditor(),
          ),
        ],
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        emptyText: 'No announcements yet. Tap + to post one.',
        emptyIcon: Icons.campaign_outlined,
        child: RefreshIndicator(
          color: AppColors.primaryMaroon,
          onRefresh: _load,
          child: ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            itemCount: _announcements.length,
            itemBuilder: (context, index) {
              return _buildAnnouncementCard(_announcements[index]);
            },
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openEditor(),
        backgroundColor: AppColors.primaryMaroon,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildAnnouncementCard(Map<String, dynamic> announcement) {
    final isPinned = announcement['isPinned'] == true;
    final status = Fmt.str(announcement['status'], 'Published');
    final imageUrl = Fmt.str(announcement['imageUrl']);

    return AppCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The program's AnnouncementTemplate poster, if one composited an
          // image for this announcement at post time (see admin/src/utils/
          // announcementGenerator.js) — tap to view full-screen.
          if (imageUrl.isNotEmpty) ...[
            GestureDetector(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => AttachmentPreviewScreen(
                    fileUrl: imageUrl,
                    fileName: Fmt.str(
                      announcement['imageName'],
                      'announcement.png',
                    ),
                  ),
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.network(
                    AppConfig.resolveFileUrl(imageUrl),
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) =>
                        const ColoredBox(color: AppColors.grey100),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isPinned ? AppColors.goldLight : AppColors.orangeLight,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                child: Icon(
                  Icons.campaign,
                  color: isPinned ? AppColors.primaryDark : AppColors.orange,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      Fmt.str(announcement['title'], 'Announcement'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        Fmt.date(announcement['date']),
                        Fmt.str(announcement['location']),
                        Fmt.str(announcement['targetAudience'], 'All'),
                      ].where((s) => s.isNotEmpty && s != '—').join(' • '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              StatusBadge(status, dense: true),
              if (isPinned)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.goldLight,
                    borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.push_pin,
                        size: 11,
                        color: AppColors.primaryDark,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Pinned',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryDark,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            Fmt.str(announcement['content'], 'No details provided.'),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              _buildActionButton(
                icon: Icons.send_outlined,
                label: 'Send',
                onTap: () => _resend(announcement),
              ),
              const SizedBox(width: 8),
              _buildActionButton(
                icon: Icons.edit_outlined,
                label: 'Edit',
                onTap: () => _openEditor(existing: announcement),
              ),
              const SizedBox(width: 8),
              _buildActionButton(
                icon: Icons.delete_outline,
                label: 'Delete',
                onTap: () => _delete(announcement),
                isDestructive: true,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isDestructive ? AppColors.errorLight : AppColors.grey100,
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isDestructive ? AppColors.error : AppColors.textSecondary,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isDestructive
                    ? AppColors.error
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Create / edit sheet shared by the + button and the Edit action.
class _AnnouncementEditor extends StatefulWidget {
  final Map<String, dynamic>? existing;

  const _AnnouncementEditor({this.existing});

  @override
  State<_AnnouncementEditor> createState() => _AnnouncementEditorState();
}

class _AnnouncementEditorState extends State<_AnnouncementEditor> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _contentController = TextEditingController();
  final TextEditingController _locationController = TextEditingController();
  final TextEditingController _timeController = TextEditingController();

  String _audience = 'All';
  DateTime _date = DateTime.now();
  bool _isPinned = false;
  bool _isSaving = false;

  static const List<String> _audiences = [
    'All',
    'Students',
    'Cadets',
    'Officers',
  ];

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _titleController.text = Fmt.str(existing['title']);
      _contentController.text = Fmt.str(existing['content']);
      _locationController.text = Fmt.str(existing['location']);
      _timeController.text = Fmt.str(existing['time']);
      _audience = _audiences.contains(Fmt.str(existing['targetAudience']))
          ? Fmt.str(existing['targetAudience'])
          : 'All';
      _date = Fmt.parse(existing['date']) ?? DateTime.now();
      _isPinned = existing['isPinned'] == true;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    _locationController.dispose();
    _timeController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2024),
      lastDate: DateTime(2030),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: AppColors.primaryMaroon,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    if (_titleController.text.trim().isEmpty) {
      AppSnack.error(context, 'Please enter a title.');
      return;
    }
    if (_contentController.text.trim().isEmpty) {
      AppSnack.error(context, 'Please enter the announcement details.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      if (_isEditing) {
        await AnnouncementService.instance
            .update(Fmt.str(widget.existing!['_id']), {
              'title': _titleController.text.trim(),
              'content': _contentController.text.trim(),
              'location': _locationController.text.trim(),
              'time': _timeController.text.trim(),
              'targetAudience': _audience,
              'date': _date.toIso8601String(),
              'isPinned': _isPinned,
            });
      } else {
        await AnnouncementService.instance.create(
          title: _titleController.text.trim(),
          content: _contentController.text.trim(),
          program: Session.instance.program,
          targetAudience: _audience,
          location: _locationController.text.trim(),
          time: _timeController.text.trim(),
          date: _date,
          isPinned: _isPinned,
        );
      }

      if (!mounted) return;
      AppSnack.success(
        context,
        _isEditing ? 'Announcement updated.' : 'Announcement posted.',
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: DraggableScrollableSheet(
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        expand: false,
        builder: (context, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.all(20),
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              _isEditing ? 'Edit Announcement' : 'New Announcement',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),

            _label('Title'),
            const SizedBox(height: 8),
            _field(_titleController, 'e.g. Coastal Clean-Up Activity'),
            const SizedBox(height: 16),

            _label('Details'),
            const SizedBox(height: 8),
            _field(_contentController, 'Write the announcement…', maxLines: 5),
            const SizedBox(height: 16),

            _label('Send to'),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  isExpanded: true,
                  value: _audience,
                  icon: const Icon(
                    Icons.keyboard_arrow_down,
                    color: AppColors.textSecondary,
                  ),
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.textPrimary,
                  ),
                  onChanged: (v) => setState(() => _audience = v!),
                  items: _audiences
                      .map((a) => DropdownMenuItem(value: a, child: Text(a)))
                      .toList(),
                ),
              ),
            ),
            const SizedBox(height: 16),

            _label('Date'),
            const SizedBox(height: 8),
            InkWell(
              onTap: _pickDate,
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        Fmt.dateWithDay(_date),
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    const Icon(
                      Icons.calendar_today_outlined,
                      size: 18,
                      color: AppColors.textSecondary,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Time'),
                      const SizedBox(height: 8),
                      _field(_timeController, 'e.g. 8:00 AM'),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Location'),
                      const SizedBox(height: 8),
                      _field(_locationController, 'e.g. MARSU Gym'),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            CheckboxListTile(
              value: _isPinned,
              onChanged: (v) => setState(() => _isPinned = v ?? false),
              activeColor: AppColors.primaryMaroon,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                'Pin to the top',
                style: TextStyle(fontSize: 13, color: AppColors.textPrimary),
              ),
            ),
            const SizedBox(height: 12),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  disabledBackgroundColor: AppColors.grey300,
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            Colors.white,
                          ),
                        ),
                      )
                    : Text(
                        _isEditing ? 'Save Changes' : 'Post Announcement',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Text(
    text,
    style: const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: AppColors.textPrimary,
    ),
  );

  Widget _field(
    TextEditingController controller,
    String hint, {
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      decoration: InputDecoration(
        hintText: hint,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
      ),
    );
  }
}
