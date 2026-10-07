import 'package:flutter/material.dart';
import '../../../core/services/services.dart';
import '../../../core/widgets/app_dialogs.dart';
import '../../../core/widgets/async_view.dart';
import '../cwts_login_screen.dart';
import '../rotc_login_screen.dart';
import 'register_draft.dart';

/// One requirement document the user picked a local file for on the
/// documents step, ready to be uploaded once the account exists.
class PendingUpload {
  const PendingUpload({
    required this.title,
    this.filePath,
    this.fileBytes,
    this.fileName,
  });

  final String title;
  final String? filePath;
  final List<int>? fileBytes;
  final String? fileName;
}

/// Creates the account from [draft], best-effort uploads any [uploads]
/// picked on the documents step, then signs the fresh account back out and
/// returns to that portal's login screen — mirrors what the old single-step
/// registration screen did on success, just after three steps instead of one.
///
/// Shared by [RegisterAdditionalInfoScreen] (when "None of the above" is
/// picked, there is nothing left to collect) and [RegisterDocumentsScreen].
Future<void> submitRegistration({
  required BuildContext context,
  required RegisterDraft draft,
  List<PendingUpload> uploads = const [],
}) async {
  final confirmed = await showConfirmDialog(
    context,
    title: 'Confirm Registration',
    message: 'Please review your details before submitting:\n\n'
        'Name: ${draft.name}\n'
        'Email: ${draft.email}\n'
        'Student ID: ${draft.studentId}\n'
        'Program: ${draft.nstpProgram}\n'
        'Program: ${draft.course}\n'
        'Year Level: ${draft.yearLevel}\n'
        'Campus: ${draft.campus}\n\n'
        'Do you want to proceed with registration?',
    confirmLabel: 'Register',
    cancelLabel: 'Review',
    danger: false,
  );
  if (!confirmed) return;
  if (!context.mounted) return;

  try {
    await AuthService.instance.register(
      name: draft.name,
      email: draft.email,
      password: draft.password,
      studentId: draft.studentId,
      program: draft.nstpProgram,
      course: draft.course,
      yearLevel: draft.yearLevel,
      specialCategory: draft.specialCategory,
      campus: draft.campus,
    );

    // The register call just signed this device in — upload while we still
    // have a token. A single failed upload should not undo the account that
    // was just created; the trainee can always retry from "My Documents".
    var uploadFailures = 0;
    for (final upload in uploads) {
      try {
        await DocumentService.instance.upload(
          title: upload.title,
          filePath: upload.filePath,
          fileBytes: upload.fileBytes,
          fileName: upload.fileName,
        );
      } catch (_) {
        uploadFailures++;
      }
    }

    await AuthService.instance.logout();
    if (!context.mounted) return;

    if (uploadFailures > 0) {
      AppSnack.error(
        context,
        'Account created, but $uploadFailures document(s) failed to upload. '
        'You can retry from My Documents after logging in.',
      );
    } else {
      AppSnack.success(context, 'Account created. You can now log in.');
    }

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => draft.portalType == 'rotc'
            ? const RotcLoginScreen()
            : const CwtsLoginScreen(),
      ),
      (route) => false,
    );
  } catch (err) {
    if (!context.mounted) return;
    AppSnack.error(context, describeError(err));
  }
}
