import 'package:flutter/material.dart';
import 'screens/cwts_special_dashboard_screen.dart';
import '../cwts/screens/cwts_attendance_screen.dart';
import '../cwts/screens/cwts_announcement_screen.dart';
import '../cwts/screens/cwts_activities_modules_screen.dart';
import '../cwts/screens/cwts_scan_qr_screen.dart';
import '../cwts/cwts_drawer.dart';
import '../../core/constants/app_colors.dart';

/// Landing shell for a signed-in CWTS Special Class student (PWD/Medical
/// Condition — exempt from physically demanding community activities). The
/// CWTS counterpart of RotcSpecialMainShell; see that file's doc comment
/// for why this is a dedicated shell rather than a filtered view of
/// CwtsMainShell, and why its tab screens are still the shared Cwts* ones.
class CwtsSpecialMainShell extends StatefulWidget {
  const CwtsSpecialMainShell({super.key});

  @override
  State<CwtsSpecialMainShell> createState() => _CwtsSpecialMainShellState();
}

class _CwtsSpecialMainShellState extends State<CwtsSpecialMainShell> {
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
          builder: (_) => CwtsScanQrScreen(onBackToDashboard: _goToDashboard),
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
      CwtsSpecialDashboardScreen(onOpenDrawer: _openDrawer),
      CwtsAttendanceScreen(onBackToDashboard: _goToDashboard),
      CwtsAnnouncementScreen(onBackToDashboard: _goToDashboard),
      CwtsActivitiesModulesScreen(onBackToDashboard: _goToDashboard),
    ];

    return Scaffold(
      key: _scaffoldKey,
      drawer: const CwtsDrawer(),
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
              // Five equal-width slots, so the Scan QR button sits exactly in
              // the middle of the bar on every screen width, regardless of how
              // long the neighbouring labels are; labels share one baseline.
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(child: _buildNavItem(icon: Icons.home, label: 'Home', navIndex: 0)),
                Expanded(child: _buildNavItem(icon: Icons.calendar_today_outlined, label: 'Attendance', navIndex: 1)),
                Expanded(child: _buildCenterQrButton()),
                Expanded(child: _buildNavItem(icon: Icons.notifications_outlined, label: 'Announcement', navIndex: 3)),
                Expanded(child: _buildNavItem(icon: Icons.bar_chart_outlined, label: 'Activities', navIndex: 4)),
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
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                maxLines: 1,
                style: TextStyle(
                  fontSize: 10,
                  color: isSelected ? AppColors.primaryMaroon : AppColors.textSecondary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
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
              alignment: Alignment.center,
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
              maxLines: 1,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 10, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
