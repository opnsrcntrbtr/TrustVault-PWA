# TrustVault PWA - Quick Start Guide

## 🚀 Getting Started in 3 Minutes

### Prerequisites Check
```bash
node --version  # Should be >= 20.0.0
npm --version   # Should be >= 10.0.0
```

### 1. Install Dependencies
```bash
npm install
```

This will install:
- React 19 and React DOM
- Vite 6 with PWA plugin
- TypeScript 5.7
- Material-UI v6
- Security libraries (@noble/hashes for Scrypt + AES-GCM helpers, @simplewebauthn/browser)
- Dexie for encrypted storage
- Zustand for state management

### 2. Setup Environment
```bash
cp .env.example .env
```

Edit `.env` if needed (defaults work for development).

### 3. Start Development Server
```bash
npm run dev
```

Open http://localhost:3000

**For WebAuthn testing (biometric authentication), use HTTPS:**
```bash
npm run dev:https
```

Open https://localhost:3000

---

## 🔐 First Login

1. Enter any email (no backend yet, this is a demo)
2. Create a strong master password (this will be your vault key)
3. Click "Unlock Vault"

**Remember**: Your master password cannot be recovered! Write it down securely.

---

## 📱 Install as PWA

### Desktop (Chrome/Edge)
1. Click the install icon (➕) in the address bar
2. Click "Install"

### Mobile (iOS Safari)
1. Tap the Share button
2. Tap "Add to Home Screen"

### Mobile (Android Chrome)
1. Tap the menu (⋮)
2. Tap "Install app" or "Add to Home Screen"

---

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server (HTTP)
npm run dev:https        # Start dev server (HTTPS) - for WebAuthn

# Building
npm run build           # Production build
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run format          # Format with Prettier
npm run type-check      # TypeScript type checking

# Testing & Security
npm run test            # Run tests
npm run security:audit  # Check for vulnerabilities
npm run lighthouse      # PWA audit (after build)
```

---

## 📁 Project Structure

```
trustvault-pwa/
├── src/
│   ├── presentation/      # UI Layer
│   │   ├── components/    # React components
│   │   ├── pages/        # Page components
│   │   ├── store/        # State management
│   │   └── theme/        # Material-UI theme
│   ├── domain/           # Business logic
│   │   ├── entities/     # Core entities
│   │   └── repositories/ # Repository interfaces
│   ├── data/             # Data layer
│   │   ├── repositories/ # Implementations
│   │   └── storage/      # Database
│   ├── core/             # Core utilities
│   │   ├── crypto/       # Encryption
│   │   └── auth/         # Authentication
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Static assets
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript config
└── package.json          # Dependencies

```

---

## 🔒 Security Features

✅ **AES-256-GCM Encryption** - All passwords encrypted  
✅ **PBKDF2 (600k iterations)** - OWASP 2025 compliant key derivation  
✅ **Scrypt (N=32768)** - Memory-hard password hashing  
✅ **WebAuthn** - Biometric authentication support  
✅ **IndexedDB** - Secure local storage  
✅ **Zero telemetry** - No tracking, complete privacy  

Read full security documentation: [SECURITY.md](./SECURITY.md)

---

## 🎯 Next Steps

1. **Explore the Dashboard**: Add your first credential
2. **Generate Secure Passwords**: Use the built-in password generator
3. **Enable Biometric Auth**: Set up fingerprint/face recognition (HTTPS required)
4. **Check Security Score**: Review the security dashboard
5. **Export Backup**: Create an encrypted backup of your vault

---

## ⚠️ Important Notes

### Master Password
- Cannot be recovered if lost
- Use a strong, unique password
- Consider using a passphrase (6+ words)
- Write it down and store securely offline

### Browser Compatibility
- **Best**: Chrome/Edge 90+, Firefox 88+
- **Good**: Safari 14+ (limited WebAuthn)
- **HTTPS Required**: For biometric authentication
- **Local Storage**: Must be enabled

### Data Security
- All data stored locally in IndexedDB
- Encrypted with your master password
- No cloud sync (local-only)
- Export backups regularly

---

## 🐛 Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### WebAuthn not working
- Ensure you're using HTTPS (`npm run dev:https`)
- Check browser compatibility
- Verify device has biometric hardware

### Build errors
```bash
npm run type-check  # Check TypeScript errors
npm run lint:fix    # Fix linting issues
```

### Can't install dependencies
```bash
# Clear npm cache
npm cache clean --force
npm install
```

---

## 📚 Learn More

- [React 19 Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Material-UI Documentation](https://mui.com/)
- [WebAuthn Guide](https://webauthn.guide/)
- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)

---

## 💬 Need Help?

- 📖 Check the [README.md](./README.md)
- 🔒 Review [SECURITY.md](./SECURITY.md)
- 🐛 Report issues on GitHub
- 💡 Join discussions

---

**Happy Secure Password Managing! 🔒**
