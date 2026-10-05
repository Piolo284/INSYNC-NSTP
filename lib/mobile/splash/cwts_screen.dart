import 'package:flutter/material.dart';
import 'cwts_activities_screen.dart';
import '../../core/constants/app_colors.dart';

class CwtsScreen extends StatelessWidget {
  const CwtsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('CWTS'),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Column(
                        children: [
                          // Group photo banner — drop the file at
                          // assets/images/cwts_banner.jpg (already
                          // registered in pubspec.yaml). Until it exists
                          // this falls back to a placeholder that shows
                          // the same path as an in-app reminder.
                          ClipRRect(
                            child: Image.asset(
                              'assets/images/cwts_banner.jpg',
                              width: double.infinity,
                              height: 200,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(
                                width: double.infinity,
                                height: 200,
                                color: AppColors.grey200,
                                alignment: Alignment.center,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(
                                      Icons.image_outlined,
                                      color: AppColors.grey500,
                                      size: 36,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      'Add photo at\nassets/images/cwts_banner.jpg',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        color: AppColors.grey600,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Container(
                            width: double.infinity,
                            color: AppColors.cwtsCardBg,
                            padding: const EdgeInsets.fromLTRB(112, 12, 20, 16),
                            child: const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'C.W.T.S.',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primaryMaroon,
                                    letterSpacing: 1,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'CIVIC WELFARE TRAINING SERVICE',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.primaryMaroon,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      // Program badge, straddling the seam between the
                      // photo and the beige info strip.
                      Positioned(
                        top: 160,
                        left: 20,
                        child: Image.asset(
                          'assets/images/cwts_logo.png',
                          width: 84,
                          height: 84,
                          errorBuilder: (_, _, _) => const Icon(
                            Icons.volunteer_activism,
                            color: AppColors.primaryMaroon,
                            size: 60,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        _buildInfoRow(
                          icon: Icons.track_changes,
                          title: 'MISSION',
                          description:
                              'To empower students through civic engagement, environmental stewardship, leadership and volunteerism for the betterment of society.',
                        ),
                        const SizedBox(height: 24),
                        _buildInfoRow(
                          icon: Icons.visibility,
                          title: 'VISION',
                          description:
                              'To develop socially responsible students who are committed to nation-building and community development.',
                        ),
                        const SizedBox(height: 24),
                        _buildInfoRow(
                          icon: Icons.flag,
                          title: 'OBJECTIVES',
                          description:
                              'To provide civic welfare training that engages students in community immersion, environmental protection, and volunteer programs that address the needs of society.',
                        ),
                      ],
                    ),
                  ),
                ],
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
                    MaterialPageRoute(
                      builder: (_) => const CwtsActivitiesScreen(),
                    ),
                  );
                },
                child: const Text('View Activities'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String title,
    required String description,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppColors.goldLight,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: AppColors.primaryMaroon, size: 24),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryMaroon,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                description,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
