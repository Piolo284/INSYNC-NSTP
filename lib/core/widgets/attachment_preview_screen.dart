import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_config.dart';
import '../constants/app_colors.dart';
import 'async_view.dart';

enum _PreviewKind { image, video, youtube, document, unsupported }

/// Full-screen in-app preview for a module/activity attachment — PDF,
/// Office documents (via Google's document viewer), a directly-hosted
/// video file, or a YouTube link, so a trainee never has to leave the app
/// or download the file just to see what's inside it. Falls back to a plain
/// "Open Externally" action for anything it can't render (e.g. a zip).
///
/// Uses `flutter_inappwebview` rather than `webview_flutter` — this app also
/// ships a Windows desktop build (see windows/), and `webview_flutter` has no
/// Windows implementation at all, while `flutter_inappwebview` covers
/// Android/iOS/macOS/Windows/web from one API.
class AttachmentPreviewScreen extends StatefulWidget {
  /// The raw `fileUrl` value from the backend — may be a relative uploaded
  /// path or a full external link (YouTube, etc.); resolved here.
  final String fileUrl;
  final String fileName;

  const AttachmentPreviewScreen({
    super.key,
    required this.fileUrl,
    required this.fileName,
  });

  @override
  State<AttachmentPreviewScreen> createState() => _AttachmentPreviewScreenState();
}

class _AttachmentPreviewScreenState extends State<AttachmentPreviewScreen> {
  static const _imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
  static const _videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
  static const _docExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];

  late final String _resolvedUrl;
  late final _PreviewKind _kind;
  bool _loading = true;
  bool _loadFailed = false;

  /// Uploaded files are served from `/api/files/<id>` — a URL with no
  /// extension — so the original file name decides the type; the URL's own
  /// extension is only used for external links that have one.
  String get _extension {
    final fromName = fileExtensionOf(widget.fileName);
    if (fromName.isNotEmpty) return fromName;
    final path = Uri.tryParse(_resolvedUrl)?.path ?? _resolvedUrl;
    return fileExtensionOf(path);
  }

  /// False for localhost, 10.x, 192.168.x and 172.16–31.x — addresses an
  /// outside service such as Google's viewer can never reach.
  bool get _isPubliclyReachable {
    final host = Uri.tryParse(_resolvedUrl)?.host ?? '';
    if (host.isEmpty || host == 'localhost' || host.startsWith('127.') || host.startsWith('10.') ||
        host.startsWith('192.168.')) {
      return false;
    }
    final m = RegExp(r'^172\.(\d+)\.').firstMatch(host);
    if (m != null) {
      final second = int.parse(m.group(1)!);
      if (second >= 16 && second <= 31) return false;
    }
    return true;
  }

  bool get _isYouTube =>
      _resolvedUrl.contains('youtube.com') || _resolvedUrl.contains('youtu.be');

  String? _youTubeVideoId() {
    final uri = Uri.tryParse(_resolvedUrl);
    if (uri == null) return null;
    if (uri.host.contains('youtu.be')) {
      return uri.pathSegments.isNotEmpty ? uri.pathSegments.first : null;
    }
    return uri.queryParameters['v'];
  }

  _PreviewKind _resolveKind() {
    if (_isYouTube) return _PreviewKind.youtube;
    if (_imageExts.contains(_extension)) return _PreviewKind.image;
    if (_videoExts.contains(_extension)) return _PreviewKind.video;
    if (_docExts.contains(_extension)) {
      // Google's document viewer has to download the file itself, so it can
      // only preview files on a public server. Everything else (a backend on
      // localhost / the LAN) used to end in Google's "No preview available".
      // A browser can show a PDF on its own, so on web a PDF always previews.
      if (_extension == 'pdf' && kIsWeb) return _PreviewKind.document;
      return _isPubliclyReachable ? _PreviewKind.document : _PreviewKind.unsupported;
    }
    return _PreviewKind.unsupported;
  }

  @override
  void initState() {
    super.initState();
    _resolvedUrl = AppConfig.resolveFileUrl(widget.fileUrl);
    _kind = _resolveKind();
    if (_kind == _PreviewKind.image || _kind == _PreviewKind.unsupported) {
      _loading = false;
    }
  }

  String _videoHtml(String src) => '''
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html, body { margin: 0; background: #000; height: 100%; }
      video { width: 100%; height: 100%; object-fit: contain; }
    </style>
  </head>
  <body>
    <video src="$src" controls autoplay playsinline></video>
  </body>
</html>
''';

  String _embedUrl() {
    if (_kind == _PreviewKind.youtube) {
      final id = _youTubeVideoId();
      return id == null
          ? _resolvedUrl
          : 'https://www.youtube.com/embed/$id?autoplay=1&playsinline=1';
    }
    // In a browser a PDF is shown by the browser's own PDF viewer.
    if (kIsWeb && _extension == 'pdf') return _resolvedUrl;
    // Google's viewer renders PDF/Office documents inline without needing
    // a native renderer package for each format (public files only).
    return 'https://docs.google.com/viewer?embedded=true&url=${Uri.encodeComponent(_resolvedUrl)}';
  }

  Future<void> _openExternally() async {
    final uri = Uri.tryParse(_resolvedUrl);
    if (uri == null) {
      if (mounted) AppSnack.error(context, 'That link looks invalid.');
      return;
    }
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened && mounted) {
        AppSnack.error(context, 'No app is available to open this file.');
      }
    } catch (error) {
      if (mounted) AppSnack.error(context, describeError(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.black,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        foregroundColor: AppColors.white,
        title: Text(
          widget.fileName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: AppColors.white, fontSize: 16, fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.open_in_new, size: 20),
            tooltip: 'Open Externally',
            onPressed: _openExternally,
          ),
        ],
      ),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    switch (_kind) {
      case _PreviewKind.image:
        return Center(
          child: InteractiveViewer(
            child: Image.network(
              _resolvedUrl,
              fit: BoxFit.contain,
              errorBuilder: (_, _, _) => _buildUnsupported(),
            ),
          ),
        );
      case _PreviewKind.unsupported:
        return _buildUnsupported();
      case _PreviewKind.video:
      case _PreviewKind.youtube:
      case _PreviewKind.document:
        if (_loadFailed) return _buildUnsupported();
        return Stack(
          children: [
            Container(
              color: AppColors.white,
              child: InAppWebView(
                initialSettings: InAppWebViewSettings(
                  mediaPlaybackRequiresUserGesture: false,
                  javaScriptEnabled: true,
                ),
                initialData: _kind == _PreviewKind.video
                    ? InAppWebViewInitialData(data: _videoHtml(_resolvedUrl))
                    : null,
                initialUrlRequest: _kind == _PreviewKind.video
                    ? null
                    : URLRequest(url: WebUri(_embedUrl())),
                onLoadStop: (controller, url) {
                  if (mounted) setState(() => _loading = false);
                },
                onReceivedError: (controller, request, error) {
                  if (mounted) {
                    setState(() {
                      _loading = false;
                      _loadFailed = true;
                    });
                  }
                },
              ),
            ),
            if (_loading)
              const Center(child: CircularProgressIndicator(color: AppColors.primaryMaroon)),
          ],
        );
    }
  }

  Widget _buildUnsupported() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.insert_drive_file_outlined, size: 56, color: AppColors.white),
            const SizedBox(height: 16),
            Text(
              _docExts.contains(_extension)
                  // A document on a local/LAN server — viewable, just not
                  // through Google's online viewer.
                  ? "This ${_extension.toUpperCase()} file can't be shown inside the app on this connection. Open it to view it."
                  : "This file type can't be previewed in the app.",
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.white, fontSize: 14),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _openExternally,
              icon: const Icon(Icons.open_in_new, size: 18),
              label: Text(_docExts.contains(_extension) ? 'Open File' : 'Open Externally'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pushes [AttachmentPreviewScreen] for `fileUrl` — the one-line call every
/// attachment tile makes instead of downloading/launching externally.
Future<void> openAttachmentPreview(
  BuildContext context, {
  required String fileUrl,
  required String fileName,
}) {
  return Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => AttachmentPreviewScreen(fileUrl: fileUrl, fileName: fileName),
    ),
  );
}

/// Lower-case extension of a file name or path ("Photo.JPG" → "jpg"), or ''.
String fileExtensionOf(String name) {
  final slash = name.lastIndexOf('/');
  final base = slash == -1 ? name : name.substring(slash + 1);
  final dot = base.lastIndexOf('.');
  return dot <= 0 || dot == base.length - 1 ? '' : base.substring(dot + 1).toLowerCase();
}

/// Icon, colours and a readable label for a file, from its real extension —
/// so a JPG shows as a JPG image, never as a PDF.
class FileTypeInfo {
  final IconData icon;
  final Color color;
  final Color background;
  final String label;

  const FileTypeInfo(this.icon, this.color, this.background, this.label);

  factory FileTypeInfo.of(String fileName) {
    final ext = fileExtensionOf(fileName);
    final upper = ext.toUpperCase();
    switch (ext) {
      case 'pdf':
        return const FileTypeInfo(Icons.picture_as_pdf, AppColors.error, AppColors.errorLight, 'PDF document');
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
      case 'gif':
      case 'bmp':
        return FileTypeInfo(Icons.image_outlined, AppColors.success, AppColors.greenLight, '$upper image');
      case 'doc':
      case 'docx':
        return FileTypeInfo(Icons.description_outlined, AppColors.blue, AppColors.blueLight, '$upper document');
      case 'ppt':
      case 'pptx':
      case 'xls':
      case 'xlsx':
      case 'csv':
      case 'txt':
        return FileTypeInfo(Icons.insert_drive_file_outlined, AppColors.orange, AppColors.orangeLight, '$upper file');
      default:
        return FileTypeInfo(
          Icons.insert_drive_file_outlined,
          AppColors.textSecondary,
          AppColors.grey50,
          upper.isEmpty ? 'File' : '$upper file',
        );
    }
  }
}
