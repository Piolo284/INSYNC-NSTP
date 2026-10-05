/// Accumulates everything collected across the three registration steps
/// (basic info → additional information → required documents) so each step
/// only needs to know about the fields it actually adds.
class RegisterDraft {
  RegisterDraft({required this.portalType});

  /// 'cwts' or 'rotc' — decides the NSTP program this account registers into.
  final String portalType;

  // Step 1 — basic info.
  String studentId = '';
  String name = '';
  String email = '';
  String password = '';
  String course = '';
  String yearLevel = '';
  String campus = '';

  // Step 2 — additional information.
  String specialCategory = kCategoryNone;

  String get nstpProgram => portalType == 'rotc' ? 'ROTC' : 'CWTS';

  /// Whether [specialCategory] requires a supporting document before the
  /// account is considered fully onboarded (mirrors the requirement map in
  /// [registerDocumentRequirements]).
  bool get needsDocumentStep => specialCategory != kCategoryNone;
}

/// The MARSU campuses a trainee can register under.
const List<String> kCampuses = [
  'MARSU - Boac (Main)',
  'MARSU - Torrijos',
  'MARSU - Sta. Cruz',
  'MARSU - Gasan',
];

/// Campuses that do not offer ROTC — only CWTS is available there.
const List<String> kRotcRestrictedCampuses = [
  'MARSU - Torrijos',
  'MARSU - Gasan',
];

const String kCategoryNone = 'None';
const String kCategoryPwd = 'PWD';
const String kCategorySkChair = 'SK Chairperson';
const String kCategoryMedical = 'Medical Condition';

/// One requirement document a given [RegisterDraft.specialCategory] needs
/// submitted, matching the shape the existing "My Documents" screen already
/// understands (a `Document` row keyed by owner + title).
class RequiredDocument {
  const RequiredDocument({required this.title, required this.hint});

  final String title;
  final String hint;
}

/// Which document(s) the "Submit Required Documents" step should ask for,
/// keyed by the category chosen on the "Additional Information" step.
const Map<String, List<RequiredDocument>> registerDocumentRequirements = {
  kCategoryPwd: [
    RequiredDocument(title: 'PWD ID', hint: 'JPG, PNG or PDF'),
  ],
  kCategorySkChair: [
    RequiredDocument(
      title: 'SK Chairperson Certification',
      hint: 'JPG, PNG or PDF',
    ),
  ],
  kCategoryMedical: [
    RequiredDocument(title: 'Medical Certificate', hint: 'JPG, PNG or PDF'),
  ],
};
