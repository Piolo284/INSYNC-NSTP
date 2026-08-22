import 'package:flutter/material.dart';
import 'package:marsu_nstp_portal/mobile/splash/cwts_role_selection_screen.dart';
import '../../core/constants/app_colors.dart';

class _ActivityInfo {
  const _ActivityInfo({
    required this.title,
    required this.description,
    required this.icon,
  });

  final String title;
  final String description;
  final IconData icon;
}

class CwtsActivitiesScreen extends StatelessWidget {
  const CwtsActivitiesScreen({super.key});

  final List<_ActivityInfo> _activities = const [
    _ActivityInfo(
      title: 'Feeding Program',
      description: 'Providing meals to undernourished children & families in need.',
      icon: Icons.restaurant,
    ),
    _ActivityInfo(
      title: 'Disaster Preparedness Training',
      description: 'Equipping students with skills for disaster prevention and response.',
      icon: Icons.warning_amber_rounded,
    ),
    _ActivityInfo(
      title: 'Coastal Clean-up',
      description: 'Collecting and properly disposing waste to protect our shores.',
      icon: Icons.waves,
    ),
    _ActivityInfo(
      title: 'Tree Planting',
      description: 'Planting trees to help conserve the environment.',
      icon: Icons.park,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('ACTIVITIES'),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: _activities.map(_buildActivityCard).toList(),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const RoleSelectionScreen()),
                  );
                },
                child: const Text('Enroll Now'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActivityCard(_ActivityInfo activity) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cwtsCardBg,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(activity.icon, color: AppColors.primaryMaroon, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity.title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primaryMaroon,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  activity.description,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
