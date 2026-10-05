import 'package:flutter/material.dart';
import '../cwts_officer/cwts_officer_drawer.dart';
import '../cwts_officer/screens/cwts_officer_dashboard_screen.dart';
import '../cwts_officer/screens/cwts_officer_students_screen.dart';
import '../cwts_officer/screens/attendance_screen/cwts_officer_attendance_screen.dart';
import '../cwts_officer/screens/activities_screen/cwts_officer_activities_screen.dart';
import '../cwts_officer/screens/submission_screen/cwts_officer_submissions_screen.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/session.dart';

/// Landing shell for a signed-in ROTC officer. Reuses the CWTS officer's
/// screens/drawer wholesale — they already read `Session.instance.program`
/// and adapt their labels, API calls, and server-side scoping accordingly
/// (see e.g. CwtsOfficerStudentsScreen), so a second parallel set of ROTC
/// screens would just be duplicated code to keep in sync. This shell only
/// supplies the ROTC-specific bottom nav chrome around them.
class RotcOfficerMainShell extends StatefulWidget {
  const RotcOfficerMainShell({super.key});

  @override
  State<RotcOfficerMainShell> createState() => _RotcOfficerMainShellState();
}

class _RotcOfficerMainShellState extends State<RotcOfficerMainShell> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _currentIndex = 0;

  void _openDrawer() => _scaffoldKey.currentState?.openDrawer();

  void _onTabTapped(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    // An Attendance Officer was only ever given attendance duties — they get
    // just that one screen and no bottom nav, instead of the full officer
    // tab set below (see Session.isAttendanceOnlyOfficer).
    if (Session.instance.isAttendanceOnlyOfficer) {
      return Scaffold(
        key: _scaffoldKey,
        drawer: const CwtsOfficerDrawer(),
        body: CwtsOfficerAttendanceScreen(onOpenDrawer: _openDrawer),
      );
    }

    // The assigned Special Class officer has no separate tab of their own —
    // these same screens auto-scope to their Special Class roster server-side
    // (see cadetController/studentController/activityController/
    // attendanceController's isSpecialClassManager checks), since that IS
    // the entirety of what they manage.
    final screens = <Widget>[
      CwtsOfficerDashboardScreen(
        onOpenDrawer: _openDrawer,
        onNavigateToTab: _onTabTapped,
      ), // 0 - Home
      CwtsOfficerStudentsScreen(onNavigateToTab: _onTabTapped), // 1 - Cadets
      const CwtsOfficerAttendanceScreen(),                   // 2 - Attendance
      CwtsOfficerActivitiesScreen(onNavigateToTab: _onTabTapped), // 3 - Activities
      CwtsOfficerSubmissionsScreen(onNavigateToTab: _onTabTapped), // 4 - Submissions
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
                _buildNavItem(icon: Icons.person_outline, label: 'Cadets', index: 1),
                _buildNavItem(icon: Icons.calendar_today_outlined, label: 'Attendance', index: 2),
                _buildNavItem(icon: Icons.bar_chart_outlined, label: 'Activities', index: 3),
                _buildNavItem(icon: Icons.article_outlined, label: 'Modules', index: 4),
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
