import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/widgets/async_view.dart';
import 'register_draft.dart';
import 'register_program_banner.dart';
import 'register_submit.dart';

/// Step 3 of 3 — only shown when [RegisterDraft.needsDocumentStep] is true.
/// Lets the trainee attach the document(s) their Step 2 answer requires, or
/// defer them ("Submit Later" — the account is still created; the
/// requirement just shows up as pending on the existing "My Documents"
/// screen once they log in).
class RegisterDocumentsScreen extends StatefulWidget {
  final RegisterDraft draft;

  const RegisterDocumentsScreen({super.key, required this.draft});

  @override
  State<RegisterDocumentsScreen> createState() =>
      _RegisterDocumentsScreenState();
}

class _RegisterDocumentsScreenState extends State<RegisterDocumentsScreen> {
  bool _isSubmitting = false;

  /// Document title -> locally picked file, populated as the trainee taps
  /// "Upload" on each row.
  final Map<String, PlatformFile> _picked = {};

  List<RequiredDocument> get _requirements =>
      registerDocumentRequirements[widget.draft.specialCategory] ?? const [];

  Future<void> _pickFor(RequiredDocument doc) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['jpg', 'jpeg', 'png', 'pdf'],
        // Web never returns a real filesystem path — only bytes — so the
        // upload has to travel as bytes for the document to actually reach
        // the server.
        withData: true,
      );
      final file = result?.files.first;
      if (file == null || !mounted) return;
      setState(() => _picked[doc.title] = file);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    }
  }

  List<PendingUpload> get _uploads => _picked.entries
      .map((e) => PendingUpload(
            title: e.key,
            filePath: kIsWeb ? null : e.value.path,
            fileBytes: e.value.bytes,
            fileName: e.value.name,
          ))
      .toList();

  Future<void> _submit({required bool skipDocuments}) async {
    setState(() => _isSubmitting = true);
    await submitRegistration(
      context: context,
      draft: widget.draft,
      uploads: skipDocuments ? const [] : _uploads,
    );
    if (mounted) setState(() => _isSubmitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.black87, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              Image.asset(
                'assets/images/marsu_logo.png',
                width: 90,
                height: 90,
                errorBuilder: (_, __, ___) => Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: AppColors.primaryMaroon.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.school, color: AppColors.primaryMaroon, size: 45),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Submit Required Documents',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black87),
              ),
              const SizedBox(height: 4),
              Text(
                'Please upload the required documents to proceed with your registration',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
              ),
              RegisterProgramBanner(nstpProgram: widget.draft.nstpProgram),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Required Documents',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade800),
                ),
              ),
              const SizedBox(height: 12),
              ..._requirements.map(
                (doc) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _DocumentRow(
                    doc: doc,
                    fileName: _picked[doc.title]?.name,
                    onUpload: () => _pickFor(doc),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 18),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Icon(Icons.file_upload_outlined, color: Colors.grey.shade400, size: 26),
                    const SizedBox(height: 8),
                    Text(
                      'You can submit these documents later.',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton(
                      onPressed: _isSubmitting ? null : () => _submit(skipDocuments: true),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primaryMaroon,
                        side: const BorderSide(color: AppColors.primaryMaroon),
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text(
                        'SUBMIT LATER',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : () => _submit(skipDocuments: false),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: AppColors.primaryMaroon.withValues(alpha: 0.6),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'SUBMIT & REGISTER',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1),
                        ),
                ),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}

class _DocumentRow extends StatelessWidget {
  final RequiredDocument doc;
  final String? fileName;
  final VoidCallback onUpload;

  const _DocumentRow({
    required this.doc,
    required this.fileName,
    required this.onUpload,
  });

  bool get _isPicked => fileName != null;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _isPicked ? AppColors.primaryMaroon : Colors.grey.shade300,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primaryMaroon.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.description_outlined, color: AppColors.primaryMaroon, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  doc.title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black87),
                ),
                const SizedBox(height: 2),
                Text(
                  _isPicked ? fileName!.split(RegExp(r'[\\/]')).last : '(${doc.hint})',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    color: _isPicked ? AppColors.primaryMaroon : Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton.icon(
            onPressed: onUpload,
            icon: Icon(
              _isPicked ? Icons.check_circle : Icons.upload_outlined,
              size: 16,
              color: AppColors.primaryMaroon,
            ),
            label: Text(_isPicked ? 'Change' : 'Upload'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primaryMaroon,
              side: const BorderSide(color: AppColors.primaryMaroon),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ],
      ),
    );
  }
}
