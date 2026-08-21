import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
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
                    : Colors.grey.shade300,
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
                  color:
                      isActive ? AppColors.primaryMaroon : Colors.grey.shade300,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '${stepIndex + 1}',
                    style: TextStyle(
                      color: isActive ? Colors.white : Colors.grey.shade600,
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
                      : Colors.grey.shade500,
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
        color: const Color(0xFFFFF9E6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, color: Colors.amber.shade700, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'This QR code is only valid within the set time range',
              style: TextStyle(
                fontSize: 12,
                color: Colors.amber.shade800,
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
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
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
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Column(
        children: [
          _buildStepper(),
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
          _buildLabel('Select Date'),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _pickDate,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      Fmt.dateWithDay(_selectedDate),
                      style:
                          TextStyle(fontSize: 14, color: Colors.grey.shade800),
                    ),
                  ),
                  Icon(Icons.calendar_today_outlined,
                      size: 18, color: Colors.grey.shade500),
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
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _displayTime(_startTime),
                            style: TextStyle(
                                fontSize: 14, color: Colors.grey.shade800),
                          ),
                        ),
                        Icon(Icons.access_time,
                            size: 18, color: Colors.grey.shade500),
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
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _displayTime(_endTime),
                            style: TextStyle(
                                fontSize: 14, color: Colors.grey.shade800),
                          ),
                        ),
                        Icon(Icons.access_time,
                            size: 18, color: Colors.grey.shade500),
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
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: _selectedBrigade,
                icon: Icon(Icons.keyboard_arrow_down,
                    color: Colors.grey.shade600),
                style: TextStyle(fontSize: 14, color: Colors.grey.shade800),
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
                borderSide: const BorderSide(
                    color: AppColors.primaryMaroon, width: 1.5),
              ),
              contentPadding: const EdgeInsets.all(14),
              counterStyle:
                  TextStyle(fontSize: 11, color: Colors.grey.shade400),
            ),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSaving ? null : _generateSession,
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
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Show this QR code to students to scan',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
          ),
          const SizedBox(height: 24),

          Center(child: _buildQrBox()),
          const SizedBox(height: 12),
          Center(child: _buildCodeChip()),
          const SizedBox(height: 24),

          _buildInfoRow('Date', Fmt.dateWithDay(_session?['date'])),
          const SizedBox(height: 8),
          _buildInfoRow(
            'Time',
            '${_displayTime(_startTime)} – ${_displayTime(_endTime)}',
          ),
          const SizedBox(height: 8),
          _buildInfoRow('Brigade', _selectedBrigade),
          const SizedBox(height: 8),
          _buildInfoRow(
            'Notes',
            _notesController.text.trim().isEmpty
                ? '—'
                : _notesController.text.trim(),
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
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey.shade300),
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
                    foregroundColor: Colors.white,
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
          const Text(
            'QR Code Preview',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Show this QR code to students to scan',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
          ),
          const SizedBox(height: 24),

          Center(child: _buildQrBox()),
          const SizedBox(height: 16),

          Center(
            child: Text(
              _selectedBrigade,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Center(child: _buildCodeChip()),
          const SizedBox(height: 20),

          _buildWarningBanner(),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _closeSession,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primaryMaroon,
                side: const BorderSide(color: AppColors.primaryMaroon),
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
                foregroundColor: Colors.white,
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

  Widget _buildQrBox() {
    return Container(
      width: 220,
      height: 220,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: _sessionCode.isEmpty
          ? const Center(
              child: Icon(Icons.qr_code, size: 120, color: Colors.black87),
            )
          : QrImageView(
              data: _sessionCode,
              version: QrVersions.auto,
              padding: EdgeInsets.zero,
              backgroundColor: Colors.white,
              errorStateBuilder: (context, error) => const Center(
                child: Icon(Icons.qr_code, size: 120, color: Colors.black87),
              ),
            ),
    );
  }

  /// The session code in text form, so a trainee can still record attendance if
  /// the QR image cannot be displayed or scanned.
  Widget _buildCodeChip() {
    if (_sessionCode.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        Text(
          'Session code',
          style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: SelectableText(
            _sessionCode,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
              color: Colors.black87,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: Colors.black87,
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 80,
          child: Text(
            label,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: Colors.black87,
            ),
          ),
        ),
      ],
    );
  }
}
