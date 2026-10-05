import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../main.dart' show SplashRouter;

/// Backs both "Login Devices" and "Active Sessions" on the Account &
/// Security screen — the same underlying list (this app has no per-device
/// permission scoping, so there's no meaningful difference between the two).
class ManageSessionsScreen extends StatefulWidget {
  const ManageSessionsScreen({super.key});

  @override
  State<ManageSessionsScreen> createState() => _ManageSessionsScreenState();
}

class _ManageSessionsScreenState extends State<ManageSessionsScreen> {
  LoadState _state = LoadState.loading;
  List<Map<String, dynamic>> _sessions = [];
  String _message = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _state = LoadState.loading);
    try {
      final sessions = await AuthService.instance.listSessions();
      if (!mounted) return;
      setState(() {
        _sessions = sessions;
        _state = sessions.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _message = describeError(error);
        _state = LoadState.error;
      });
    }
  }

  Future<void> _revoke(Map<String, dynamic> session) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Log out this device?',
      message: '"${session['deviceLabel']}" will be signed out immediately.',
      confirmLabel: 'Log Out',
    );
    if (!confirmed || !mounted) return;

    try {
      await AuthService.instance.revokeSession(session['_id'].toString());
      if (!mounted) return;
      AppSnack.success(context, 'Device logged out.');
      _load();
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  Future<void> _revokeAll() async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Logout All Devices?',
      message: 'Every device signed into this account — including this one — will be logged out immediately.',
      confirmLabel: 'Logout All',
    );
    if (!confirmed || !mounted) return;

    try {
      await AuthService.instance.revokeAllSessions();
      await AuthService.instance.logout();
      if (!mounted) return;
      // Not a plain pop — this device's own session was just revoked too,
      // so the shell underneath is now stale. Re-enter through the app's
      // root router so it re-checks auth (finds none) and lands on the
      // welcome/login screen, rather than popping back to an authenticated
      // screen that has no reason to know it should redirect.
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const SplashRouter()),
        (route) => false,
      );
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  IconData _iconFor(String platform) {
    switch (platform) {
      case 'android':
        return Icons.phone_android;
      case 'ios':
        return Icons.phone_iphone;
      case 'windows':
      case 'macos':
      case 'linux':
        return Icons.computer;
      case 'web':
        return Icons.public;
      default:
        return Icons.devices_other;
    }
  }

  String _relativeTime(String? iso) {
    if (iso == null) return '';
    final date = DateTime.tryParse(iso);
    if (date == null) return '';
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'Active now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Login Devices',
          style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w600),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AsyncView(
                state: _state,
                message: _message,
                onRetry: _load,
                emptyText: 'No active sessions found.',
                emptyIcon: Icons.devices_other,
                child: AppCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (var i = 0; i < _sessions.length; i++) ...[
                        if (i > 0) const Divider(height: 1, color: AppColors.border, indent: 16, endIndent: 16),
                        _buildSessionTile(_sessions[i]),
                      ],
                    ],
                  ),
                ),
              ),
              if (_state == LoadState.ready) ...[
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton.icon(
                    onPressed: _revokeAll,
                    icon: const Icon(Icons.logout, size: 18, color: AppColors.error),
                    label: const Text('Logout All Devices', style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
                    style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.error)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSessionTile(Map<String, dynamic> session) {
    final isCurrent = session['isCurrent'] == true;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
      leading: Icon(_iconFor((session['platform'] ?? '').toString()), color: AppColors.primaryMaroon, size: 24),
      title: Text(
        (session['deviceLabel'] ?? 'Unknown device').toString(),
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        isCurrent ? 'This device — active now' : _relativeTime(session['lastSeenAt']?.toString()),
        style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
      ),
      trailing: isCurrent
          ? const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Text('Current', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.success)),
            )
          : IconButton(
              icon: const Icon(Icons.logout, size: 18, color: AppColors.error),
              tooltip: 'Log out this device',
              onPressed: () => _revoke(session),
            ),
    );
  }
}
