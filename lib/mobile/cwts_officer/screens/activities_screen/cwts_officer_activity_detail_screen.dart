import 'package:flutter/material.dart';
import 'cwts_officer_activity_participants_screen.dart';
import 'cwts_officer_add_activity_screen.dart';
import '../../../../../core/constants/app_colors.dart';
import '../../../../../core/services/services.dart';
import '../../../../../core/utils/formatters.dart';
import '../../../../../core/widgets/app_card.dart';
import '../../../../../core/widgets/app_dialogs.dart';
import '../../../../../core/widgets/async_view.dart';
import '../../../../../core/widgets/user_avatar.dart';

class CwtsOfficerActivityDetailScreen extends StatefulWidget {
  final String activityId;

  const CwtsOfficerActivityDetailScreen({
    super.key,
    required this.activityId,
  });

  @override
  State<CwtsOfficerActivityDetailScreen> createState() =>
      _CwtsOfficerActivityDetailScreenState();
}

class _CwtsOfficerActivityDetailScreenState
    extends State<CwtsOfficerActivityDetailScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  Map<String, dynamic> _activity = const {};

  /// Set when the activity is edited or deleted, so the list refreshes on pop.
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final data = await ActivityService.instance.get(widget.activityId);
      if (!mounted) return;
      setState(() {
        _activity = data;
        _state = LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  Future<void> _edit() async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CwtsOfficerAddActivityScreen(existing: _activity),
      ),
    );
    if (saved == true) {
      _changed = true;
      await _load();
    }
  }

  Future<void> _delete() async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Delete activity?',
      message:
          'This removes "${Fmt.str(_activity['title'], 'this activity')}" permanently. '
          'Attendance records already taken will be kept but unlinked.',
      confirmLabel: 'Delete',
    );

    if (!confirmed || !mounted) return;

    try {
      await ActivityService.instance.delete(widget.activityId);
      if (!mounted) return;
      AppSnack.success(context, 'Activity deleted.');
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final objectives = ((_activity['objectives'] as List?) ?? const [])
        .map((e) => e.toString())
        .where((e) => e.isNotEmpty)
        .toList();
    final photos = ((_activity['photos'] as List?) ?? const [])
        .map((e) => e.toString())
        .where((e) => e.isNotEmpty)
        .toList();
    final participants = Fmt.toInt(_activity['participants']);
    final hasTime = Fmt.str(_activity['startTime']).isNotEmpty;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _changed);
      },
      child: Scaffold(
        backgroundColor: AppColors.white,
        appBar: AppBar(
          backgroundColor: AppColors.primaryMaroon,
          elevation: 0,
          centerTitle: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios,
                color: AppColors.white, size: 20),
            onPressed: () => Navigator.pop(context, _changed),
          ),
          title: const Text(
            'Activity Details',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.delete_outline, color: AppColors.white),
              onPressed: _state == LoadState.ready ? _delete : null,
            ),
          ],
        ),
        body: AsyncView(
          state: _state,
          message: _error,
          onRetry: _load,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ===== HERO IMAGE =====
                SizedBox(
                  height: 200,
                  width: double.infinity,
                  child: RemoteImage(
                    path: Fmt.str(_activity['image']),
                    height: 200,
                  ),
                ),

                // ===== CONTENT =====
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title
                      Text(
                        Fmt.str(_activity['title'], 'Activity'),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Key details
                      AppCard(
                        child: Column(
                          children: [
                            InfoRow(
                              icon: Icons.calendar_today_outlined,
                              label: 'Date',
                              value: Fmt.dateWithDay(_activity['date']),
                            ),
                            InfoRow(
                              icon: Icons.location_on_outlined,
                              label: 'Location',
                              value: Fmt.str(_activity['location'], 'MARSU'),
                            ),
                            if (hasTime)
                              InfoRow(
                                icon: Icons.access_time,
                                label: 'Time',
                                value:
                                    '${Fmt.clock(Fmt.str(_activity['startTime']))} – ${Fmt.clock(Fmt.str(_activity['endTime']))}',
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // About
                      const SectionHeader(title: 'About the activity'),
                      const SizedBox(height: 8),
                      Text(
                        Fmt.str(
                          _activity['description'],
                          'No description was provided for this activity.',
                        ),
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Objectives
                      const SectionHeader(title: 'Objectives'),
                      const SizedBox(height: 12),
                      if (objectives.isEmpty)
                        const Text(
                          'No objectives listed.',
                          style: TextStyle(
                              fontSize: 13, color: AppColors.textSecondary),
                        )
                      else
                        ...objectives.map(_buildObjectiveItem),
                      const SizedBox(height: 24),

                      // Photos
                      const SectionHeader(title: 'Photos'),
                      const SizedBox(height: 12),
                      if (photos.isEmpty)
                        const Text(
                          'No photos uploaded.',
                          style: TextStyle(
                              fontSize: 13, color: AppColors.textSecondary),
                        )
                      else
                        SizedBox(
                          height: 80,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: photos.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(width: 8),
                            itemBuilder: (context, index) {
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: RemoteImage(
                                  path: photos[index],
                                  width: 100,
                                  height: 80,
                                ),
                              );
                            },
                          ),
                        ),
                      const SizedBox(height: 24),

                      // Participants
                      const SectionHeader(title: 'Participants'),
                      const SizedBox(height: 12),
                      AppCard(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  CwtsOfficerActivityParticipantsScreen(
                                activityId: widget.activityId,
                                activityTitle:
                                    Fmt.str(_activity['title'], 'Activity'),
                              ),
                            ),
                          ).then((_) => _load());
                        },
                        child: Row(
                          children: [
                            const Icon(Icons.people_outline,
                                size: 20, color: AppColors.textSecondary),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                '$participants trainee${participants == 1 ? '' : 's'} participated',
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                            const Icon(Icons.chevron_right,
                                color: AppColors.textSecondary),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Edit Button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _edit,
                          child: const Text('Edit Activity'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildObjectiveItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 2),
            decoration: const BoxDecoration(
              color: AppColors.primaryMaroon,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check,
              color: AppColors.white,
              size: 14,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
