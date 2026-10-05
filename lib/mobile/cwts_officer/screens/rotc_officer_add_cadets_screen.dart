import 'dart:async';

import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/user_avatar.dart';

/// ROTC officer picks registered cadets that have no company yet and adds
/// them to their handled cadets — the server puts each one under the
/// officer's own company (POST /cadets/:id/assign).
class RotcOfficerAddCadetsScreen extends StatefulWidget {
  const RotcOfficerAddCadetsScreen({super.key});

  @override
  State<RotcOfficerAddCadetsScreen> createState() =>
      _RotcOfficerAddCadetsScreenState();
}

class _RotcOfficerAddCadetsScreenState
    extends State<RotcOfficerAddCadetsScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _cadets = const [];

  /// Cadet ids with an add request in flight, so their button shows a spinner.
  final Set<String> _adding = {};

  /// True once at least one cadet was added — tells the roster to reload.
  bool _addedAny = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });

    try {
      final list = await UserService.instance
          .unassignedCadets(search: _searchController.text.trim());
      if (!mounted) return;
      setState(() {
        _cadets = list;
        _state = list.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  Future<void> _add(Map<String, dynamic> cadet) async {
    final id = Fmt.str(cadet['_id']);
    final name = Fmt.str(cadet['fullName'], 'this cadet');
    final company = Session.instance.brigade;

    final ok = await showConfirmDialog(
      context,
      title: 'Add cadet?',
      message: company.isEmpty
          ? 'Add $name to your handled cadets? They will be placed under your company.'
          : 'Add $name to your handled cadets? They will be placed under $company.',
      confirmLabel: 'Add',
      danger: false,
    );
    if (!ok || !mounted) return;

    setState(() => _adding.add(id));
    try {
      final message = await UserService.instance.assignCadetToMe(id);
      if (!mounted) return;
      _addedAny = true;
      AppSnack.success(context, message);
      setState(() {
        _cadets = _cadets.where((c) => Fmt.str(c['_id']) != id).toList();
        if (_cadets.isEmpty) _state = LoadState.empty;
      });
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
      _load();
    } finally {
      if (mounted) setState(() => _adding.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final company = Session.instance.brigade;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _addedAny);
      },
      child: Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        appBar: AppBar(
          backgroundColor: AppColors.primaryMaroon,
          elevation: 0,
          centerTitle: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
            onPressed: () => Navigator.pop(context, _addedAny),
          ),
          title: const Text(
            'Add Cadets',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh, color: Colors.white),
              onPressed: _load,
            ),
          ],
        ),
        body: Column(
          children: [
            Container(
              width: double.infinity,
              color: AppColors.primaryMaroon.withValues(alpha: 0.08),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Text(
                company.isEmpty
                    ? 'Registered cadets with no company yet. Cadets you add go under your company.'
                    : 'Registered cadets with no company yet. Cadets you add go under $company.',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.primaryMaroon,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                decoration: InputDecoration(
                  hintText: 'Search cadet…',
                  prefixIcon:
                      const Icon(Icons.search, color: AppColors.textSecondary),
                  suffixIcon: _searchController.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close,
                              size: 18, color: AppColors.textSecondary),
                          onPressed: () {
                            _searchController.clear();
                            _load();
                          },
                        ),
                ),
              ),
            ),
            Expanded(
              child: AsyncView(
                state: _state,
                message: _error,
                onRetry: _load,
                emptyText: _searchController.text.isEmpty
                    ? 'No unassigned cadets right now.'
                    : 'No match for "${_searchController.text}".',
                emptyIcon: Icons.person_add_alt_1_outlined,
                child: RefreshIndicator(
                  color: AppColors.primaryMaroon,
                  onRefresh: _load,
                  child: ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    itemCount: _cadets.length,
                    itemBuilder: (context, index) => _buildCadetCard(_cadets[index]),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCadetCard(Map<String, dynamic> cadet) {
    final id = Fmt.str(cadet['_id']);
    final busy = _adding.contains(id);
    final subtitle =
        '${Fmt.str(cadet['cadetId'], '—')} – ${Fmt.str(cadet['course'], '—')}';

    return AppCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          UserAvatar(
            imagePath: Fmt.str(cadet['profileImage']),
            radius: 22,
            iconSize: 20,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.str(cadet['fullName'], 'Cadet'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 34,
            child: ElevatedButton.icon(
              onPressed: busy ? null : () => _add(cadet),
              icon: busy
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.add, size: 16),
              label: const Text('Add', style: TextStyle(fontSize: 13)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryMaroon,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
