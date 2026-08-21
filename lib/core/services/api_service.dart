import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

/// Any failure the UI can meaningfully show to the user.
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  const ApiException(this.message, {this.statusCode});

  bool get isUnauthorized => statusCode == 401 || statusCode == 403;
  bool get isNetworkError => statusCode == null;
  bool get isConflict => statusCode == 409;

  @override
  String toString() => message;
}

/// Thin HTTP layer shared by every feature service.
///
/// Every screen talks to a feature service (auth_service, activity_service…),
/// never to `http` directly, so swapping the transport or adding headers is a
/// one-file change.
class ApiService {
  ApiService._();

  static final ApiService instance = ApiService._();

  final http.Client _client = http.Client();
  String? _token;

  /// Called once at start-up so a signed-in user stays signed in.
  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(AppConfig.tokenKey);
  }

  String? get token => _token;
  bool get isAuthenticated => _token != null && _token!.isNotEmpty;

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token == null) {
      await prefs.remove(AppConfig.tokenKey);
    } else {
      await prefs.setString(AppConfig.tokenKey, token);
    }
  }

  Map<String, String> _headers({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (isAuthenticated) 'Authorization': 'Bearer $_token',
      };

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final clean = path.startsWith('/') ? path : '/$path';
    final params = <String, String>{};
    query?.forEach((key, value) {
      if (value == null) return;
      final str = value.toString();
      if (str.isEmpty) return;
      params[key] = str;
    });
    return Uri.parse('${AppConfig.apiBaseUrl}$clean')
        .replace(queryParameters: params.isEmpty ? null : params);
  }

  // ---------------------------------------------------------------
  // Verbs
  // ---------------------------------------------------------------

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) {
    return _send(() => _client.get(_uri(path, query), headers: _headers()));
  }

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) {
    return _send(() => _client.post(
          _uri(path),
          headers: _headers(),
          body: jsonEncode(body ?? const {}),
        ));
  }

  Future<Map<String, dynamic>> put(String path, {Map<String, dynamic>? body}) {
    return _send(() => _client.put(
          _uri(path),
          headers: _headers(),
          body: jsonEncode(body ?? const {}),
        ));
  }

  Future<Map<String, dynamic>> delete(String path) {
    return _send(() => _client.delete(_uri(path), headers: _headers()));
  }

  /// Multipart upload used by module files, submissions and activity photos.
  Future<Map<String, dynamic>> upload(
    String path, {
    required Map<String, String> fields,
    String? filePath,
    String fileField = 'file',
    String method = 'POST',
  }) async {
    try {
      final request = http.MultipartRequest(method, _uri(path))
        ..headers.addAll(_headers(json: false))
        ..fields.addAll(fields);

      if (filePath != null && filePath.isNotEmpty) {
        request.files.add(await http.MultipartFile.fromPath(fileField, filePath));
      }

      final streamed = await request.send().timeout(AppConfig.requestTimeout);
      final response = await http.Response.fromStream(streamed);
      return _decode(response);
    } on SocketException {
      throw const ApiException('Unable to connect to server.');
    } on TimeoutException {
      throw const ApiException('The server took too long to respond.');
    } on http.ClientException {
      throw const ApiException('Unable to connect to server.');
    }
  }

  // ---------------------------------------------------------------
  // Plumbing
  // ---------------------------------------------------------------

  Future<Map<String, dynamic>> _send(
    Future<http.Response> Function() request,
  ) async {
    try {
      final response = await request().timeout(AppConfig.requestTimeout);
      return _decode(response);
    } on SocketException {
      throw const ApiException('Unable to connect to server.');
    } on TimeoutException {
      throw const ApiException('The server took too long to respond.');
    } on http.ClientException {
      throw const ApiException('Unable to connect to server.');
    } on FormatException {
      throw const ApiException('Received an invalid response from the server.');
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> body;
    try {
      final decoded = jsonDecode(response.body);
      body = decoded is Map<String, dynamic> ? decoded : {'data': decoded};
    } catch (_) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {'success': true, 'data': response.body};
      }
      throw ApiException(
        'Something went wrong. Please try again.',
        statusCode: response.statusCode,
      );
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    throw ApiException(
      (body['message'] as String?) ?? 'Something went wrong. Please try again.',
      statusCode: response.statusCode,
    );
  }

  /// Normalises `{ data: [...] }` into a typed list.
  static List<Map<String, dynamic>> listOf(Map<String, dynamic> response) {
    final data = response['data'];
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    return const [];
  }

  /// Normalises `{ data: {...} }` into a map.
  static Map<String, dynamic> mapOf(Map<String, dynamic> response) {
    final data = response['data'];
    return data is Map<String, dynamic> ? data : <String, dynamic>{};
  }
}
