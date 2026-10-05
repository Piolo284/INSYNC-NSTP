import 'package:flutter/material.dart';
import 'screens/rotc_special_dashboard_screen.dart';
import '../rotc/screens/rotc_attendance_screen.dart';
import '../rotc/screens/rotc_announcement_screen.dart';
import '../rotc/screens/rotc_activities_modules_screen.dart';
import '../rotc/screens/rotc_scan_qr_screen.dart';
import '../rotc/rotc_drawer.dart';
import '../../core/constants/app_colors.dart';

/// Landing shell for a signed-in ROTC Special Class cadet (PWD/Medical
/// Condition — exempt from field training). A dedicated shell rather than a
/// filtered view of RotcMainShell, per the program's requirement that this
/// track get its own interface; the tab screens it hosts (attendance,
/// announcements, QR scan) are still the shared Rotc* ones, since those
/// already read/return correctly Special-Class-scoped data for this cadet
/// with no further changes needed — only the dashboard tab and the chrome
/// around it are genuinely new.
class RotcSpecialMainShell extends StatefulWidget {
  const RotcSpecialMainShell({super.key});

  @override
  State<RotcSpecialMainShell> createState() => _RotcSpecialMainShellState();
}

class _RotcSpecialMainShellState extends State<RotcSpecialMainShell> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _currentIndex = 0;

  void _goToDashboard() {
    setState(() => _currentIndex = 0);
  }

  void _openDrawer() {
    _scaffoldKey.currentState?.openDrawer();
  }

  void _onTabTapped(int navIndex) {
    if (navIndex == 2) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => RotcScanQrScreen(onBackToDashboard: _goToDashboard),
        ),
      );
      return;
    }

    final screenIndex = navIndex > 2 ? navIndex - 1 : navIndex;
    setState(() => _currentIndex = screenIndex);
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      RotcSpecialDashboardScreen(onOpenDrawer: _openDrawer),
      RotcAttendanceScreen(onBackToDashboard: _goToDashboard),
      RotcAnnouncementScreen(onBackToDashboard: _goToDashboard),
      RotcActivitiesModulesScreen(onBackToDashboard: _goToDashboard),
    ];

    return Scaffold(
      key: _scaffoldKey,
      drawer: const RotcDrawer(),
      drawerEnableOpenDragGesture: false,
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
                _buildNavItem(icon: Icons.home, label: 'Home', navIndex: 0),
                _buildNavItem(icon: Icons.calendar_today_outlined, label: 'Attendance', navIndex: 1),
                _buildCenterQrButton(),
                _buildNavItem(icon: Icons.notifications_outlined, label: 'Announcement', navIndex: 3),
                _buildNavItem(icon: Icons.bar_chart_outlined, label: 'Activities', navIndex: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({required IconData icon, required String label, required int navIndex}) {
    final screenIndex = navIndex > 2 ? navIndex - 1 : navIndex;
    final isSelected = _currentIndex == screenIndex;

    return InkWell(
      onTap: () => _onTabTapped(navIndex),
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

  Widget _buildCenterQrButton() {
    return InkWell(
      onTap: () => _onTabTapped(2),
      borderRadius: BorderRadius.circular(25),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: AppColors.primaryMaroon,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primaryMaroon.withValues(alpha: 0.35),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.qr_code_scanner,
                color: AppColors.white,
                size: 24,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Scan QR',
              style: TextStyle(fontSize: 10, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
