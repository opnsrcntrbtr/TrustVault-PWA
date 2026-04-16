# TrustVault PWA - Test Suite

This directory contains comprehensive tests for all critical components up to **Phase 2.4** of the development roadmap.

## Test Structure

```
src/
├── test/
│   ├── setup.ts                          # Test environment setup
│   └── integration.test.ts               # Integration tests
├── core/
│   ├── crypto/
│   │   └── __tests__/
│   │       ├── encryption.test.ts        # Phase 0 - AES-256-GCM encryption
│   │       └── password.test.ts          # Phase 0 - Scrypt hashing
│   └── auth/
│       └── __tests__/
│           └── totp.test.ts              # Phase 2.2 - TOTP generation
├── presentation/
│   ├── store/
│   │   └── __tests__/
│   │       └── authStore.test.ts         # Phase 0 - Authentication state
│   ├── hooks/
│   │   └── __tests__/
│   │       ├── useAutoLock.test.ts       # Phase 2.3 - Auto-lock mechanism
│   │       └── usePasswordGenerator.test.ts # Phase 2.1 - Password generator
│   └── utils/
│       └── __tests__/
│           └── clipboard.test.ts         # Phase 2.4 - Secure clipboard
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (Development)
```bash
npm test -- --watch
```

### With UI
```bash
npm run test:ui
```

### Coverage Report
```bash
npm test -- --coverage
```

### Specific Test File
```bash
npm test -- encryption.test.ts
```

### Specific Test Suite
```bash
npm test -- --grep "Encryption Core"
```

## Test Coverage by Phase

### ✅ Phase 0: Critical Bug Fixes
- [x] Password hashing (Scrypt)
- [x] Key derivation (PBKDF2)
- [x] AES-256-GCM encryption/decryption
- [x] Vault key management
- [x] Authentication store

**Files**: `encryption.test.ts`, `password.test.ts`, `authStore.test.ts`

### ✅ Phase 1: Core Credential Management
- [x] CRUD operations validation
- [x] Search and filter logic
- [x] Password strength analysis
- [x] Secure password generation

**Files**: `password.test.ts`, `integration.test.ts`

### ✅ Phase 2.1: Password Generator
- [x] Secure random generation
- [x] Character type options
- [x] Exclude ambiguous characters
- [x] Strength calculation
- [x] Preferences persistence

**Files**: `usePasswordGenerator.test.ts`

### ✅ Phase 2.2: TOTP/2FA Generator
- [x] RFC 6238 compliance
- [x] Base32 decoding
- [x] 6-digit code generation
- [x] 30-second time windows
- [x] Time remaining calculation

**Files**: `totp.test.ts`

### ✅ Phase 2.3: Auto-Lock Mechanism
- [x] Inactivity detection
- [x] Timer reset on activity
- [x] Tab visibility handling
- [x] Configurable timeouts
- [x] Memory cleanup on lock

**Files**: `useAutoLock.test.ts`

### ✅ Phase 2.4: Secure Clipboard
- [x] Copy to clipboard
- [x] Auto-clear after timeout
- [x] Configurable clear duration
- [x] Multiple copy operations
- [x] Cancel mechanism

**Files**: `clipboard.test.ts`

## Coverage Targets

| Component | Target | Current |
|-----------|--------|---------|
| Core Crypto | 100% | ✅ |
| Password Utils | 100% | ✅ |
| TOTP | 95% | ✅ |
| Auth Store | 100% | ✅ |
| Auto-Lock | 90% | ✅ |
| Clipboard | 90% | ✅ |
| Integration | 80% | ✅ |

## Test Categories

### 🔐 Security Tests
- Cryptographic operations
- Key management
- Zero-knowledge validation
- OWASP compliance
- Memory security

**Critical**: These tests must pass before any deployment.

### ⚙️ Functionality Tests
- Feature correctness
- Edge cases
- Error handling
- State management
- User flows

### 🎯 Integration Tests
- End-to-end flows
- Component interaction
- Data persistence
- Authentication flow
- Credential lifecycle

## Security Test Checklist

- [x] AES-256-GCM encryption works correctly
- [x] PBKDF2 uses 600,000+ iterations (OWASP 2025)
- [x] Scrypt parameters: N=32768, r=8, p=1
- [x] Vault key never persisted to storage
- [x] Master password never logged or exposed
- [x] Constant-time comparisons for hashes
- [x] Cryptographically secure random generation
- [x] TOTP RFC 6238 compliance
- [x] Auto-clear clipboard after timeout
- [x] Memory cleared on lock/logout

## Common Test Patterns

### Crypto Operations
```typescript
it('should encrypt and decrypt correctly', async () => {
  const key = await generateEncryptionKey();
  const plaintext = 'sensitive data';
  
  const encrypted = await encrypt(plaintext, key);
  const decrypted = await decrypt(encrypted, key);
  
  expect(decrypted).toBe(plaintext);
});
```

### State Management
```typescript
it('should update state correctly', () => {
  const { result } = renderHook(() => useAuthStore());
  
  act(() => {
    result.current.setUser(mockUser);
  });
  
  expect(result.current.isAuthenticated).toBe(true);
});
```

### Async Operations
```typescript
it('should handle async operations', async () => {
  vi.useFakeTimers();
  
  const callback = vi.fn();
  setTimeout(callback, 1000);
  
  await vi.advanceTimersByTimeAsync(1000);
  
  expect(callback).toHaveBeenCalled();
  
  vi.useRealTimers();
});
```

## Troubleshooting

### Tests Failing Due to Crypto API
Ensure `setup.ts` properly mocks Web Crypto API for Node environment.

### Timer-Related Tests Flaky
Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` for deterministic tests.

### IndexedDB Tests Not Working
Mock implementation in `setup.ts` provides basic IndexedDB simulation.

### Coverage Below Target
Run `npm test -- --coverage` to identify untested code paths.

## Contributing Tests

When adding new features:

1. Create test file in `__tests__/` directory next to implementation
2. Follow existing naming convention: `feature.test.ts`
3. Include unit tests and integration tests
4. Aim for >90% coverage for security-critical code
5. Add JSDoc comments for complex test scenarios
6. Update this README with new test coverage

## CI/CD Integration

Tests run automatically on:
- Every commit (via pre-commit hook)
- Pull requests
- Before deployment

**Minimum Requirements**:
- All tests pass
- Coverage >85% overall
- Coverage 100% for crypto operations
- Zero linting errors
- Zero TypeScript errors

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
