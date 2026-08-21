import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/constants/app_colors.dart';
import 'core/services/services.dart';
import 'mobile/splash/splash_screen.dart';
import 'mobile/splash/welcome_screen.dart';
import 'mobile/cwts/cwts_main_shell.dart';
import 'mobile/rotc/rotc_main_shell.dart';
import 'mobile/cwts_officer/cwts_officer_main_shell.dart';
import 'mobile/cwts_trainer/cwts_trainer_main_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'MARSU-NSTP',
      theme: ThemeData(
        useMaterial3: true,
        primaryColor: AppColors.primaryMaroon,
        scaffoldBackgroundColor: AppColors.white,
      ),
      home: const SplashRouter(),
    );
  }
}

class SplashRouter extends StatefulWidget {
  const SplashRouter({super.key});

  @override
  State<SplashRouter> createState() => _SplashRouterState();
}

class _SplashRouterState extends State<SplashRouter> {
  bool _isLoading = true;
  bool _hasSeenSplash = false;
  String _restoredRole = '';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    // A saved JWT + cached user means the trainee/officer goes straight to
    // their shell instead of typing credentials again.
    final role = await AuthService.instance.restoreSession();

    final prefs = await SharedPreferences.getInstance();
    final hasSeen = prefs.getBool('has_seen_splash') ?? false;

    if (!mounted) return;
    setState(() {
      _restoredRole = role;
      _hasSeenSplash = hasSeen;
      _isLoading = false;
    });
  }

  /// Maps a restored role back onto the shell that role already uses.
  Widget? _shellForRole(String role) {
    switch (role) {
      case 'student':
        return const CwtsMainShell();
      case 'cadet':
        return const RotcMainShell();
      case 'officer':
        return const CwtsOfficerMainShell();
      case 'instructor':
        return const CwtsTrainerMainShell();
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final shell = _shellForRole(_restoredRole);
    if (shell != null) return shell;

    // Kung nakita na before, diretso welcome screen
    if (_hasSeenSplash) {
      return const WelcomeScreen();
    }

    // First time, show splash then save flag
    return const SplashScreen();
  }
}
