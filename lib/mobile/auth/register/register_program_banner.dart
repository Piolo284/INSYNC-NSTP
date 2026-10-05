import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

/// "Registering for: CWTS" / "Registering for: ROTC" — shown on every step
/// of registration so the program picked on the very first screen (before
/// login) stays visible and is never re-asked. Purely a display of
/// [RegisterDraft.nstpProgram]/`portalType`; nothing here can change it.
class RegisterProgramBanner extends StatelessWidget {
  const RegisterProgramBanner({super.key, required this.nstpProgram});

  final String nstpProgram;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 10, bottom: 20),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      decoration: BoxDecoration(
        color: AppColors.primaryMaroon.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primaryMaroon.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.flag_outlined, size: 15, color: AppColors.primaryMaroon),
          const SizedBox(width: 7),
          Text.rich(
            TextSpan(
              style: const TextStyle(fontSize: 12.5, color: AppColors.primaryMaroon),
              children: [
                const TextSpan(text: 'Registering for: '),
                TextSpan(
                  text: nstpProgram,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
