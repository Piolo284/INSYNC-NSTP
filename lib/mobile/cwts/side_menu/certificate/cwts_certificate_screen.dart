import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/services.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_dialogs.dart';
import '../../../../core/widgets/async_view.dart';
import '../../../../core/widgets/status_badge.dart';

/// Trainee's own certificate requests (e.g. Certificate of Completion), plus
/// the form to file a new one. Reviewed by program admins on the web portal.
class CwtsCertificateScreen extends StatefulWidget {
  const CwtsCertificateScreen({super.key});

  @override
  State<CwtsCertificateScreen> createState() => _CwtsCertificateScreenState();
}

class _CwtsCertificateScreenState extends State<CwtsCertificateScreen> {
  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _requests = const [];

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
      final result = await CertificateService.instance.mine();
      if (!mounted) return;
      setState(() {
        _requests = result;
        _state = result.isEmpty ? LoadState.empty : LoadState.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _state = LoadState.error;
        _error = describeError(error);
      });
    }
  }

  Future<void> _openCertificate(String fileUrl) async {
    final uri = Uri.tryParse(AppConfig.resolveFileUrl(fileUrl));
    if (uri == null) {
      AppSnack.error(context, 'That file link looks invalid.');
      return;
    }
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened && mounted) {
        AppSnack.error(context, 'Could not open the file. No app is available to view it.');
      }
    } catch (error) {
      if (mounted) AppSnack.error(context, describeError(error));
    }
  }

  Future<void> _requestCertificate() async {
    final requested = await showAppBottomSheet<bool>(
      context,
      title: 'Request a Certificate',
      child: const _RequestCertificateForm(),
    );
    if (requested == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Certificate Request',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.white, size: 20),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: AsyncView(
              state: _state,
              message: _error,
              onRetry: _load,
              emptyText: 'No certificate requests yet. Tap the button below to request one.',
              emptyIcon: Icons.workspace_premium_outlined,
              child: RefreshIndicator(
                color: AppColors.primaryMaroon,
                onRefresh: _load,
                child: ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: _requests.length,
                  itemBuilder: (context, index) => _buildRequestCard(_requests[index]),
                ),
              ),
            ),
          ),
          Container(
            color: AppColors.white,
            padding: const EdgeInsets.all(20),
            child: SafeArea(
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _requestCertificate,
                  child: const Text(
                    'Request a Certificate',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRequestCard(Map<String, dynamic> r) {
    final type = Fmt.str(r['type'], 'Certificate');
    final status = Fmt.str(r['status'], 'Pending');
    final purpose = Fmt.str(r['purpose']);
    final reviewNote = Fmt.str(r['reviewNote']);
    final certificateUrl = Fmt.str(r['certificateUrl']);
    final style = StatusStyle.of(status);

    return AppCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: style.background,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.workspace_premium_outlined, color: style.color, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  type,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              StatusBadge(status, dense: true),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Requested ${Fmt.date(r['createdAt'], fallback: '—')}',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          if (purpose.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Purpose: $purpose',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
          if (reviewNote.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Note: $reviewNote',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
            ),
          ],
          if (certificateUrl.isNotEmpty) ...[
            const SizedBox(height: 10),
            TextButton.icon(
              onPressed: () => _openCertificate(certificateUrl),
              icon: const Icon(Icons.download_outlined, size: 16),
              label: const Text(
                'Download Certificate',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _RequestCertificateForm extends StatefulWidget {
  const _RequestCertificateForm();

  @override
  State<_RequestCertificateForm> createState() => _RequestCertificateFormState();
}

class _RequestCertificateFormState extends State<_RequestCertificateForm> {
  /// The only certificate a trainee can request — the backend rejects any
  /// other type (certificateRequestController.create).
  static const List<String> _types = ['Certificate of Completion'];

  String _selectedType = _types.first;
  final TextEditingController _purposeController = TextEditingController();
  bool _isSaving = false;

  @override
  void dispose() {
    _purposeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final type = _selectedType;

    setState(() => _isSaving = true);
    try {
      await CertificateService.instance.create(
        type: type,
        purpose: _purposeController.text.trim(),
      );
      if (!mounted) return;
      AppSnack.success(context, 'Certificate request submitted.');
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Certificate type',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppColors.radiusSm),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: _selectedType,
              icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.textSecondary),
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              onChanged: (v) => setState(() => _selectedType = v!),
              items: _types.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Purpose (optional)',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _purposeController,
          maxLines: 3,
          maxLength: 200,
          decoration: const InputDecoration(hintText: 'e.g. For scholarship application'),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isSaving ? null : _submit,
            child: _isSaving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.white),
                    ),
                  )
                : const Text('Submit Request'),
          ),
        ),
      ],
    );
  }
}
