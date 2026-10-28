import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/services.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_card.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/user_avatar.dart';

/// Read-only activity details for a trainee (CWTS student or ROTC cadet) —
/// reached from an "Upcoming activity" announcement. Same layout as the
/// officer's Activity Details, minus the edit/delete/participants controls.
class TraineeActivityDetailScreen extends StatefulWidget {
  final String activityId;

  const TraineeActivityDetailScreen({super.key, required this.activityId});

  @override
  State<TraineeActivityDetailScreen> createState() =>
      _TraineeActivityDetailScreenState();
}

class _TraineeActivityDetailScreenState
    extends State<TraineeActivityDetailScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  Map<String, dynamic> _activity = const {};

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
      final activity = await ActivityService.instance.get(widget.activityId);
      if (!mounted) return;
      setState(() {
        _activity = activity;
        _state = LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = error is ApiException && error.statusCode == 404
            ? 'This activity is no longer available.'
            : describeError(error);
      });
    }
  }

  List<String> _strings(dynamic value) => ((value as List?) ?? const [])
      .map((e) => e.toString())
      .where((e) => e.isNotEmpty)
      .toList();

  @override
  Widget build(BuildContext context) {
    final objectives = _strings(_activity['objectives']);
    final photos = _strings(_activity['photos']);
    final hasTime = Fmt.str(_activity['startTime']).isNotEmpty;
    final status = Fmt.str(_activity['status']);

    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: AppColors.white),
        title: const Text(
          'Activity Details',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: AsyncView(
        state: _state,
        message: _error,
        onRetry: _load,
        child: RefreshIndicator(
          color: AppColors.primaryMaroon,
          onRefresh: _load,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 200,
                  width: double.infinity,
                  child: RemoteImage(
                    path: Fmt.str(_activity['image']),
                    height: 200,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        Fmt.str(_activity['title'], 'Activity'),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (status.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        StatusBadge(status),
                      ],
                      const SizedBox(height: 16),
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
                      if (objectives.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        const SectionHeader(title: 'Objectives'),
                        const SizedBox(height: 12),
                        ...objectives.map(_buildObjectiveItem),
                      ],
                      if (photos.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        const SectionHeader(title: 'Photos'),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 80,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: photos.length,
                            separatorBuilder: (_, _) => const SizedBox(width: 8),
                            itemBuilder: (context, index) => ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: RemoteImage(
                                path: photos[index],
                                width: 100,
                                height: 80,
                              ),
                            ),
                          ),
                        ),
                      ],
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
            child: const Icon(Icons.check, color: AppColors.white, size: 14),
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
