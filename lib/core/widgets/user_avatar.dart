import 'package:flutter/material.dart';

import '../config/app_config.dart';

/// Profile picture that works with a server-relative path, an absolute URL, or
/// nothing at all — falling back to the bundled placeholder then a person icon.
///
/// Every screen that used `AssetImage('assets/images/profile.png')` now uses
/// this, so avatars come from the database without changing any layout.
class UserAvatar extends StatelessWidget {
  final String? imagePath;
  final double radius;
  final Color? backgroundColor;
  final double? iconSize;
  final Color iconColor;

  const UserAvatar({
    super.key,
    required this.imagePath,
    this.radius = 22,
    this.backgroundColor,
    this.iconSize,
    this.iconColor = Colors.white,
  });

  @override
  Widget build(BuildContext context) {
    final url = AppConfig.resolveFileUrl(imagePath);
    final size = radius * 2;
    final fallbackIcon = Icon(
      Icons.person,
      size: iconSize ?? radius,
      color: iconColor,
    );

    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor ?? Colors.grey.shade200,
      child: ClipOval(
        child: url.isEmpty
            ? Image.asset(
                'assets/images/default_profile.png',
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => fallbackIcon,
              )
            : Image.network(
                url,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Image.asset(
                  'assets/images/default_profile.png',
                  width: size,
                  height: size,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => fallbackIcon,
                ),
              ),
      ),
    );
  }
}

/// Same fallback chain for wide images (activity covers, module banners).
class RemoteImage extends StatelessWidget {
  final String? path;
  final double? width;
  final double? height;
  final BoxFit fit;
  final IconData fallbackIcon;

  const RemoteImage({
    super.key,
    required this.path,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.fallbackIcon = Icons.image_outlined,
  });

  @override
  Widget build(BuildContext context) {
    final url = AppConfig.resolveFileUrl(path);

    Widget placeholder() => Container(
          width: width,
          height: height,
          color: Colors.grey.shade200,
          child: Center(
            child: Icon(fallbackIcon, color: Colors.grey.shade400, size: 32),
          ),
        );

    if (url.isEmpty) return placeholder();

    return Image.network(
      url,
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (_, _, _) => placeholder(),
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return Container(
          width: width,
          height: height,
          color: Colors.grey.shade100,
          child: const Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        );
      },
    );
  }
}
