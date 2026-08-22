import 'dart:async';

import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

/// Officer manual attendance. Search hits the real roster, the status is
/// selectable (Present / Late / Absent / Excused), and "Add Manually" writes
/// every selected trainee to MongoDB in one request.
class CwtsOfficerManualAttendanceScreen extends StatefulWidget {
  const CwtsOfficerManualAttendanceScreen({super.key});

  @override
  State<CwtsOfficerManualAttendanceScreen> createState() =>
      _CwtsOfficerManualAttendanceScreenState();
}

class _CwtsOfficerManualAttendanceScreenState
    extends State<CwtsOfficerManualAttendanceScreen> {
  DateTime _selectedDate = DateTime.now();
  String _selectedBrigade = 'Brigade Makakalikasan';
  String _selectedStatus = 'Present';

  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();
  Timer? _debounce;

  LoadState _rosterState = LoadState.loading;
  String _rosterError = '';
  List<Map<String, dynamic>> _suggestedStudents = const [];

  final List<Map<String, dynamic>> _addedStudents = [];
  bool _isSaving = false;

  final List<String> _brigades = const [
    'Brigade Makakalikasan',
    'Brigade Kalikasan',
    'Brigade Masipag',
  ];

  static const List<String> _statuses = [
    'Present',
    'Late',
    'Absent',
    'Excused',
  ];

  @override
  void initState() {
    super.initState();
    final sessionBrigade = Session.instance.brigade;
    if (sessionBrigade.isNotEmpty && _brigades.contains(sessionBrigade)) {
      _selectedBrigade = sessionBrigade;
    }
    _loadRoster();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadRoster() async {
    setState(() {
      _rosterState = LoadState.loading;
      _rosterError = '';
    });

    try {
      final roster = await UserService.instance.roster(
        search: _searchController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _suggestedStudents = roster;
        _rosterState = roster.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _rosterState = LoadState.error;
        _rosterError = describeError(error);
      });
    }
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _loadRoster);
  }

  String _userIdOf(Map<String, dynamic> student) {
    final userId = student['userId'];
    if (userId is Map) return Fmt.str(userId['_id']);
    return Fmt.str(userId);
  }

  String _numberOf(Map<String, dynamic> student) =>
      Fmt.str(student['studentId'] ?? student['cadetId'], '—');

  String _infoOf(Map<String, dynamic> student) {
    final line1 = [
      Fmt.str(student['course']),
      Fmt.str(student['yearLevel']),
    ].where((s) => s.isNotEmpty).join(' – ');
    return line1.isEmpty
        ? _numberOf(student)
        : '$line1\n${_numberOf(student)}';
  }

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

  void _addStudent(Map<String, dynamic> student) {
    final id = _userIdOf(student);
    if (id.isEmpty) {
      AppSnack.error(context, 'This record has no linked account.');
      return;
    }
    setState(() {
      if (!_addedStudents.any((s) => _userIdOf(s) == id)) {
        _addedStudents.add(student);
      }
    });
  }

  void _removeStudent(Map<String, dynamic> student) {
    final id = _userIdOf(student);
    setState(() => _addedStudents.removeWhere((s) => _userIdOf(s) == id));
  }

  Future<void> _save() async {
    if (_addedStudents.isEmpty) return;

    setState(() => _isSaving = true);

    try {
      final count = await AttendanceService.instance.markManual(
        studentIds: _addedStudents.map(_userIdOf).toList(),
        date: _selectedDate,
        status: _selectedStatus,
        program: Session.instance.program,
        brigade: _selectedBrigade,
        remarks: _notesController.text.trim(),
        title: '$_selectedBrigade Attendance',
      );

      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSuccess(count);
    } catch (error) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      AppSnack.error(context, describeError(error));
    }
  }

  void _showSuccess(int count) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: AppColors.greenLight,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, color: AppColors.success, size: 32),
              ),
              const SizedBox(height: 20),
              const Text(
                'Attendance Recorded!',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '$count student(s) have been marked\nas $_selectedStatus manually',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              _buildSummaryRow('Date', Fmt.dateWithDay(_selectedDate)),
              const SizedBox(height: 8),
              _buildSummaryRow('Brigade', _selectedBrigade),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Status',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  StatusBadge(_selectedStatus, dense: true),
                ],
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(dialogContext);
                    Navigator.pop(context, true);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: AppColors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Done',
                    style:
                        TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
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
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Manual Attendance',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ===== SELECT DATE =====
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

                  // ===== SELECT BRIGADE =====
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
                            .map((b) =>
                                DropdownMenuItem(value: b, child: Text(b)))
                            .toList(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ===== MARK AS =====
                  _buildLabel('Mark As'),
                  const SizedBox(height: 8),
                  Row(
                    children: _statuses.map((status) {
                      final isSelected = _selectedStatus == status;
                      final style = StatusStyle.of(status);
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _selectedStatus = status),
                          child: Container(
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? style.color
                                  : AppColors.grey100,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              status,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isSelected
                                    ? AppColors.white
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ===== ADD STUDENTS =====
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildLabel('Add Students'),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: TextField(
                      controller: _searchController,
                      onChanged: _onSearchChanged,
                      decoration: InputDecoration(
                        hintText: 'Search student by name or ID...',
                        hintStyle: const TextStyle(
                            color: AppColors.textSecondary, fontSize: 13),
                        prefixIcon: const Icon(Icons.search,
                            color: AppColors.textSecondary),
                        suffixIcon: _searchController.text.isEmpty
                            ? null
                            : IconButton(
                                icon: const Icon(Icons.close,
                                    size: 18, color: AppColors.textSecondary),
                                onPressed: () {
                                  _searchController.clear();
                                  _loadRoster();
                                },
                              ),
                        border: InputBorder.none,
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ===== SUGGESTED / SEARCH RESULTS =====
                  Text(
                    _searchController.text.isEmpty
                        ? 'Suggested Students'
                        : 'Search Results',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: _rosterState == LoadState.ready ? null : 160,
                    child: AsyncView(
                      state: _rosterState,
                      message: _rosterError,
                      onRetry: _loadRoster,
                      compact: true,
                      emptyText: _searchController.text.isEmpty
                          ? 'No trainees enrolled yet.'
                          : 'No match for "${_searchController.text}".',
                      emptyIcon: Icons.person_search_outlined,
                      child: Column(
                        children: _suggestedStudents
                            .take(20)
                            .map(_buildSuggestedStudentTile)
                            .toList(),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            if (_addedStudents.isNotEmpty) ...[
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Added Students (${_addedStudents.length})',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.border),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: _addedStudents.asMap().entries.map((entry) {
                          final s = entry.value;
                          final isLast =
                              entry.key == _addedStudents.length - 1;
                          return Column(
                            children: [
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Row(
                                  children: [
                                    UserAvatar(
                                      imagePath: Fmt.str(s['profileImage']),
                                      radius: 20,
                                      iconSize: 18,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            Fmt.str(s['fullName'], 'Trainee'),
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
                                            _infoOf(s),
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.textSecondary,
                                              height: 1.4,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    GestureDetector(
                                      onTap: () => _removeStudent(s),
                                      child: const Text(
                                        'Remove',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.error,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (!isLast)
                                const Divider(
                                    color: AppColors.border, height: 1),
                            ],
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // ===== NOTES =====
                    _buildLabel('Notes (Optional)'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _notesController,
                      maxLines: 4,
                      maxLength: 100,
                      decoration: InputDecoration(
                        hintText: 'Add a reason or note for manual attendance',
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
            ],
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed:
                    (_addedStudents.isEmpty || _isSaving) ? null : _save,
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
                        'Add Manually',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestedStudentTile(Map<String, dynamic> s) {
    final isAdded =
        _addedStudents.any((a) => _userIdOf(a) == _userIdOf(s));

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          UserAvatar(
            imagePath: Fmt.str(s['profileImage']),
            radius: 20,
            iconSize: 18,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(s['fullName'], 'Trainee'),
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
                  _infoOf(s),
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: isAdded ? null : () => _addStudent(s),
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: isAdded ? AppColors.greenLight : Colors.transparent,
                border: Border.all(
                  color: isAdded ? AppColors.success : AppColors.border,
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                isAdded ? Icons.check : Icons.add,
                size: 18,
                color: isAdded ? AppColors.success : AppColors.textSecondary,
              ),
            ),
          ),
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

  Widget _buildSummaryRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
