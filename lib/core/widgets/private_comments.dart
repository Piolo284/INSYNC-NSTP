import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../services/services.dart';
import '../utils/formatters.dart';
import 'async_view.dart';
import 'user_avatar.dart';

/// Google Classroom-style private comments between one trainee and the
/// officers who handle them, for a single module. Only that trainee and
/// their officers can see the thread. It stays open after the due date —
/// it's how a trainee raises a concern about Missing work.
///
/// Trainees leave [studentId] null (they only get their own thread); staff
/// pass the trainee's user id.
class PrivateCommentsSection extends StatefulWidget {
  final String moduleId;
  final String? studentId;

  const PrivateCommentsSection({
    super.key,
    required this.moduleId,
    this.studentId,
  });

  @override
  State<PrivateCommentsSection> createState() => _PrivateCommentsSectionState();
}

class _PrivateCommentsSectionState extends State<PrivateCommentsSection> {
  final TextEditingController _controller = TextEditingController();

  LoadState _state = LoadState.loading;
  String _error = '';
  List<Map<String, dynamic>> _comments = const [];
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _state = LoadState.loading;
      _error = '';
    });
    try {
      final list = await ModuleService.instance
          .privateComments(widget.moduleId, studentId: widget.studentId);
      if (!mounted) return;
      setState(() {
        _comments = list;
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

  Future<void> _send() async {
    final message = _controller.text.trim();
    if (message.isEmpty || _sending) return;

    setState(() => _sending = true);
    try {
      final comment = await ModuleService.instance.addPrivateComment(
        widget.moduleId,
        message,
        studentId: widget.studentId,
      );
      if (!mounted) return;
      _controller.clear();
      setState(() => _comments = [..._comments, comment]);
    } catch (error) {
      if (!mounted) return;
      AppSnack.error(context, describeError(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.lock_outline, size: 16, color: AppColors.textSecondary),
            const SizedBox(width: 6),
            Text(
              _comments.isEmpty
                  ? 'Private comments'
                  : 'Private comments (${_comments.length})',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          widget.studentId == null
              ? 'Only you and your officer can see these.'
              : 'Only this student and their officers can see these.',
          style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 10),
        if (_state == LoadState.loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppColors.primaryMaroon),
              ),
            ),
          )
        else if (_state == LoadState.error)
          Row(
            children: [
              Expanded(
                child: Text(
                  _error,
                  style: const TextStyle(fontSize: 12, color: AppColors.error),
                ),
              ),
              TextButton(onPressed: _load, child: const Text('Retry')),
            ],
          )
        else
          ..._comments.map(_buildComment),
        const SizedBox(height: 6),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                minLines: 1,
                maxLines: 4,
                maxLength: 2000,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  hintText: 'Add a private comment…',
                  counterText: '',
                ),
              ),
            ),
            const SizedBox(width: 6),
            IconButton(
              tooltip: 'Send',
              onPressed: _sending ? null : _send,
              icon: _sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: AppColors.primaryMaroon),
                    )
                  : const Icon(Icons.send, color: AppColors.primaryMaroon),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildComment(Map<String, dynamic> c) {
    final author = (c['authorId'] is Map)
        ? (c['authorId'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    final isMine = Fmt.str(author['_id']) == Session.instance.userId;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UserAvatar(
            imagePath: Fmt.str(author['profileImage']),
            radius: 15,
            iconSize: 15,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: isMine ? 'You' : Fmt.str(author['name'], 'User'),
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      TextSpan(
                        text: '  ${Fmt.dateTimeShort(c['createdAt'], fallback: '')}',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  Fmt.str(c['message']),
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textPrimary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Full-screen version of [PrivateCommentsSection] for an officer replying
/// to one trainee.
class PrivateCommentsScreen extends StatelessWidget {
  final String moduleId;
  final String studentId;
  final String studentName;
  final String moduleTitle;

  const PrivateCommentsScreen({
    super.key,
    required this.moduleId,
    required this.studentId,
    required this.studentName,
    required this.moduleTitle,
  });

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
        title: Column(
          children: [
            Text(
              studentName,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              moduleTitle,
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.8),
                fontSize: 11.5,
              ),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: PrivateCommentsSection(moduleId: moduleId, studentId: studentId),
      ),
    );
  }
}
