import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../services/api_service.dart';

/// The four states every database-backed screen can be in.
enum LoadState { loading, ready, empty, error }

/// Holds the result of one API call plus the message to show when it fails.
/// Screens keep their own layout — this only standardises the placeholders.
class AsyncData<T> {
  LoadState state;
  T? value;
  String message;

  AsyncData({this.state = LoadState.loading, this.value, this.message = ''});

  bool get isLoading => state == LoadState.loading;
  bool get hasError => state == LoadState.error;
  bool get isEmpty => state == LoadState.empty;
  bool get isReady => state == LoadState.ready;
}

/// Turns any thrown object into a sentence that is safe to show to a user.
String describeError(Object error) {
  if (error is ApiException) {
    if (error.isNetworkError) return 'Unable to connect to server.';
    // The backend already crafts a specific, correct message per situation —
    // "Incorrect ID/email or password." on a failed login, "This account is
    // registered as a cadet..." on a role mismatch, "Your session has
    // expired..." from the token-verification middleware itself, etc. Prefer
    // that over a blanket per-status-code string, which used to show
    // "session expired" even for a plain wrong-password login attempt.
    if (error.message.trim().isNotEmpty) return error.message;
    if (error.statusCode == 401) {
      return 'Your session has expired. Please log in again.';
    }
    if (error.statusCode == 403) {
      return 'You do not have access to this information.';
    }
    if (error.statusCode == 404) return 'No data available.';
    if (error.statusCode != null && error.statusCode! >= 500) {
      return 'Something went wrong. Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }
  // Not a server ApiException — this is a client-side exception (e.g. from
  // the file picker or a plugin). Print it so it's visible in the Flutter
  // console/logcat instead of disappearing behind the generic message below.
  if (kDebugMode) {
    debugPrint('[describeError] unhandled ${error.runtimeType}: $error');
  }
  return 'Something went wrong. Please try again.';
}

/// Renders [child] once data is ready, otherwise a matching placeholder.
///
/// Placeholders deliberately use the same maroon accent as the rest of the app
/// so they read as part of the existing design rather than a debug screen.
class AsyncView extends StatelessWidget {
  final LoadState state;
  final String message;
  final Widget child;
  final VoidCallback? onRetry;
  final String emptyText;
  final IconData emptyIcon;

  /// Set for placeholders shown inside a card or a short section.
  final bool compact;

  const AsyncView({
    super.key,
    required this.state,
    required this.child,
    this.message = '',
    this.onRetry,
    this.emptyText = 'No data available.',
    this.emptyIcon = Icons.inbox_outlined,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    switch (state) {
      case LoadState.loading:
        return _Placeholder(
          compact: compact,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor:
                      AlwaysStoppedAnimation<Color>(AppColors.primaryMaroon),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Loading...',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
              ),
            ],
          ),
        );

      case LoadState.empty:
        return _Placeholder(
          compact: compact,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(emptyIcon, size: compact ? 28 : 40, color: Colors.grey.shade400),
              const SizedBox(height: 10),
              Text(
                emptyText,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 10),
                _RetryButton(onRetry: onRetry!),
              ],
            ],
          ),
        );

      case LoadState.error:
        return _Placeholder(
          compact: compact,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.cloud_off_outlined,
                size: compact ? 28 : 40,
                color: Colors.grey.shade400,
              ),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  message.isEmpty
                      ? 'Something went wrong. Please try again.'
                      : message,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade600,
                    height: 1.4,
                  ),
                ),
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                _RetryButton(onRetry: onRetry!),
              ],
            ],
          ),
        );

      case LoadState.ready:
        return child;
    }
  }
}

class _Placeholder extends StatelessWidget {
  final Widget child;
  final bool compact;

  const _Placeholder({required this.child, required this.compact});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: compact ? 20 : 48),
        child: child,
      ),
    );
  }
}

class _RetryButton extends StatelessWidget {
  final VoidCallback onRetry;

  const _RetryButton({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onRetry,
      icon: const Icon(Icons.refresh, size: 16),
      label: const Text('Retry', style: TextStyle(fontSize: 13)),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primaryMaroon,
        side: const BorderSide(color: AppColors.primaryMaroon),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
    );
  }
}

/// Consistent snackbars for save/delete/error feedback.
class AppSnack {
  AppSnack._();

  static void success(BuildContext context, String message) {
    _show(context, message, Colors.green.shade700);
  }

  static void error(BuildContext context, String message) {
    _show(context, message, Colors.red.shade700);
  }

  static void info(BuildContext context, String message) {
    _show(context, message, AppColors.primaryMaroon);
  }

  static void _show(BuildContext context, String message, Color color) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message, style: const TextStyle(fontSize: 13)),
          backgroundColor: color,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(12),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
  }
}
