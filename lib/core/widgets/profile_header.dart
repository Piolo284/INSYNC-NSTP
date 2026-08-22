import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import 'user_avatar.dart';

/// The maroon "who am I" block used at the top of every dashboard (student,
/// cadet, officer) and the profile screen — avatar, name, and a role/program
/// subtitle. Kept as one widget so the greeting/avatar treatment can't drift
/// between the three dashboards.
class ProfileHeader extends StatelessWidget {
  const ProfileHeader({
    super.key,
    required this.name,
    required this.subtitle,
    this.imagePath,
    this.trailing,
    this.greeting,
  });

  /// e.g. "Good morning," shown above the name — omit for a plain header.
  final String? greeting;
  final String name;

  /// e.g. "CWTS · 1st Year - BSIT" or "CWTS Officer"
  final String subtitle;
  final String? imagePath;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 22),
      decoration: const BoxDecoration(
        color: AppColors.primaryMaroon,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      child: Row(
        children: [
          UserAvatar(
            imagePath: imagePath,
            radius: 26,
            backgroundColor: Colors.white.withValues(alpha: 0.15),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (greeting != null)
                  Text(
                    greeting!,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withValues(alpha: 0.75),
                    ),
                  ),
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
