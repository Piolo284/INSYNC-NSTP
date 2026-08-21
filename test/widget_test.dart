import 'package:flutter_test/flutter_test.dart';

import 'package:marsu_nstp_portal/core/utils/login_validators.dart';

void main() {
  group('LoginValidators', () {
    test('accepts a valid email and strong password', () {
      expect(LoginValidators.isValidEmail('admin@marsu.edu.ph'), isTrue);
      expect(LoginValidators.isStrongPassword('Marsu123!'), isTrue);
    });

    test('rejects invalid email and weak password', () {
      expect(LoginValidators.isValidEmail('invalid-email'), isFalse);
      expect(LoginValidators.isStrongPassword('password'), isFalse);
      expect(LoginValidators.isStrongPassword('Marsu123'), isFalse);
      expect(LoginValidators.isStrongPassword('marsu123!'), isFalse);
      expect(LoginValidators.isStrongPassword('Marsu!'), isFalse);
    });
  });
}
