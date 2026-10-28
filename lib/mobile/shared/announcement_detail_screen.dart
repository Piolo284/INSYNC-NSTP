import 'package:flutter/material.dart';
import 'announcement_link.dart';
import '../../core/config/app_config.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_card.dart';
import '../../core/widgets/attachment_preview_screen.dart';

/// Clean, single-announcement detail view — shared by the CWTS and ROTC
/// announcement lists. When the announcement links to a quiz, module,
/// activity or attendance page, an "Open …" button leads straight there.
class AnnouncementDetailScreen extends StatelessWidget {
  final Map<String, dynamic> announcement;

  const AnnouncementDetailScreen({super.key, required this.announcement});

  @override
  Widget build(BuildContext context) {
    final isPinned = announcement['isPinned'] == true;
    final imageUrl = Fmt.str(announcement['imageUrl']);
    final linked = hasAnnouncementLink(announcement);

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.primaryMaroon,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text(
          'Announcement',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // The program's AnnouncementTemplate poster for this announcement
            // (see admin/src/utils/announcementGenerator.js) — tap to view
            // full-screen. Falls back to nothing if no template was configured.
            if (imageUrl.isNotEmpty) ...[
              GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AttachmentPreviewScreen(
                      fileUrl: imageUrl,
                      fileName: Fmt.str(
                        announcement['imageName'],
                        'announcement.png',
                      ),
                    ),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppColors.radius),
                  child: Image.network(
                    AppConfig.resolveFileUrl(imageUrl),
                    fit: BoxFit.contain,
                    width: double.infinity,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isPinned) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.goldLight,
                        borderRadius: BorderRadius.circular(AppColors.radiusSm),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(
                            Icons.push_pin,
                            size: 13,
                            color: AppColors.primaryDark,
                          ),
                          SizedBox(width: 5),
                          Text(
                            'Pinned Announcement',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  Text(
                    Fmt.str(announcement['title'], 'Announcement'),
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  InfoRow(
                    icon: Icons.calendar_today_outlined,
                    label: 'Date',
                    value: Fmt.dateWithDay(announcement['date']),
                  ),
                  if (Fmt.str(announcement['time']).isNotEmpty)
                    InfoRow(
                      icon: Icons.access_time,
                      label: 'Time',
                      value: Fmt.str(announcement['time']),
                    ),
                  if (Fmt.str(announcement['location']).isNotEmpty)
                    InfoRow(
                      icon: Icons.location_on_outlined,
                      label: 'Location',
                      value: Fmt.str(announcement['location']),
                    ),
                  const SizedBox(height: 10),
                  const Divider(),
                  const SizedBox(height: 10),
                  Text(
                    Fmt.str(announcement['content'], 'No details provided.'),
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                      height: 1.6,
                    ),
                  ),
                  if (linked) ...[
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => openAnnouncementLink(
                          context,
                          linkType: announcementLinkType(announcement),
                          linkId: Fmt.str(announcement['linkId']),
                        ),
                        icon: Icon(announcementLinkIcon(announcement), size: 18),
                        label: Text(announcementLinkLabel(announcement)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primaryMaroon,
                          foregroundColor: AppColors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusSm),
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
    );
  }
}
