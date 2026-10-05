import 'api_service.dart';

/// College programs (BSIT, BSED, ...) and the brigade each one maps to.
/// `list()` is safe to call before login — the registration screen uses it
/// to build its course dropdown dynamically instead of a hardcoded list, so
/// a program an admin adds later shows up with no app update required.
class ProgramService {
  ProgramService._();

  static final ProgramService instance = ProgramService._();
  final ApiService _api = ApiService.instance;

  Future<List<Map<String, dynamic>>> list({String? nstpProgram, String? status}) async {
    final response = await _api.get('/programs', query: {
      'nstpProgram': nstpProgram,
      'status': status,
    });
    return ApiService.listOf(response);
  }
}
