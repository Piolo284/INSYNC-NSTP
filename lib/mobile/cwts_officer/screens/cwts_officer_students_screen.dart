import 'dart:async';

import 'package:flutter/material.dart';
import 'cwts_officer_student_detail_screen.dart';
import 'rotc_officer_add_cadets_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../../../core/widgets/user_avatar.dart';

class CwtsOfficerStudentsScreen extends StatefulWidget {
  /// Lets the back arrow jump to the shell's Home tab instead of trying to
  /// pop a route — this screen is a bottom-nav tab, not a pushed page, so
  /// there's normally nothing on the Navigator stack for it to pop.
  final ValueChanged<int>? onNavigateToTab;

  const CwtsOfficerStudentsScreen({super.key, this.onNavigateToTab});

  @override
  State<CwtsOfficerStudentsScreen> createState() =>
      _CwtsOfficerStudentsScreenState();
}

class _CwtsOfficerStudentsScreenState extends State<CwtsOfficerStudentsScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  LoadState _state = LoadState.loading;
  String _error = '';

  List<Map<String, dynamic>> _students = const [];
  Map<String, dynamic> _stats = const {};

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
      final query = _searchController.text.trim();
      final result = Session.instance.program == 'ROTC'
          ? await UserService.instance.cadets(search: query)
          : await UserService.instance.students(search: query);

      if (!mounted) return;
      final list = (result['data'] as List).cast<Map<String, dynamic>>();
      setState(() {
        _students = list;
        _stats = result['stats'] as Map<String, dynamic>;
        _state = list.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  /// Server-side search, debounced so typing does not spam the API.
  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  Future<void> _openAddCadets() async {
    final added = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const RotcOfficerAddCadetsScreen()),
    );
    if (added == true) _load();
  }

  String _idOf(Map<String, dynamic> s) =>
      Fmt.str(s['studentId'] ?? s['cadetId'], '—');

  @override
  Widget build(BuildContext context) {
    final isRotc = Session.instance.program == 'ROTC';

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () {
            if (widget.onNavigateToTab != null) {
              widget.onNavigateToTab!(0);
            } else {
              Navigator.maybePop(context);
            }
          },
        ),
        title: Text(
          isRotc ? 'Cadets' : 'Students',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          // ROTC cadets start with no company; a regular officer adds them
          // here and they're placed under the officer's company.
          if (isRotc && !Session.instance.isSpecialClassOfficer)
            IconButton(
              tooltip: 'Add cadets',
              icon: const Icon(Icons.person_add_alt_1, color: Colors.white),
              onPressed: _openAddCadets,
            ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          if (Session.instance.isSpecialClassOfficer)
            Container(
              width: double.infinity,
              color: AppColors.primaryMaroon.withValues(alpha: 0.08),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Text(
                '${Session.instance.program} Inclusive Learning Section roster — every PWD/Medical '
                'Condition trainee, program-wide.',
                style: const TextStyle(fontSize: 11.5, color: AppColors.primaryMaroon, fontWeight: FontWeight.w600),
              ),
            ),
          // ===== SEARCH BAR =====
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: isRotc ? 'Search cadet…' : 'Search student…',
                prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
                suffixIcon: _searchController.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close,
                            size: 18, color: AppColors.textSecondary),
                        onPressed: () {
                          _searchController.clear();
                          _load();
                        },
                      ),
              ),
            ),
          ),

          // ===== STATS ROW =====
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: _statTile(
                    isRotc ? 'Total Cadets' : 'Total Students',
                    Fmt.count(_stats['total'] ?? 0),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _statTile(
                    'Active',
                    Fmt.count(_stats['active'] ?? 0),
                    dotColor: AppColors.success,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // ===== STUDENT LIST =====
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: _searchController.text.isEmpty
                  ? 'No records found.'
                  : 'No match for "${_searchController.text}".',
              emptyIcon: Icons.people_outline,
              child: RefreshIndicator(
                color: AppColors.primaryMaroon,
                onRefresh: _load,
                child: ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  itemCount: _students.length,
                  itemBuilder: (context, index) {
                    return _buildStudentCard(_students[index]);
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statTile(String label, String value, {Color? dotColor}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(AppColors.radiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (dotColor != null) ...[
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.primaryMaroon,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentCard(Map<String, dynamic> student) {
    final status = Fmt.str(student['status'], 'Active');
    final subtitle =
        '${_idOf(student)} – ${Fmt.str(student['course'], Fmt.str(student['section'], '—'))}';

    return AppCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => CwtsOfficerStudentDetailScreen(
              userId: Fmt.str(student['userId'] is Map
                  ? student['userId']['_id']
                  : student['userId']),
              name: Fmt.str(student['fullName'], 'Trainee'),
              idNumber: _idOf(student),
              profile: student,
            ),
          ),
        ).then((_) => _load());
      },
      child: Row(
        children: [
          UserAvatar(
            imagePath: Fmt.str(student['profileImage']),
            radius: 22,
            iconSize: 20,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(student['fullName'], 'Trainee'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
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
          const SizedBox(width: 8),
          StatusBadge(status, dense: true),
          const SizedBox(width: 6),
          const Icon(
            Icons.chevron_right,
            color: AppColors.textSecondary,
            size: 20,
          ),
        ],
      ),
    );
  }
}
