import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';

/// Officer QR attendance session builder.
///
/// The three-step Setup → Preview → Active flow is unchanged. What is new:
/// step 2 creates a real AttendanceSession in MongoDB and renders a QR code
/// for the session code that trainees scan, and step 3 activates/closes it.
/// The QR image is generated locally with `qr_flutter` — no external service
/// call, so it also works offline.
class CwtsOfficerCreateQrScreen extends StatefulWidget {
  const CwtsOfficerCreateQrScreen({super.key});

  @override
  State<CwtsOfficerCreateQrScreen> createState() =>
      _CwtsOfficerCreateQrScreenState();
}

class _CwtsOfficerCreateQrScreenState extends State<CwtsOfficerCreateQrScreen> {
  int _currentStep = 0;
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 8, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 8, minute: 30);
  String _selectedBrigade = 'Brigade Makakalikasan';
  final TextEditingController _notesController = TextEditingController();

  bool _isSaving = false;

  /// The session created in step 2; drives the QR image and step 3.
  Map<String, dynamic>? _session;

  final List<String> _steps = ['Setup', 'Preview', 'Active'];

  final List<String> _brigades = const [
    'Brigade Makakalikasan',
    'Brigade Kalikasan',
    'Brigade Masipag',
  ];

  @override
  void initState() {
    super.initState();
    final sessionBrigade = Session.instance.brigade;
    if (sessionBrigade.isNotEmpty && _brigades.contains(sessionBrigade)) {
      _selectedBrigade = sessionBrigade;
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  String get _sessionCode => Fmt.str(_session?['sessionCode']);

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
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
    if (picked != null) setState(() => _selectedDate = picked);
  }

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme:
              const ColorScheme.light(primary: AppColors.primaryMaroon),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  void _prevStep() {
    if (_currentStep > 0) setState(() => _currentStep--);
  }

  String _apiTime(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  String _displayTime(TimeOfDay t) => Fmt.clock(_apiTime(t));

  int _minutesOf(TimeOfDay t) => t.hour * 60 + t.minute;

  /// Step 1 → 2: persists the session so the QR code maps to a real record.
  Future<void> _generateSession() async {
    if (_minutesOf(_endTime) <= _minutesOf(_startTime)) {
      AppSnack.error(context, 'End time must be after the start time.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      final session = await AttendanceService.instance.createSession(
        date: _selectedDate,
        startTime: _apiTime(_startTime),
        endTime: _apiTime(_endTime),
        program: Session.instance.program,
        brigade: _selectedBrigade,
        notes: _notesController.text.trim(),
        title: _notesController.text.trim().isEmpty
            ? '$_selectedBrigade Attendance'
            : _notesController.text.trim(),
      );

      if (!mounted) return;
      setState(() {
        _session = session;
        _currentStep = 1;
      });
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _activate() {
    setState(() => _currentStep = 2);
    AppSnack.success(context, 'QR code is now active. Trainees can scan it.');
  }

  Future<void> _closeSession() async {
    final id = Fmt.str(_session?['_id']);
    if (id.isEmpty) return;

    final confirmed = await showConfirmDialog(
      context,
      title: 'Close Session?',
      message: 'The QR code will stop working immediately and trainees will '
          'no longer be able to scan it for attendance.',
      confirmLabel: 'Close Session',
    );
    if (!confirmed) return;

    try {
      await AttendanceService.instance.closeSession(id);
      if (!mounted) return;
      AppSnack.success(context, 'Attendance session closed.');
      Navigator.pop(context);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  Widget _buildStepper() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Row(
        children: List.generate(_steps.length * 2 - 1, (index) {
          if (index.isOdd) {
            final stepIndex = index ~/ 2;
            return Expanded(
              child: Container(
                height: 2,
                color: stepIndex < _currentStep
                    ? AppColors.primaryMaroon
                    : AppColors.border,
              ),
            );
          }
          final stepIndex = index ~/ 2;
          final isActive = stepIndex <= _currentStep;
          final isCurrent = stepIndex == _currentStep;
          return Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: isActive ? AppColors.primaryMaroon : AppColors.border,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '${stepIndex + 1}',
                    style: TextStyle(
                      color: isActive ? AppColors.white : AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _steps[stepIndex],
                style: TextStyle(
                  fontSize: 10,
                  color: isCurrent
                      ? AppColors.primaryMaroon
                      : AppColors.textSecondary,
                  fontWeight: isCurrent ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildWarningBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.orangeLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.warning, size: 18),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'This QR code is only valid within the set time range',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.warning,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () {
            if (_currentStep == 0) {
              Navigator.pop(context);
            } else {
              _prevStep();
            }
          },
        ),
        title: const Text(
          'Create QR Code',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Column(
        children: [
          Container(
            color: AppColors.cardBg,
            child: _buildStepper(),
          ),
          Expanded(
            child: _currentStep == 0
                ? _buildSetupStep()
                : _currentStep == 1
                    ? _buildPreviewStep()
                    : _buildActiveStep(),
          ),
        ],
      ),
    );
  }

  // ===== STEP 1: SETUP =====
  Widget _buildSetupStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildLabel('Select Date'),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: _pickDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            Fmt.dateWithDay(_selectedDate),
                            style: const TextStyle(
                                fontSize: 14, color: AppColors.textPrimary),
                          ),
                        ),
                        const Icon(Icons.calendar_today_outlined,
                            size: 18, color: AppColors.textSecondary),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                _buildLabel('Set Time Duration'),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _pickTime(true),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _displayTime(_startTime),
                                  style: const TextStyle(
                                      fontSize: 14,
                                      color: AppColors.textPrimary),
                                ),
                              ),
                              const Icon(Icons.access_time,
                                  size: 18, color: AppColors.textSecondary),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _pickTime(false),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _displayTime(_endTime),
                                  style: const TextStyle(
                                      fontSize: 14,
                                      color: AppColors.textPrimary),
                                ),
                              ),
                              const Icon(Icons.access_time,
                                  size: 18, color: AppColors.textSecondary),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                _buildLabel('Select Brigade'),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: _selectedBrigade,
                      icon: const Icon(Icons.keyboard_arrow_down,
                          color: AppColors.textSecondary),
                      style: const TextStyle(
                          fontSize: 14, color: AppColors.textPrimary),
                      onChanged: (v) => setState(() => _selectedBrigade = v!),
                      items: _brigades
                          .map((b) => DropdownMenuItem(value: b, child: Text(b)))
                          .toList(),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                _buildLabel('Notes (Optional)'),
                const SizedBox(height: 8),
                TextField(
                  controller: _notesController,
                  maxLines: 4,
                  maxLength: 100,
                  decoration: InputDecoration(
                    hintText: 'e.g. CWTS Training – Day 3',
                    hintStyle: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 13),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                          color: AppColors.primaryMaroon, width: 1.5),
                    ),
                    contentPadding: const EdgeInsets.all(14),
                    counterStyle: const TextStyle(
                        fontSize: 11, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSaving ? null : _generateSession,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryMaroon,
                foregroundColor: AppColors.white,
                disabledBackgroundColor: AppColors.grey300,
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
                            AlwaysStoppedAnimation<Color>(AppColors.white),
                      ),
                    )
                  : const Text(
                      'Generate QR Code',
                      style:
                          TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ===== STEP 2: PREVIEW =====
  Widget _buildPreviewStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'QR Code Preview',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Show this QR code to students to scan',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 20),

          _buildQrCard(),
          const SizedBox(height: 20),

          AppCard(
            child: Column(
              children: [
                InfoRow(
                  icon: Icons.calendar_today_outlined,
                  label: 'Date',
                  value: Fmt.dateWithDay(_session?['date']),
                ),
                InfoRow(
                  icon: Icons.access_time,
                  label: 'Time',
                  value: '${_displayTime(_startTime)} – ${_displayTime(_endTime)}',
                ),
                InfoRow(
                  icon: Icons.groups_outlined,
                  label: 'Brigade',
                  value: _selectedBrigade,
                ),
                InfoRow(
                  icon: Icons.notes_outlined,
                  label: 'Notes',
                  value: _notesController.text.trim().isEmpty
                      ? '—'
                      : _notesController.text.trim(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _buildWarningBanner(),
          const SizedBox(height: 24),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _prevStep,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Back',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _activate,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: AppColors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Activate QR Code',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ===== STEP 3: ACTIVE =====
  Widget _buildActiveStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.greenLight,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.circle, size: 8, color: AppColors.success),
                    SizedBox(width: 6),
                    Text(
                      'Active',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.success,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'QR Code Preview',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Show this QR code to students to scan',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 20),

          _buildQrCard(),
          const SizedBox(height: 16),

          Center(
            child: Text(
              _selectedBrigade,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(height: 20),

          _buildWarningBanner(),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _closeSession,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.error),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text(
                'Close Session',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryMaroon,
                foregroundColor: AppColors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: const Text(
                'Done',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// The QR code, prominent and centered, with the session code beneath it
  /// as a selectable fallback for when the image cannot be scanned.
  Widget _buildQrCard() {
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          Container(
            width: 220,
            height: 220,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: _sessionCode.isEmpty
                ? const Center(
                    child: Icon(Icons.qr_code,
                        size: 120, color: AppColors.textPrimary),
                  )
                : QrImageView(
                    data: _sessionCode,
                    version: QrVersions.auto,
                    padding: EdgeInsets.zero,
                    backgroundColor: AppColors.white,
                    errorStateBuilder: (context, error) => const Center(
                      child: Icon(Icons.qr_code,
                          size: 120, color: AppColors.textPrimary),
                    ),
                  ),
          ),
          if (_sessionCode.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text(
              'Session code',
              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.scaffoldBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: SelectableText(
                _sessionCode,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
    );
  }
}
