import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/constants/app_theme.dart';
import 'core/services/services.dart';
import 'mobile/splash/splash_screen.dart';
import 'mobile/splash/welcome_screen.dart';
import 'mobile/cwts/cwts_main_shell.dart';
import 'mobile/cwts_special/cwts_special_main_shell.dart';
import 'mobile/rotc/rotc_main_shell.dart';
import 'mobile/rotc_special/rotc_special_main_shell.dart';
import 'mobile/cwts_officer/cwts_officer_main_shell.dart';

/// Lets the splash router pop a message onto the very first screen the user
/// sees after an unsupported/legacy session is signed out (there is no
/// Scaffold above [WelcomeScreen] yet at that point, so a normal
/// `ScaffoldMessenger.of(context)` call has nothing to attach to).
final GlobalKey<ScaffoldMessengerState> rootScaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      debugShowCheckedModeBanner: false,
      title: 'MARSU-NSTP',
      theme: buildAppTheme(),
      home: const SplashRouter(),
    );
  }
}

/// Roles this mobile app knows how to show a shell for. The three
/// `admin_*`/`super_admin` roles (and any other legacy/retired role) are
/// managed exclusively through the web admin portal.
const _supportedMobileRoles = {'student', 'cadet', 'officer'};

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

    var restoredRole = role;
    if (role.isNotEmpty && !_supportedMobileRoles.contains(role)) {
      // A restored session with a role this mobile app no longer supports
      // (a session cached under a role that has since been retired, or one
      // of the web-only admin roles). Sign out cleanly instead of silently
      // failing to a blank screen, and let the user know why they landed
      // back at the start.
      await AuthService.instance.logout();
      restoredRole = '';
      WidgetsBinding.instance.addPostFrameCallback((_) {
        rootScaffoldMessengerKey.currentState?.showSnackBar(
          const SnackBar(
            content: Text(
              "This account type isn't supported in the mobile app. "
              'Please use the web admin portal.',
            ),
            backgroundColor: Colors.red,
          ),
        );
      });
    }

    if (!mounted) return;
    setState(() {
      _restoredRole = restoredRole;
      _hasSeenSplash = hasSeen;
      _isLoading = false;
    });
  }

  /// Maps a restored role back onto the shell that role already uses.
  Widget? _shellForRole(String role) {
    switch (role) {
      case 'student':
        return Session.instance.isSpecialClassTrainee
            ? const CwtsSpecialMainShell()
            : const CwtsMainShell();
      case 'cadet':
        return Session.instance.isSpecialClassTrainee
            ? const RotcSpecialMainShell()
            : const RotcMainShell();
      case 'officer':
        return const CwtsOfficerMainShell();
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
