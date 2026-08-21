import 'dart:async';

import 'package:flutter/material.dart';
import 'cwts_officer_assignment_detail_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';

class CwtsOfficerSubmissionsScreen extends StatefulWidget {
  const CwtsOfficerSubmissionsScreen({super.key});

  @override
  State<CwtsOfficerSubmissionsScreen> createState() =>
      _CwtsOfficerSubmissionsScreenState();
}

class _CwtsOfficerSubmissionsScreenState
    extends State<CwtsOfficerSubmissionsScreen> {
  String _selectedModule = 'All Modules';
  String _selectedFilter = 'All';
  String _selectedSort = 'Newest';

  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  LoadState _state = LoadState.loading;
  String _error = '';

  /// Every module that has a deadline — these are the "assignments".
  List<Map<String, dynamic>> _assignments = const [];

  final List<String> _filters = const ['All', 'Submitted', 'Graded', 'To Grade'];
  final List<String> _sortOptions = const ['Newest', 'Oldest', 'Name A-Z'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final modules = await ModuleService.instance.list(
        program: Session.instance.program,
        withDeadlineOnly: true,
        search: _searchController.text.trim(),
        moduleCode: _selectedModule == 'All Modules' ? null : _selectedModule,
      );

      if (!mounted) return;
      setState(() {
        _assignments = modules;
        _state = modules.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  /// Module codes present in the data, so the dropdown reflects real classes.
  List<String> get _moduleOptions {
    final codes = _assignments
        .map((a) => Fmt.str(a['moduleCode']))
        .where((c) => c.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    return ['All Modules', ...codes];
  }

  List<Map<String, dynamic>> get _visibleAssignments {
    var list = [..._assignments];

    switch (_selectedFilter) {
      case 'Submitted':
        list = list.where((a) => Fmt.toInt(a['submittedCount']) > 0).toList();
        break;
      case 'Graded':
        list = list
            .where((a) =>
                Fmt.toInt(a['gradedCount']) > 0 &&
                Fmt.toInt(a['gradedCount']) ==
                    Fmt.toInt(a['submittedCount']))
            .toList();
        break;
      case 'To Grade':
        list = list
            .where((a) =>
                Fmt.toInt(a['submittedCount']) >
                Fmt.toInt(a['gradedCount']))
            .toList();
        break;
    }

    switch (_selectedSort) {
      case 'Oldest':
        list.sort((a, b) => Fmt.str(a['deadline']).compareTo(Fmt.str(b['deadline'])));
        break;
      case 'Name A-Z':
        list.sort((a, b) => Fmt.str(a['title']).compareTo(Fmt.str(b['title'])));
        break;
      default:
        list.sort((a, b) => Fmt.str(b['deadline']).compareTo(Fmt.str(a['deadline'])));
    }

    return list;
  }

  Color _progressColor(int percentage) {
    if (percentage >= 80) return Colors.green;
    if (percentage >= 40) return Colors.amber;
    return Colors.grey;
  }

  @override
  Widget build(BuildContext context) {
    final moduleOptions = _moduleOptions;
    final moduleValue =
        moduleOptions.contains(_selectedModule) ? _selectedModule : 'All Modules';

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
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
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text(
          'Submissions',
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
          // ===== MODULE DROPDOWN =====
          Padding(
            padding: const EdgeInsets.all(16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  isExpanded: true,
                  value: moduleValue,
                  icon: Icon(
                    Icons.keyboard_arrow_down,
                    color: Colors.grey.shade600,
                  ),
                  style: const TextStyle(color: Colors.black87, fontSize: 14),
                  onChanged: (v) {
                    setState(() => _selectedModule = v!);
                    _load();
                  },
                  items: moduleOptions
                      .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                      .toList(),
                ),
              ),
            ),
          ),

          // ===== FILTER TABS =====
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: _filters.map((f) {
                final isSelected = _selectedFilter == f;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedFilter = f),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primaryMaroon
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        f,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isSelected
                              ? Colors.white
                              : Colors.grey.shade600,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),

          // ===== SEARCH =====
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                decoration: InputDecoration(
                  hintText: 'Search assignments...',
                  hintStyle: TextStyle(
                    color: Colors.grey.shade400,
                    fontSize: 13,
                  ),
                  prefixIcon: Icon(Icons.search, color: Colors.grey.shade400),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ===== SORT ROW =====
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        isExpanded: true,
                        value: _selectedSort,
                        icon: Icon(
                          Icons.keyboard_arrow_down,
                          color: Colors.grey.shade600,
                          size: 18,
                        ),
                        style: TextStyle(
                          color: Colors.grey.shade700,
                          fontSize: 13,
                        ),
                        onChanged: (v) => setState(() => _selectedSort = v!),
                        items: _sortOptions
                            .map(
                              (s) => DropdownMenuItem(value: s, child: Text(s)),
                            )
                            .toList(),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Text(
                      '${_visibleAssignments.length} assignment(s)',
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ===== ASSIGNMENTS LIST =====
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No assignments posted yet.',
              emptyIcon: Icons.assignment_outlined,
              child: _visibleAssignments.isEmpty
                  ? AsyncView(
                      state: LoadState.empty,
                      emptyText: 'No assignment matches "$_selectedFilter".',
                      emptyIcon: Icons.filter_alt_off_outlined,
                      onRetry: () => setState(() => _selectedFilter = 'All'),
                      child: const SizedBox.shrink(),
                    )
                  : RefreshIndicator(
                      color: AppColors.primaryMaroon,
                      onRefresh: _load,
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _visibleAssignments.length,
                        itemBuilder: (context, index) {
                          return _buildAssignmentCard(
                              _visibleAssignments[index]);
                        },
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAssignmentCard(Map<String, dynamic> a) {
    final percentage = Fmt.toInt(a['percentage']).clamp(0, 100);
    final color = _progressColor(percentage);
    final submitted = Fmt.toInt(a['submittedCount']);
    final total = Fmt.toInt(a['totalTrainees']);

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => CwtsOfficerAssignmentDetailScreen(
              moduleId: Fmt.str(a['_id']),
            ),
          ),
        ).then((_) => _load());
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    Fmt.str(a['title'], 'Assignment'),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Module: ${Fmt.str(a['moduleCode'], '—')}',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Due: ${Fmt.date(a['deadline'])}',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Submitted: $submitted/$total  •  Graded: ${Fmt.toInt(a['gradedCount'])}',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            SizedBox(
              width: 56,
              height: 56,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CircularProgressIndicator(
                    value: percentage / 100,
                    strokeWidth: 5,
                    backgroundColor: Colors.grey.shade200,
                    valueColor: AlwaysStoppedAnimation<Color>(color),
                  ),
                  Center(
                    child: Text(
                      '$percentage%',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: color,
                      ),
                    ),
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
