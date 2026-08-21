import 'package:intl/intl.dart';

/// Shared date/number formatting so every screen keeps the display style the
/// mock-ups already use ("May 13, 2026", "11:30 AM", "May 13, 2026 | 11:30 AM").
class Fmt {
  Fmt._();

  static DateTime? parse(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    return DateTime.tryParse(value.toString())?.toLocal();
  }

  /// "May 13, 2026"
  static String date(dynamic value, {String fallback = '—'}) {
    final d = parse(value);
    if (d == null) return fallback;
    return DateFormat('MMM d, yyyy').format(d);
  }

  /// "May 13, 2026 (Sat)"
  static String dateWithDay(dynamic value, {String fallback = '—'}) {
    final d = parse(value);
    if (d == null) return fallback;
    return '${DateFormat('MMM d, yyyy').format(d)} (${DateFormat('E').format(d)})';
  }

  /// "May 13, 2026 | Saturday"
  static String dateLong(dynamic value, {String fallback = '—'}) {
    final d = parse(value);
    if (d == null) return fallback;
    return '${DateFormat('MMMM d, yyyy').format(d)} | ${DateFormat('EEEE').format(d)}';
  }

  /// "Saturday, June 27, 2026"
  static String dayDateLong(dynamic value, {String fallback = '—'}) {
    final d = parse(value);
    if (d == null) return fallback;
    return DateFormat('EEEE, MMMM d, yyyy').format(d);
  }

  /// "11:30 AM"
  static String time(dynamic value, {String fallback = '—'}) {
    final d = parse(value);
    if (d == null) return fallback;
    return DateFormat('h:mm a').format(d);
  }

  /// "May 13, 2026 | 11:30 AM"
  static String dateTime(dynamic value, {String fallback = '—'}) {
    final d = parse(value);
    if (d == null) return fallback;
    return '${DateFormat('MMM d, yyyy').format(d)} | ${DateFormat('h:mm a').format(d)}';
  }

  /// "May 23, 2026 9:12 AM"
  static String dateTimeShort(dynamic value, {String fallback = '—'}) {
    final d = parse(value);
    if (d == null) return fallback;
    return DateFormat('MMM d, yyyy h:mm a').format(d);
  }

  /// Server sends "HH:mm"; screens display "8:00 AM".
  static String clock(String? hhmm, {String fallback = '—'}) {
    if (hhmm == null || hhmm.isEmpty) return fallback;
    final parts = hhmm.split(':');
    if (parts.length < 2) return hhmm;
    final h = int.tryParse(parts[0]) ?? 0;
    final m = parts[1].padLeft(2, '0');
    final suffix = h >= 12 ? 'PM' : 'AM';
    final display = h % 12 == 0 ? 12 : h % 12;
    return '$display:$m $suffix';
  }

  /// yyyy-MM-dd, the format every API date query expects.
  static String apiDate(DateTime date) => DateFormat('yyyy-MM-dd').format(date);

  /// "Good Morning" / "Good Afternoon" / "Good Evening"
  static String greeting([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  /// "1.2 MB"
  static String fileSize(dynamic bytes) {
    final b = (bytes is num) ? bytes.toDouble() : double.tryParse('$bytes') ?? 0;
    if (b <= 0) return '—';
    if (b < 1024) return '${b.toStringAsFixed(0)} B';
    if (b < 1024 * 1024) return '${(b / 1024).toStringAsFixed(0)} KB';
    return '${(b / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  /// "1,250"
  static String count(dynamic value) {
    final n = (value is num) ? value : num.tryParse('$value') ?? 0;
    return NumberFormat.decimalPattern().format(n);
  }

  static double toDouble(dynamic value, [double fallback = 0]) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? fallback;
  }

  static int toInt(dynamic value, [int fallback = 0]) {
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? fallback;
  }

  static String str(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    final s = value.toString();
    return s.isEmpty ? fallback : s;
  }
}
