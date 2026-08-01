# Contributing to TrustVault PWA

First off, thank you for considering contributing to TrustVault! This is a security-focused project, so we have specific guidelines to maintain the highest standards.

## 🔒 Security First

This is a **security-critical application**. All contributions must:

1. Follow security best practices
2. Not introduce vulnerabilities
3. Maintain OWASP Mobile Top 10 2025 compliance
4. Preserve zero-knowledge architecture
5. Include security considerations in PRs

## 🚀 Quick Start

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/trustvault-pwa.git
   cd trustvault-pwa
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Your Changes**
   - Follow TypeScript strict mode
   - Write clean, documented code
   - Add tests for new features
   - Update documentation

5. **Run Quality Checks**
   ```bash
   npm run type-check
   npm run lint
   npm run format
   npm run security:audit
   npm run test
   ```

6. **Commit Your Changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

7. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📝 Code Standards

### TypeScript
- Use strict mode (already configured)
- Explicit return types for functions
- No `any` types (use `unknown` if needed)
- Prefer interfaces over types for objects
- Use const assertions where appropriate

### React
- Functional components only
- Custom hooks for reusable logic
- Proper dependency arrays in useEffect
- Memoization for expensive computations
- Avoid prop drilling (use Zustand)

### Security
- Never log sensitive data
- No console.log in production code
- Validate all inputs
- Use constant-time comparisons
- Secure random number generation only

### Testing
- Unit tests for utilities
- Integration tests for features
- Security tests for crypto functions
- Mock external dependencies

## 🏗️ Architecture Guidelines

### Clean Architecture Layers

```
presentation/  → UI components, pages, state
domain/        → Business logic, entities, interfaces
data/          → Implementations, storage, API calls
core/          → Utilities, crypto, authentication
```

**Rules:**
- Presentation can import from domain and core
- Domain cannot import from presentation or data
- Data can import from domain and core
- Core has no internal dependencies

### File Structure

```typescript
// Good
src/
  domain/
    entities/
      User.ts          # Entity definition
    repositories/
      IUserRepository.ts  # Interface

  data/
    repositories/
      UserRepositoryImpl.ts  # Implementation

// Bad - Don't mix layers
src/
  components/
    UserRepository.ts  # Wrong layer!
```

## 🧪 Testing Requirements

### What to Test
- ✅ Cryptographic functions (100% coverage required)
- ✅ Business logic
- ✅ State management
- ✅ Component rendering
- ✅ Error handling

### What Not to Test
- ❌ Third-party libraries
- ❌ Material-UI components
- ❌ Simple getters/setters

### Example Test
```typescript
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/core/crypto/encryption';

describe('Encryption', () => {
  it('should encrypt and decrypt data correctly', async () => {
    const plaintext = 'sensitive data';
    const key = await generateEncryptionKey();
    
    const encrypted = await encrypt(plaintext, key);
    const decrypted = await decrypt(encrypted, key);
    
    expect(decrypted).toBe(plaintext);
  });
});
```

## 🎨 Code Style

We use **ESLint** and **Prettier** for consistent formatting.

```bash
# Format code
npm run format

# Fix linting issues
npm run lint:fix
```

### Naming Conventions
- **Components**: PascalCase (`LoginPage.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAuth.ts`)
- **Utilities**: camelCase (`encryption.ts`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_PASSWORD_LENGTH`)
- **Interfaces**: PascalCase with `I` prefix (`IUserRepository`)
- **Types**: PascalCase (`CredentialCategory`)

## 📋 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance
- `security`: Security improvements

### Examples
```bash
feat(auth): add biometric authentication support
fix(crypto): constant-time comparison in password verification
docs(security): update OWASP compliance documentation
security(storage): implement secure memory wipe on logout
```

## 🔍 Pull Request Process

1. **Before Submitting**
   - ✅ All tests pass
   - ✅ No linting errors
   - ✅ Type checking passes
   - ✅ Security audit clean
   - ✅ Documentation updated
   - ✅ CHANGELOG.md updated (for features)

2. **PR Description Template**
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Security Impact
   Describe any security implications
   
   ## Testing
   - [ ] Unit tests added/updated
   - [ ] Integration tests added/updated
   - [ ] Manual testing performed
   
   ## Checklist
   - [ ] TypeScript strict mode compliance
   - [ ] No console.log statements
   - [ ] Documentation updated
   - [ ] Security review performed
   ```

3. **Review Process**
   - Maintainer review required
   - Security review for crypto changes
   - CI/CD must pass
   - At least one approval needed

## 🐛 Bug Reports

Use GitHub Issues with this template:

```markdown
**Describe the Bug**
Clear description of the issue

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen

**Screenshots**
If applicable

**Environment**
- OS: [e.g., macOS 13.0]
- Browser: [e.g., Chrome 120]
- Version: [e.g., 1.0.0]

**Security Concerns**
Does this involve security? If yes, email security@trustvault.example instead
```

## 🌟 Feature Requests

```markdown
**Feature Description**
Clear description of the feature

**Use Case**
Why is this needed?

**Proposed Solution**
How should it work?

**Alternatives Considered**
Other approaches you've thought about

**Security Implications**
Any security considerations?
```

## 🔐 Security Vulnerabilities

**DO NOT** create public issues for security vulnerabilities!

Email: `security@trustvault.example` (update with real contact)

Include:
- Vulnerability description
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We follow responsible disclosure and will:
1. Acknowledge within 24 hours
2. Assess within 48 hours
3. Fix based on severity
4. Credit you in release notes (if desired)

## 📚 Documentation

### Where to Document

- **Code**: JSDoc comments for public APIs
- **README.md**: User-facing features
- **SECURITY.md**: Security architecture
- **QUICKSTART.md**: Getting started guide
- **This file**: Contribution guidelines

### Documentation Style

```typescript
/**
 * Encrypts plaintext using AES-256-GCM
 * 
 * @param plaintext - The data to encrypt
 * @param key - CryptoKey for AES-256-GCM
 * @returns Encrypted data with IV and auth tag
 * @throws Error if encryption fails
 * 
 * @example
 * ```typescript
 * const key = await generateEncryptionKey();
 * const encrypted = await encrypt("secret", key);
 * ```
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedData> {
  // Implementation
}
```

## 🎯 Areas for Contribution

### High Priority
- 🔐 Security enhancements
- 🧪 Test coverage improvements
- 📚 Documentation improvements
- 🐛 Bug fixes
- ♿ Accessibility improvements

### Medium Priority
- ✨ New features (after discussion)
- 🎨 UI/UX improvements
- ⚡ Performance optimizations
- 🌍 Internationalization

### Low Priority
- 🧹 Code refactoring
- 📝 Code comments
- 🎭 Visual tweaks

## 💬 Community

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn
- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md)

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for helping make TrustVault more secure! 🔒**
