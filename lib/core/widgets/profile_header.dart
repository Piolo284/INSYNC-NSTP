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
    this.alert,
    this.alertColor,
  });

  /// Shown under the subtitle — e.g. the trainee's attendance warning
  /// (AttendanceHeaderAlert), so it's the first thing they see.
  final Widget? alert;

  /// When set, rings the avatar in this color with a "!" badge, to pull the
  /// eye to the [alert].
  final Color? alertColor;

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
          _avatar(),
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
                if (alert != null) ...[
                  const SizedBox(height: 8),
                  alert!,
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }

  Widget _avatar() {
    final avatar = UserAvatar(
      imagePath: imagePath,
      radius: 26,
      backgroundColor: Colors.white.withValues(alpha: 0.15),
    );
    final color = alertColor;
    if (color == null) return avatar;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          padding: const EdgeInsets.all(2.5),
          decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          child: avatar,
        ),
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.primaryMaroon, width: 2),
            ),
            child: const Icon(Icons.priority_high, size: 12, color: Colors.white),
          ),
        ),
      ],
    );
  }
}
