import 'package:flutter/material.dart';
import 'package:marsu_nstp_portal/mobile/auth/cwts_officer_login_screen.dart';
import 'package:marsu_nstp_portal/mobile/auth/cwts_trainer_login_screen.dart';
import 'package:marsu_nstp_portal/mobile/auth/rotc_login_screen.dart';
import '../../core/constants/app_colors.dart';

class RoleSelectionScreen extends StatelessWidget {
  const RoleSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.primaryMaroon, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'SELECT YOUR ROLE',
          style: TextStyle(
            color: AppColors.primaryMaroon,
            fontSize: 14,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(flex: 2),

            // ===== TRAINEE =====
            _buildRoleButton(
              label: 'CADETS',
              onTap: () {
                Navigator.push(context, MaterialPageRoute(builder: (_) => const RotcLoginScreen()));
              },
            ),
            const SizedBox(height: 20),

            // ===== OFFICER =====
            _buildRoleButton(
              label: 'OFFICER',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const CwtsOfficerLoginScreen()),
                );
              },
            ),
            const SizedBox(height: 20),

            // ===== TRAINING STAFF =====
            _buildRoleButton(
              label: 'TRAINING STAFF',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const CwtsTrainerLoginScreen()),
                );
              },
            ),

            const Spacer(flex: 3),
          ],
        ),
      ),
    );
  }

  Widget _buildRoleButton({
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 22),
        decoration: BoxDecoration(
          color: AppColors.primaryMaroon,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: AppColors.primaryMaroon.withOpacity(0.25),
              blurRadius: 12,
              spreadRadius: 0,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Center(
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.0,
            ),
          ),
        ),
      ),
    );
  }
}