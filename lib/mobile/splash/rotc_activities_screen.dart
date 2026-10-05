import 'package:flutter/material.dart';
import 'rotc_role_selection_screen.dart';
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

class RotcActivitiesScreen extends StatelessWidget {
  const RotcActivitiesScreen({super.key});

  final List<_ActivityInfo> _activities = const [
    _ActivityInfo(
      title: 'Drill Training',
      description: 'Enhancing discipline, coordination and teamwork.',
      imagePath: 'assets/images/rotc_activities/drill_training.jpg',
    ),
    _ActivityInfo(
      title: 'Disaster Response Simulation',
      description: 'Preparing students for emergency and disaster situations.',
      imagePath: 'assets/images/rotc_activities/disaster_response.jpg',
    ),
    _ActivityInfo(
      title: 'First Aid Training',
      description: 'Learning essential first aid skills to help save lives.',
      imagePath: 'assets/images/rotc_activities/first_aid_training.jpg',
    ),
    _ActivityInfo(
      title: 'Leadership Exercises',
      description: 'Developing leadership skills through drills and challenges.',
      imagePath: 'assets/images/rotc_activities/leadership_exercises.jpg',
    ),
    _ActivityInfo(
      title: 'Community Outreach',
      description: 'Assisting local communities through service projects.',
      imagePath: 'assets/images/rotc_activities/community_outreach.jpg',
    ),
    _ActivityInfo(
      title: 'Environmental Clean-up Drive',
      description: 'Cleaning up public areas to promote environmental care.',
      imagePath: 'assets/images/rotc_activities/environmental_cleanup.jpg',
    ),
    _ActivityInfo(
      title: 'Flag Ceremony & Color Guard',
      description: 'Practicing proper flag protocol and ceremonial drills.',
      imagePath: 'assets/images/rotc_activities/flag_ceremony.jpg',
    ),
    _ActivityInfo(
      title: 'Physical Fitness Training',
      description: 'Building strength, endurance and overall physical readiness.',
      imagePath: 'assets/images/rotc_activities/physical_fitness.jpg',
    ),
    _ActivityInfo(
      title: 'Map Reading and Land Navigation',
      description: 'Training cadets in terrain analysis and navigation skills.',
      imagePath: 'assets/images/rotc_activities/land_navigation.jpg',
    ),
    _ActivityInfo(
      title: 'Cadet Leadership Summit',
      description: 'Sharpening decision-making and command skills among cadets.',
      imagePath: 'assets/images/rotc_activities/leadership_summit.jpg',
    ),
    _ActivityInfo(
      title: 'RAATI',
      description: 'A combat training simulation building tactical skills and readiness.',
      imagePath: 'assets/images/rotc_activities/raati.jpg',
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
