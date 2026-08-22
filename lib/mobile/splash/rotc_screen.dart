import 'package:flutter/material.dart';
import 'rotc_activities_screen.dart';
import '../../core/constants/app_colors.dart';

class RotcScreen extends StatelessWidget {
  const RotcScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('ROTC'),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Brand banner — a gradient hero with the program logo
                  // instead of a stock photo, since no ROTC group photo
                  // asset ships with the app.
                  Container(
                    width: double.infinity,
                    height: 190,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [AppColors.primaryMaroon, AppColors.primaryDark],
                      ),
                    ),
                    child: Center(
                      child: Container(
                        width: 92,
                        height: 92,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.black.withValues(alpha: 0.15),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Image.asset(
                          'assets/images/rotc_logo.png',
                          errorBuilder: (_, _, _) => const Icon(
                            Icons.shield,
                            color: AppColors.primaryMaroon,
                            size: 40,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Container(
                    width: double.infinity,
                    color: AppColors.cwtsCardBg,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'R.O.T.C.',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryMaroon,
                            letterSpacing: 1,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          "RESERVE OFFICERS' TRAINING CORPS",
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
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        _buildInfoRow(
                          icon: Icons.track_changes,
                          title: 'MISSION',
                          description:
                              'To train and develop students to become responsible, disciplined, and patriotic citizens through military and civic education.',
                        ),
                        const SizedBox(height: 24),
                        _buildInfoRow(
                          icon: Icons.visibility,
                          title: 'VISION',
                          description:
                              'To produce competent and morally upright citizen-soldiers ready to serve the nation in times of peace and crisis.',
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
                      builder: (_) => const RotcActivitiesScreen(),
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
