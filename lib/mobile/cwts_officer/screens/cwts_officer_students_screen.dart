import 'dart:async';

import 'package:flutter/material.dart';
import 'cwts_officer_student_detail_screen.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/user_avatar.dart';

class CwtsOfficerStudentsScreen extends StatefulWidget {
  const CwtsOfficerStudentsScreen({super.key});

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

  String _idOf(Map<String, dynamic> s) =>
      Fmt.str(s['studentId'] ?? s['cadetId'], '—');

  @override
  Widget build(BuildContext context) {
    final isRotc = Session.instance.program == 'ROTC';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.maybePop(context),
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
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          // ===== SEARCH BAR =====
          Padding(
            padding: const EdgeInsets.all(16),
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
                  hintText: isRotc ? 'Search cadet..' : 'Search student..',
                  hintStyle: TextStyle(
                    color: Colors.grey.shade400,
                    fontSize: 14,
                  ),
                  prefixIcon: Icon(Icons.search, color: Colors.grey.shade400),
                  suffixIcon: _searchController.text.isEmpty
                      ? null
                      : IconButton(
                          icon: Icon(Icons.close,
                              size: 18, color: Colors.grey.shade500),
                          onPressed: () {
                            _searchController.clear();
                            _load();
                          },
                        ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
              ),
            ),
          ),

          // ===== STATS ROW =====
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                // Total Students
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isRotc ? 'Total Cadets' : 'Total Students',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        Fmt.count(_stats['total'] ?? 0),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primaryMaroon,
                        ),
                      ),
                    ],
                  ),
                ),
                // Active
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.green,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Active',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      Fmt.count(_stats['active'] ?? 0),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primaryMaroon,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),
          Divider(color: Colors.grey.shade200, height: 1),
          const SizedBox(height: 4),

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
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _students.length,
                  separatorBuilder: (_, __) => Divider(
                    color: Colors.grey.shade200,
                    height: 1,
                  ),
                  itemBuilder: (context, index) {
                    return _buildStudentTile(_students[index]);
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentTile(Map<String, dynamic> student) {
    final status = Fmt.str(student['status'], 'Active');
    final isActive = status == 'Active';

    return InkWell(
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
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            // Avatar
            UserAvatar(
              imagePath: Fmt.str(student['profileImage']),
              radius: 22,
              iconSize: 20,
            ),
            const SizedBox(width: 14),
            // Info
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
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${_idOf(student)} – ${Fmt.str(student['course'], Fmt.str(student['section'], '—'))}',
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
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color:
                    isActive ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color:
                      isActive ? Colors.green.shade400 : AppColors.primaryMaroon,
                  width: 1.2,
                ),
              ),
              child: Text(
                status,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isActive
                      ? Colors.green.shade600
                      : AppColors.primaryMaroon,
                ),
              ),
            ),
            const SizedBox(width: 10),
            // Chevron
            Icon(
              Icons.chevron_right,
              color: Colors.grey.shade400,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
