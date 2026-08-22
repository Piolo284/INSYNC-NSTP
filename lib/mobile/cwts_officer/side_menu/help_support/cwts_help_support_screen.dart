import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/async_view.dart';

class CwtsHelpSupportScreen extends StatelessWidget {
  const CwtsHelpSupportScreen({super.key});

  void _notYetAvailable(BuildContext context, String feature) {
    AppSnack.info(context, '$feature is not available yet.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Help & Support',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Need Help Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.goldLight,
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.headset_mic_outlined,
                    color: AppColors.primaryMaroon,
                    size: 40,
                  ),
                  const SizedBox(width: 16),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Need help?',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          "We're here to assist you.",
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // FAQ
            _buildMenuItem(
              context: context,
              icon: Icons.language_outlined,
              title: 'Frequently Asked Questions',
              subtitle: 'Browse common questions and answers',
              feature: 'The FAQ page',
            ),
            const SizedBox(height: 12),
            // User Guide
            _buildMenuItem(
              context: context,
              icon: Icons.description_outlined,
              title: 'User Guide',
              subtitle: 'Learn how to use the NSTP System',
              feature: 'The user guide',
            ),
            const SizedBox(height: 12),
            // Contact Support
            _buildMenuItem(
              context: context,
              icon: Icons.phone_outlined,
              title: 'Contact Support',
              subtitle: 'Send us a message',
              feature: 'Direct messaging to support',
            ),
            const SizedBox(height: 12),
            // System Status
            _buildMenuItem(
              context: context,
              icon: Icons.settings_outlined,
              title: 'System Status',
              subtitle: 'Check system uptime and alerts',
              feature: 'The system status page',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String subtitle,
    required String feature,
  }) {
    return AppCard(
      onTap: () => _notYetAvailable(context, feature),
      child: Row(
        children: [
          Icon(
            icon,
            color: AppColors.textPrimary,
            size: 24,
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
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.arrow_forward_ios,
            color: AppColors.textSecondary,
            size: 14,
          ),
        ],
      ),
    );
  }
}
