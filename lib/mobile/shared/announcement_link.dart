import 'package:flutter/material.dart';
import 'announcement_detail_screen.dart';
import 'trainee_activity_detail_screen.dart';
import '../cwts/screens/cwts_activity_detail_screen.dart';
import '../cwts/screens/cwts_attendance_screen.dart';
import '../cwts/screens/cwts_module_detail_screen.dart';
import '../rotc/screens/rotc_attendance_screen.dart';
import '../cwts_officer/screens/activities_screen/cwts_officer_activity_detail_screen.dart';
import '../cwts_officer/screens/attendance_screen/cwts_officer_attendance_screen.dart';
import '../cwts_officer/screens/submission_screen/cwts_officer_assignment_detail_screen.dart';
import '../../core/services/services.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_view.dart';

/// Announcement deep links. The backend stamps `linkType`/`linkId` on an
/// announcement (and on its notification's `data`) when it is about a
/// specific quiz, assignment, module or activity, so tapping it lands on that
/// page directly instead of making the user hunt for it.

String announcementLinkType(Map<String, dynamic>? item) =>
    Fmt.str(item?['linkType']);

bool hasAnnouncementLink(Map<String, dynamic>? item) {
  final type = announcementLinkType(item);
  if (type == 'Attendance') return true;
  return (type == 'Module' || type == 'Activity') &&
      Fmt.str(item?['linkId']).isNotEmpty;
}

/// What the link opens — 'Quiz', 'Assignment', 'Module', 'Activity' or
/// 'Attendance' (set by the backend as `linkLabel`).
String announcementLinkKind(Map<String, dynamic>? item) {
  final label = Fmt.str(item?['linkLabel']);
  if (label.isNotEmpty) return label;
  return announcementLinkType(item);
}

/// Button text for the linked page, e.g. "Open quiz".
String announcementLinkLabel(Map<String, dynamic>? item) {
  final kind = announcementLinkKind(item);
  switch (kind) {
    case '':
      return '';
    case 'Activity':
    case 'Attendance':
      return 'View ${kind.toLowerCase()}';
    default:
      return 'Open ${kind.toLowerCase()}';
  }
}

IconData announcementLinkIcon(Map<String, dynamic>? item) {
  switch (announcementLinkKind(item)) {
    case 'Quiz':
      return Icons.quiz_outlined;
    case 'Assignment':
      return Icons.assignment_outlined;
    case 'Module':
      return Icons.menu_book_outlined;
    case 'Activity':
      return Icons.event_outlined;
    case 'Attendance':
      return Icons.calendar_today_outlined;
    default:
      return Icons.campaign_outlined;
  }
}

bool get _isTrainee =>
    Session.instance.role == 'student' || Session.instance.role == 'cadet';

/// Tapping an announcement anywhere in the app: linked ones open their page
/// directly; plain ones open the announcement detail.
Future<void> openAnnouncement(
  BuildContext context,
  Map<String, dynamic> announcement,
) async {
  if (hasAnnouncementLink(announcement)) {
    await openAnnouncementLink(
      context,
      linkType: announcementLinkType(announcement),
      linkId: Fmt.str(announcement['linkId']),
    );
    return;
  }
  await Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => AnnouncementDetailScreen(announcement: announcement),
    ),
  );
}

/// Tapping a notification: follows its link, or opens the announcement it
/// came from. Returns false when there was nothing to open.
Future<bool> openNotificationTarget(
  BuildContext context,
  Map<String, dynamic> data,
) async {
  if (hasAnnouncementLink(data)) {
    await openAnnouncementLink(
      context,
      linkType: announcementLinkType(data),
      linkId: Fmt.str(data['linkId']),
    );
    return true;
  }
  // Older "New module posted" notifications only carry a moduleId.
  final moduleId = Fmt.str(data['moduleId']);
  if (moduleId.isNotEmpty) {
    await openAnnouncementLink(context, linkType: 'Module', linkId: moduleId);
    return true;
  }
  final announcementId = Fmt.str(data['announcementId']);
  if (announcementId.isEmpty) return false;
  final announcement = await _fetch(
    context,
    () => AnnouncementService.instance.get(announcementId),
    missing: 'This announcement is no longer available.',
  );
  if (announcement == null || !context.mounted) return true;
  await openAnnouncement(context, announcement);
  return true;
}

/// Opens the page an announcement links to, for whichever role is signed in.
Future<void> openAnnouncementLink(
  BuildContext context, {
  required String linkType,
  required String linkId,
}) async {
  Widget? page;
  switch (linkType) {
    case 'Module':
      final module = await _fetch(
        context,
        () => ModuleService.instance.get(linkId),
        missing: 'This module or quiz has been removed.',
      );
      if (module == null || !context.mounted) return;
      page = _modulePage(context, module);
      break;
    case 'Activity':
      page = _isTrainee
          ? TraineeActivityDetailScreen(activityId: linkId)
          : CwtsOfficerActivityDetailScreen(activityId: linkId);
      break;
    case 'Attendance':
      if (!_isTrainee) {
        page = const CwtsOfficerAttendanceScreen();
      } else if (Session.instance.program == 'ROTC') {
        page = const RotcAttendanceScreen();
      } else {
        page = const CwtsAttendanceScreen();
      }
      break;
  }
  if (page == null || !context.mounted) return;
  final target = page;
  await Navigator.push(context, MaterialPageRoute(builder: (_) => target));
}

/// Graded work (has a deadline) opens the submission page; a plain learning
/// module opens its reader. Officers get their own submissions view.
Widget? _modulePage(BuildContext context, Map<String, dynamic> module) {
  final id = Fmt.str(module['_id']);
  final title = Fmt.str(module['title'], 'Module');
  final graded = Fmt.str(module['deadline']).isNotEmpty;

  if (!_isTrainee) {
    if (graded) return CwtsOfficerAssignmentDetailScreen(moduleId: id);
    return CwtsModuleDetailScreen(moduleId: id, title: title);
  }
  if (graded) {
    return CwtsActivityDetailScreen(
      moduleId: id,
      title: title,
      dueDate: Fmt.dateTime(module['deadline']),
      status: Fmt.str(module['myStatus'], 'To Do'),
    );
  }
  return CwtsModuleDetailScreen(moduleId: id, title: title);
}

/// Runs [load] behind a small progress dialog; shows a snack and returns
/// null on failure (404 → [missing]).
Future<Map<String, dynamic>?> _fetch(
  BuildContext context,
  Future<Map<String, dynamic>> Function() load, {
  required String missing,
}) async {
  final navigator = Navigator.of(context, rootNavigator: true);
  showDialog<void>(
    context: context,
    barrierDismissible: false,
    useRootNavigator: true,
    builder: (_) => const Center(child: CircularProgressIndicator()),
  );
  try {
    final result = await load();
    navigator.pop();
    return result;
  } catch (error) {
    navigator.pop();
    if (context.mounted) {
      AppSnack.error(
        context,
        error is ApiException && error.statusCode == 404
            ? missing
            : describeError(error),
      );
    }
    return null;
  }
}
