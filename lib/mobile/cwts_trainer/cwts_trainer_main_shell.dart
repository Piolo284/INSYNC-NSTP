import 'package:flutter/material.dart';
import 'package:marsu_nstp_portal/mobile/cwts_trainer/screens/cwts_trainer_announcements_screen.dart';
import 'package:marsu_nstp_portal/mobile/cwts_trainer/screens/cwts_trainer_dashboard_screen.dart';
import 'package:marsu_nstp_portal/mobile/cwts_trainer/screens/cwts_trainer_modules_screen.dart';
import 'package:marsu_nstp_portal/mobile/cwts_trainer/screens/cwts_trainer_students_screen.dart';
import 'package:marsu_nstp_portal/mobile/cwts_trainer/screens/cwts_trainer_more_screen.dart';
import 'cwts_trainer_drawer.dart';
import '../../core/constants/app_colors.dart';

class CwtsTrainerMainShell extends StatefulWidget {
  const CwtsTrainerMainShell({super.key});

  @override
  State<CwtsTrainerMainShell> createState() => _CwtsTrainerMainShellState();
}

class _CwtsTrainerMainShellState extends State<CwtsTrainerMainShell> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _currentIndex = 0;

  void _openDrawer() => _scaffoldKey.currentState?.openDrawer();

  void _onTabTapped(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final screens = <Widget>[
      CwtsTrainerDashboardScreen(onOpenDrawer: _openDrawer),
      const CwtsTrainerModulesScreen(),
      const CwtsTrainerStudentsScreen(),
      const CwtsTrainerAnnouncementsScreen(),
      const CwtsTrainerMoreScreen(),
    ];

    return Scaffold(
      key: _scaffoldKey,
      drawer: const CwtsTrainerDrawer(),
      drawerEnableOpenDragGesture: _currentIndex == 0,
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(
                    icon: Icons.home_filled, label: 'Dashboard', index: 0),
                _buildNavItem(
                    icon: Icons.folder_outlined, label: 'Modules', index: 1),
                _buildNavItem(
                    icon: Icons.people_outline, label: 'Students', index: 2),
                _buildNavItem(
                    icon: Icons.campaign_outlined,
                    label: 'Announcements',
                    index: 3),
                _buildNavItem(icon: Icons.menu, label: 'More', index: 4),
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

    return GestureDetector(
      onTap: () => _onTabTapped(index),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isSelected ? AppColors.primaryMaroon : Colors.grey.shade500,
            size: 22,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: isSelected ? AppColors.primaryMaroon : Colors.grey.shade500,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}
