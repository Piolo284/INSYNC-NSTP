import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../../../../core/constants/app_colors.dart';
import '../../../../../core/services/services.dart';
import '../../../../../core/utils/formatters.dart';
import '../../../../../core/widgets/async_view.dart';

/// Creates a new activity, or edits [existing] when one is passed in.
/// Pops with `true` when something was saved so the caller can refresh.
class CwtsOfficerAddActivityScreen extends StatefulWidget {
  final Map<String, dynamic>? existing;

  const CwtsOfficerAddActivityScreen({super.key, this.existing});

  @override
  State<CwtsOfficerAddActivityScreen> createState() =>
      _CwtsOfficerAddActivityScreenState();
}

class _CwtsOfficerAddActivityScreenState
    extends State<CwtsOfficerAddActivityScreen> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _locationController = TextEditingController();
  final TextEditingController _objectivesController = TextEditingController();

  DateTime? _selectedDate;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  PlatformFile? _photo;
  bool _isSaving = false;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _titleController.text = Fmt.str(existing['title']);
      _descriptionController.text = Fmt.str(existing['description']);
      _locationController.text = Fmt.str(existing['location']);
      _objectivesController.text =
          ((existing['objectives'] as List?) ?? const [])
              .map((e) => e.toString())
              .join('\n');
      _selectedDate = Fmt.parse(existing['date']);
      _startTime = _parseTime(Fmt.str(existing['startTime']));
      _endTime = _parseTime(Fmt.str(existing['endTime']));
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _locationController.dispose();
    _objectivesController.dispose();
    super.dispose();
  }

  TimeOfDay? _parseTime(String hhmm) {
    if (hhmm.isEmpty) return null;
    final parts = hhmm.split(':');
    if (parts.length < 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return TimeOfDay(hour: h, minute: m);
  }

  String _formatApiTime(TimeOfDay? t) {
    if (t == null) return '';
    return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2024),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primaryMaroon,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: (isStart ? _startTime : _endTime) ??
          const TimeOfDay(hour: 8, minute: 0),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme:
              const ColorScheme.light(primary: AppColors.primaryMaroon),
        ),
        child: child!,
      ),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startTime = picked;
      } else {
        _endTime = picked;
      }
    });
  }

  Future<void> _pickPhoto() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.image,
        // Web never returns a real filesystem path — only bytes — so the
        // upload has to travel as bytes for the photo to actually reach
        // the server.
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;
      setState(() => _photo = result.files.first);
    } catch (_) {
      if (!mounted) return;
      AppSnack.error(context, 'Could not open the file picker.');
    }
  }

  Future<void> _save() async {
    if (_titleController.text.trim().isEmpty) {
      AppSnack.error(context, 'Please enter the activity title.');
      return;
    }
    if (_descriptionController.text.trim().isEmpty) {
      AppSnack.error(context, 'Please enter a short description.');
      return;
    }
    if (_selectedDate == null) {
      AppSnack.error(context, 'Please select the activity date.');
      return;
    }
    if (_locationController.text.trim().isEmpty) {
      AppSnack.error(context, 'Please enter the location.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      if (_isEditing) {
        await ActivityService.instance.update(
          Fmt.str(widget.existing!['_id']),
          {
            'title': _titleController.text.trim(),
            'description': _descriptionController.text.trim(),
            'date': Fmt.apiDate(_selectedDate!),
            'location': _locationController.text.trim(),
            'startTime': _formatApiTime(_startTime),
            'endTime': _formatApiTime(_endTime),
            'objectives': _objectivesController.text.trim(),
          },
          photoPath: kIsWeb ? null : _photo?.path,
          photoBytes: _photo?.bytes,
          photoName: _photo?.name,
        );
      } else {
        await ActivityService.instance.create(
          title: _titleController.text.trim(),
          description: _descriptionController.text.trim(),
          date: _selectedDate!,
          location: _locationController.text.trim(),
          program: Session.instance.program,
          startTime: _formatApiTime(_startTime),
          endTime: _formatApiTime(_endTime),
          objectives: _objectivesController.text.trim(),
          brigade: Session.instance.brigade,
          photoPath: kIsWeb ? null : _photo?.path,
          photoBytes: _photo?.bytes,
          photoName: _photo?.name,
        );
      }

      if (!mounted) return;
      AppSnack.success(
        context,
        _isEditing ? 'Activity updated.' : 'Activity created.',
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
        title: Text(
          _isEditing ? 'Edit Activity' : 'Add New Activity',
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ===== TITLE =====
            _buildLabel('Title', required: true),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _titleController,
              hint: 'Enter activity title',
            ),
            const SizedBox(height: 20),

            // ===== SHORT DESCRIPTION =====
            _buildLabel('Short description', required: true),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _descriptionController,
              hint: 'Enter a short description of the activity',
              maxLines: 4,
              maxLength: 200,
            ),
            const SizedBox(height: 20),

            // ===== DATE =====
            _buildLabel('Date', required: true),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _pickDate,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _selectedDate != null
                            ? Fmt.dateWithDay(_selectedDate)
                            : 'Select date',
                        style: TextStyle(
                          fontSize: 14,
                          color: _selectedDate != null
                              ? AppColors.textPrimary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                    const Icon(Icons.calendar_today_outlined,
                        size: 18, color: AppColors.textSecondary),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ===== TIME =====
            _buildLabel('Time'),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _buildTimeField(true)),
                const SizedBox(width: 12),
                Expanded(child: _buildTimeField(false)),
              ],
            ),
            const SizedBox(height: 20),

            // ===== LOCATION =====
            _buildLabel('Location', required: true),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _locationController,
              hint: 'Enter location',
            ),
            const SizedBox(height: 20),

            // ===== PHOTOS =====
            _buildLabel('Photos'),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _pickPhoto,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 32),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                  color: AppColors.grey50,
                ),
                child: Column(
                  children: [
                    Icon(
                      _photo == null ? Icons.upload : Icons.check_circle,
                      size: 28,
                      color: _photo == null
                          ? AppColors.textSecondary
                          : AppColors.success,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _photo?.name ?? 'Tap to upload photos',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _photo == null
                          ? 'JPG or PNG, up to 15 MB'
                          : Fmt.fileSize(_photo!.size),
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ===== OBJECTIVES =====
            _buildLabel('Objectives'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _objectivesController,
              hint: 'One objective per line',
              maxLines: 4,
              maxLength: 300,
            ),
            const SizedBox(height: 32),

            // ===== BUTTONS =====
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed:
                        _isSaving ? null : () => Navigator.pop(context, false),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _save,
                    child: _isSaving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(AppColors.white),
                            ),
                          )
                        : const Text('Save'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimeField(bool isStart) {
    final value = isStart ? _startTime : _endTime;
    return GestureDetector(
      onTap: () => _pickTime(isStart),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppColors.radiusSm),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                value == null
                    ? (isStart ? 'Start time' : 'End time')
                    : Fmt.clock(_formatApiTime(value)),
                style: TextStyle(
                  fontSize: 14,
                  color: value == null
                      ? AppColors.textSecondary
                      : AppColors.textPrimary,
                ),
              ),
            ),
            const Icon(Icons.access_time, size: 18, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text, {bool required = false}) {
    return Row(
      children: [
        Text(
          text,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        if (required) ...[
          const SizedBox(width: 2),
          const Text(
            '*',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: AppColors.error,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    int maxLines = 1,
    int? maxLength,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      maxLength: maxLength,
      decoration: InputDecoration(
        hintText: hint,
      ),
    );
  }
}
