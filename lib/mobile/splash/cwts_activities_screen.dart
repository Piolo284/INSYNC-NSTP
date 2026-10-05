import 'package:flutter/material.dart';
import 'package:marsu_nstp_portal/mobile/splash/cwts_role_selection_screen.dart';
import '../../core/constants/app_colors.dart';

class _ActivityInfo {
  const _ActivityInfo({
    required this.title,
    required this.description,
    required this.imagePath,
  });

  final String title;
  final String description;
  final String imagePath;
}

class CwtsActivitiesScreen extends StatelessWidget {
  const CwtsActivitiesScreen({super.key});

  final List<_ActivityInfo> _activities = const [
    _ActivityInfo(
      title: 'Community Clean-up Drive',
      description: 'Sweeping streets, collecting litter, and cleaning public spaces.',
      imagePath: 'assets/images/cwts_activities/community_cleanup.jpg',
    ),
    _ActivityInfo(
      title: 'Coastal Clean-up',
      description: 'Removing plastic, bottles, and other waste from beaches and shorelines.',
      imagePath: 'assets/images/cwts_activities/coastal_cleanup.jpg',
    ),
    _ActivityInfo(
      title: 'Tree-Planting Activity',
      description: 'Planting trees and teaching residents how to care for them.',
      imagePath: 'assets/images/cwts_activities/tree_planting.jpg',
    ),
    _ActivityInfo(
      title: 'Community Outreach Program',
      description: 'Distributing food, clothes, hygiene kits, or school supplies to families in need.',
      imagePath: 'assets/images/cwts_activities/community_outreach.jpg',
    ),
    _ActivityInfo(
      title: 'Feeding Program',
      description: 'Preparing and serving nutritious meals to children or vulnerable residents.',
      imagePath: 'assets/images/cwts_activities/feeding_program.jpg',
    ),
    _ActivityInfo(
      title: 'Health and Hygiene Campaign',
      description: 'Sharing information about proper handwashing, sanitation, nutrition, and disease prevention.',
      imagePath: 'assets/images/cwts_activities/health_and_hygiene.jpg',
    ),
    _ActivityInfo(
      title: 'CWTS Team-Building Games',
      description: 'Organizing relays, trust exercises, problem-solving games, and group challenges.',
      imagePath: 'assets/images/cwts_activities/team_building.jpg',
    ),
    _ActivityInfo(
      title: 'Clean and Green Project',
      description: 'Cleaning, painting, and beautifying schools, barangay facilities, parks, or waiting sheds.',
      imagePath: 'assets/images/cwts_activities/clean_and_green.jpg',
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
      height: 136,
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cwtsCardBg,
        borderRadius: BorderRadius.circular(AppColors.radius),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
            child: Image.asset(
              activity.imagePath,
              width: 112,
              height: 112,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(
                width: 112,
                height: 112,
                color: AppColors.white,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      margin: const EdgeInsets.only(top: 5, right: 8),
                      decoration: const BoxDecoration(
                        color: AppColors.primaryMaroon,
                        shape: BoxShape.circle,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        activity.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primaryMaroon,
                          height: 1.25,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  activity.description,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.5,
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
