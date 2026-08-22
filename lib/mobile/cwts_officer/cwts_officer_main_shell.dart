import 'package:flutter/material.dart';
import 'screens/cwts_officer_dashboard_screen.dart';
import 'screens/cwts_officer_students_screen.dart';
import 'screens/attendance_screen/cwts_officer_attendance_screen.dart';
import '../cwts_officer/screens/activities_screen/cwts_officer_activities_screen.dart';
import '../cwts_officer/screens/submission_screen/cwts_officer_submissions_screen.dart';
import 'cwts_officer_drawer.dart';
import '../../../core/constants/app_colors.dart';

class CwtsOfficerMainShell extends StatefulWidget {
  const CwtsOfficerMainShell({super.key});

  @override
  State<CwtsOfficerMainShell> createState() => _CwtsOfficerMainShellState();
}

class _CwtsOfficerMainShellState extends State<CwtsOfficerMainShell> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _currentIndex = 0;

  void _openDrawer() => _scaffoldKey.currentState?.openDrawer();

  void _onTabTapped(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final screens = <Widget>[
      CwtsOfficerDashboardScreen(onOpenDrawer: _openDrawer), // 0 - Home
      const CwtsOfficerStudentsScreen(),                     // 1 - Students
      const CwtsOfficerAttendanceScreen(),                   // 2 - Attendance
      const CwtsOfficerActivitiesScreen(),                   // 3 - Activities
      const CwtsOfficerSubmissionsScreen(),                  // 4 - Submissions
    ];

    return Scaffold(
      key: _scaffoldKey,
      drawer: const CwtsOfficerDrawer(),
      drawerEnableOpenDragGesture: _currentIndex == 0,
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.white,
          border: const Border(top: BorderSide(color: AppColors.border)),
          boxShadow: [
            BoxShadow(
              color: AppColors.black.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(icon: Icons.home_outlined, label: 'Home', index: 0),
                _buildNavItem(icon: Icons.person_outline, label: 'Students', index: 1),
                _buildNavItem(icon: Icons.calendar_today_outlined, label: 'Attendance', index: 2),
                _buildNavItem(icon: Icons.bar_chart_outlined, label: 'Activities', index: 3),
                _buildNavItem(icon: Icons.article_outlined, label: 'Submissions', index: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required int index,
  }) {
    final isSelected = _currentIndex == index;

    return InkWell(
      onTap: () => _onTabTapped(index),
      borderRadius: BorderRadius.circular(AppColors.radiusSm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.primaryMaroon : AppColors.textSecondary,
              size: 22,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: isSelected ? AppColors.primaryMaroon : AppColors.textSecondary,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}