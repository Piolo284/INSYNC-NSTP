import 'package:flutter/material.dart';
import '/../../../core/constants/app_colors.dart';

class CwtsAboutScreen extends StatelessWidget {
  const CwtsAboutScreen({super.key});

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
          'About CWTS Portal',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          children: [
            const SizedBox(height: 30),
            // Logo
            Image.asset(
              'assets/images/marsu_logo.png',
              width: 120,
              height: 120,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.primaryMaroon.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.school,
                  color: AppColors.primaryMaroon,
                  size: 60,
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Title
            const Text(
              'CWTS Student Portal',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 4),
            // Version
            Text(
              'Version 1.0.0',
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade500,
              ),
            ),
            const SizedBox(height: 20),
            // Description
            Text(
              'The CWTS Portal is a platform designed to help students, officers, instructors and admins to manage Community Welfare Training Service efficiently',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade600,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 30),
            // Developer Info
            Align(
              alignment: Alignment.centerLeft,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Developer',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey.shade800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Marinduque State University',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  Text(
                    'Information Computing Sciences Unit',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Divider(color: Colors.grey.shade200),
            // Privacy Policy
            _buildLinkItem(
              label: 'Privacy Policy',
              onTap: () {
                // TODO: Open Privacy Policy
              },
            ),
            Divider(color: Colors.grey.shade200),
            // Terms and Conditions
            _buildLinkItem(
              label: 'Terms and Conditions',
              onTap: () {
                // TODO: Open Terms and Conditions
              },
            ),
            Divider(color: Colors.grey.shade200),
            // Licenses
            _buildLinkItem(
              label: 'Licenses',
              onTap: () {
                // TODO: Open Licenses
              },
            ),
            Divider(color: Colors.grey.shade200),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildLinkItem({
    required String label,
    required VoidCallback onTap,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: EdgeInsets.zero,
      title: Text(
        label,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Colors.black87,
        ),
      ),
      trailing: Icon(
        Icons.arrow_forward_ios,
        color: Colors.grey.shade400,
        size: 14,
      ),
    );
  }
}