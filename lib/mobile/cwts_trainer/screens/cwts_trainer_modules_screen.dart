import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:marsu_nstp_portal/core/config/app_config.dart';
import 'package:marsu_nstp_portal/core/constants/app_colors.dart';
import 'package:marsu_nstp_portal/core/services/services.dart';
import 'package:marsu_nstp_portal/core/utils/formatters.dart';
import 'package:marsu_nstp_portal/core/widgets/async_view.dart';

class CwtsTrainerModulesScreen extends StatefulWidget {
  const CwtsTrainerModulesScreen({super.key});

  @override
  State<CwtsTrainerModulesScreen> createState() =>
      _CwtsTrainerModulesScreenState();
}

class _CwtsTrainerModulesScreenState extends State<CwtsTrainerModulesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> modules = const [];

  /// Rotating accent palette, so cards keep the original varied look while the
  /// content itself comes from the database.
  static const List<List<Color>> _palette = [
    [AppColors.blue, AppColors.blueLight],
    [AppColors.orange, AppColors.orangeLight],
    [AppColors.cyan, AppColors.cyanLight],
    [AppColors.purple, AppColors.purpleLight],
    [AppColors.pink, AppColors.pinkLight],
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
      final items = await ModuleService.instance.list(
        program: Session.instance.program,
      );
      if (!mounted) return;
      setState(() {
        modules = items;
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

  List<Map<String, dynamic>> get _active =>
      modules.where((m) => m['status'] != 'Archived').toList();

  List<Map<String, dynamic>> get _archived =>
      modules.where((m) => m['status'] == 'Archived').toList();

  Future<void> _openEditor({Map<String, dynamic>? existing}) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ModuleEditor(existing: existing),
    );
    if (saved == true) await _load();
  }

  Future<void> _archive(Map<String, dynamic> module) async {
    try {
      await ModuleService.instance.update(Fmt.str(module['_id']), {
        'status': module['status'] == 'Archived' ? 'Open' : 'Archived',
      });
      if (!mounted) return;
      AppSnack.success(
        context,
        module['status'] == 'Archived' ? 'Module restored.' : 'Module archived.',
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  Future<void> _delete(Map<String, dynamic> module) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete module?',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Text(
          'This permanently removes "${Fmt.str(module['title'], 'this module')}" '
          'and every submission for it.',
          style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child:
                Text('Cancel', style: TextStyle(color: Colors.grey.shade700)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade600,
              foregroundColor: Colors.white,
              elevation: 0,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await ModuleService.instance.delete(Fmt.str(module['_id']));
      if (!mounted) return;
      AppSnack.success(context, 'Module deleted.');
      await _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  void _exportAttendance() {
    final url =
        '${AppConfig.apiBaseUrl}/grades/report/export?program=${Session.instance.program}';
    AppSnack.info(context, 'CSV report: $url');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text(
          'Modules',
          style: TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
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
      body: Column(
        children: [
          // Tabs
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade300),
              ),
            ),
            child: TabBar(
              controller: _tabController,
              labelColor: AppColors.primaryMaroon,
              unselectedLabelColor: Colors.grey,
              indicatorColor: AppColors.primaryMaroon,
              indicatorWeight: 2.5,
              labelStyle: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
              tabs: const [
                Tab(text: 'All Modules'),
                Tab(text: 'Archived'),
              ],
            ),
          ),

          // Modules List
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No modules yet. Tap + to create one.',
              emptyIcon: Icons.folder_open_outlined,
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildList(_active, 'No active modules.'),
                  _buildList(_archived, 'No archived modules'),
                ],
              ),
            ),
          ),

          // Export Button
          Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _exportAttendance,
                icon: const Icon(Icons.download, size: 18),
                label: const Text('Export Attendance'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primaryMaroon,
                  side: const BorderSide(color: AppColors.primaryMaroon),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  textStyle: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(List<Map<String, dynamic>> items, String emptyText) {
    if (items.isEmpty) {
      return AsyncView(
        state: LoadState.empty,
        emptyText: emptyText,
        emptyIcon: Icons.folder_open_outlined,
        child: const SizedBox.shrink(),
      );
    }

    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: _load,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: items.length,
        itemBuilder: (context, index) =>
            _buildModuleCard(items[index], index),
      ),
    );
  }

  Widget _buildModuleCard(Map<String, dynamic> module, int index) {
    final status = Fmt.str(module['status'], 'Open');
    final isCompleted = status == 'Completed';
    final colors = _palette[index % _palette.length];

    return GestureDetector(
      onTap: () => _openEditor(existing: module),
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.grey300),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon Box
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: colors[1],
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.menu_book,
                color: colors[0],
                size: 24,
              ),
            ),
            const SizedBox(width: 14),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    Fmt.str(module['title'], 'Module'),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryMaroon,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    Fmt.str(module['description'], 'No description.'),
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.grey900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    module['deadline'] == null
                        ? 'Posted ${Fmt.date(module['createdAt'])}'
                        : 'Due ${Fmt.date(module['deadline'])}',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade500,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Submitted: ${Fmt.toInt(module['submittedCount'])}/${Fmt.toInt(module['totalTrainees'])}'
                    '  •  Graded: ${Fmt.toInt(module['gradedCount'])}',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isCompleted
                              ? AppColors.greenLight
                              : AppColors.purpleLight,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isCompleted
                                ? AppColors.success
                                : AppColors.purple,
                          ),
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        onTap: () => _archive(module),
                        child: Icon(
                          status == 'Archived'
                              ? Icons.unarchive_outlined
                              : Icons.archive_outlined,
                          size: 18,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(width: 14),
                      GestureDetector(
                        onTap: () => _delete(module),
                        child: Icon(
                          Icons.delete_outline,
                          size: 18,
                          color: Colors.red.shade400,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Create / edit module sheet, including file upload and deadline.
class _ModuleEditor extends StatefulWidget {
  final Map<String, dynamic>? existing;

  const _ModuleEditor({this.existing});

  @override
  State<_ModuleEditor> createState() => _ModuleEditorState();
}

class _ModuleEditorState extends State<_ModuleEditor> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _codeController = TextEditingController();
  final TextEditingController _instructionsController = TextEditingController();
  final TextEditingController _pointsController =
      TextEditingController(text: '100');

  DateTime? _deadline;
  PlatformFile? _file;
  bool _isSaving = false;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _titleController.text = Fmt.str(existing['title']);
      _descriptionController.text = Fmt.str(existing['description']);
      _codeController.text = Fmt.str(existing['moduleCode']);
      _instructionsController.text =
          ((existing['instructions'] as List?) ?? const [])
              .map((e) => e.toString())
              .join('\n');
      _pointsController.text = '${Fmt.toInt(existing['totalPoints'], 100)}';
      _deadline = Fmt.parse(existing['deadline']);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _codeController.dispose();
    _instructionsController.dispose();
    _pointsController.dispose();
    super.dispose();
  }

  Future<void> _pickDeadline() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _deadline ?? DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime(2024),
      lastDate: DateTime(2030),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme:
              const ColorScheme.light(primary: AppColors.primaryMaroon),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _deadline = picked);
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'doc', 'docx', 'ppt', 'pptx'],
      );
      if (result == null || result.files.isEmpty) return;
      setState(() => _file = result.files.first);
    } catch (_) {
      if (!mounted) return;
      AppSnack.error(context, 'Could not open the file picker.');
    }
  }

  Future<void> _save() async {
    if (_titleController.text.trim().isEmpty) {
      AppSnack.error(context, 'Please enter the module title.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      if (_isEditing) {
        await ModuleService.instance.update(Fmt.str(widget.existing!['_id']), {
          'title': _titleController.text.trim(),
          'description': _descriptionController.text.trim(),
          'moduleCode': _codeController.text.trim(),
          'instructions': _instructionsController.text.trim(),
          'totalPoints': Fmt.toInt(_pointsController.text, 100),
          'deadline':
              _deadline == null ? null : _deadline!.toIso8601String(),
        });
      } else {
        await ModuleService.instance.create(
          title: _titleController.text.trim(),
          description: _descriptionController.text.trim(),
          program: Session.instance.program,
          moduleCode: _codeController.text.trim(),
          instructions: _instructionsController.text.trim(),
          deadline: _deadline,
          totalPoints: Fmt.toInt(_pointsController.text, 100),
          filePath: _file?.path,
        );
      }

      if (!mounted) return;
      AppSnack.success(
        context,
        _isEditing ? 'Module updated.' : 'Module created.',
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
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
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
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              _isEditing ? 'Edit Module' : 'New Module',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 20),

            _label('Title'),
            const SizedBox(height: 8),
            _field(_titleController, 'e.g. CWTS Module 5'),
            const SizedBox(height: 16),

            _label('Description'),
            const SizedBox(height: 8),
            _field(_descriptionController, 'What this module covers…',
                maxLines: 3),
            const SizedBox(height: 16),

            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Class code'),
                      const SizedBox(height: 8),
                      _field(_codeController, 'e.g. CWTS - A'),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Total points'),
                      const SizedBox(height: 8),
                      _field(_pointsController, '100',
                          keyboardType: TextInputType.number),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            _label('Deadline (makes it a graded activity)'),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _pickDeadline,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _deadline == null
                            ? 'No deadline (reading material only)'
                            : Fmt.dateWithDay(_deadline),
                        style: TextStyle(
                          fontSize: 14,
                          color: _deadline == null
                              ? Colors.grey.shade400
                              : Colors.grey.shade800,
                        ),
                      ),
                    ),
                    if (_deadline != null)
                      GestureDetector(
                        onTap: () => setState(() => _deadline = null),
                        child: Icon(Icons.close,
                            size: 18, color: Colors.grey.shade500),
                      )
                    else
                      Icon(Icons.calendar_today_outlined,
                          size: 18, color: Colors.grey.shade500),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            _label('Instructions (one per line)'),
            const SizedBox(height: 8),
            _field(_instructionsController,
                'Minimum of 300 words\nSubmit in PDF format',
                maxLines: 3),
            const SizedBox(height: 16),

            if (!_isEditing) ...[
              _label('Module file'),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickFile,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(12),
                    color: Colors.grey.shade50,
                  ),
                  child: Column(
                    children: [
                      Icon(
                        _file == null ? Icons.upload_file : Icons.check_circle,
                        size: 26,
                        color: _file == null
                            ? Colors.grey.shade500
                            : Colors.green.shade600,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _file?.name ?? 'Tap to attach a PDF or document',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryMaroon,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.grey.shade300,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : Text(
                        _isEditing ? 'Save Changes' : 'Create Module',
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600),
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
          color: Colors.black87,
        ),
      );

  Widget _field(
    TextEditingController controller,
    String hint, {
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: AppColors.primaryMaroon, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}
