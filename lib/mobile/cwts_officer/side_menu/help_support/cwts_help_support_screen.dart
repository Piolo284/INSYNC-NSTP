import 'package:flutter/material.dart';
import '/../../../core/constants/app_colors.dart';

class CwtsHelpSupportScreen extends StatelessWidget {
  const CwtsHelpSupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios,
            color: Colors.white,
            size: 20,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Help & Support',
          style: TextStyle(
            color: Colors.white,
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
                color: const Color(0xFFF5E6D3),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.headset_mic_outlined,
                    color: AppColors.primaryMaroon,
                    size: 40,
                  ),
                  const SizedBox(width: 16),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Need help?',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        "We're here to assist you.",
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // FAQ
            _buildMenuItem(
              icon: Icons.language_outlined,
              title: 'Frequently Asked Questions',
              subtitle: 'Browse common questions and answers',
              onTap: () {
                // TODO: Navigate to FAQ
              },
            ),
            const SizedBox(height: 12),
            // User Guide
            _buildMenuItem(
              icon: Icons.description_outlined,
              title: 'User Guide',
              subtitle: 'Learn how to use the NSTP System',
              onTap: () {
                // TODO: Navigate to User Guide
              },
            ),
            const SizedBox(height: 12),
            // Contact Support
            _buildMenuItem(
              icon: Icons.phone_outlined,
              title: 'Contact Support',
              subtitle: 'Send us a message',
              onTap: () {
                // TODO: Navigate to Contact Support
              },
            ),
            const SizedBox(height: 12),
            // System Status
            _buildMenuItem(
              icon: Icons.settings_outlined,
              title: 'System Status',
              subtitle: 'Check system uptime and alerts',
              onTap: () {
                // TODO: Navigate to System Status
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: Colors.black87,
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
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios,
              color: Colors.grey.shade400,
              size: 14,
            ),
          ],
        ),
      ),
    );
  }
}