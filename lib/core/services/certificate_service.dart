import 'api_service.dart';

class CertificateService {
  CertificateService._();

  static final CertificateService instance = CertificateService._();
  final ApiService _api = ApiService.instance;

  /// The signed-in trainee's own filed certificate requests.
  Future<List<Map<String, dynamic>>> mine() async {
    final response = await _api.get('/certificate-requests/mine');
    return ApiService.listOf(response);
  }

  Future<Map<String, dynamic>> create({
    required String type,
    String purpose = '',
  }) async {
    final response = await _api.post('/certificate-requests', body: {
      'type': type,
      'purpose': purpose,
    });
    return ApiService.mapOf(response);
  }
}
