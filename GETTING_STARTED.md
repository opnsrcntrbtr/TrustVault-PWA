# TrustVault PWA - Getting Started Guide

**Quick navigation**: [Local Development](#-local-development--3-minutes) • [Deployment](#-deployment-to-vercel) • [PWA Installation](#-install-as-pwa) • [Security](#-security-features) • [Troubleshooting](#-troubleshooting)

---

## ✅ Prerequisites Check

```bash
node --version  # Should be >= 20.0.0
npm --version   # Should be >= 10.0.0
```

---

## 🚀 Local Development (3 minutes)

### 1. Install Dependencies
```bash
npm install
```

This installs React 19, Vite 6, TypeScript 5.7, Material-UI v6, security libraries, and more.

### 2. Setup Environment
```bash
cp .env.example .env
```

Edit `.env` if needed (defaults work for local development).

### 3. Start Development Server
```bash
# HTTP (standard)
npm run dev

# HTTPS (required for WebAuthn/biometric testing)
npm run dev:https
```

Open http://localhost:3000 (or https://localhost:3000 for HTTPS)

---

## 🔐 First Login

1. Enter any email (no backend yet—this is a local demo)
2. Create a strong master password (this becomes your vault encryption key)
3. Click "Unlock Vault"

⚠️ **Remember**: Your master password cannot be recovered! Write it down securely.

---

## 📱 Install as PWA

### Desktop (Chrome/Edge)
1. Click the install icon (➕) in the address bar
2. Click "Install"

### Mobile (iOS Safari)
1. Tap Share → "Add to Home Screen"

### Mobile (Android Chrome)
1. Tap Menu (⋮) → "Install app" or "Add to Home Screen"

---

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server (HTTP)
npm run dev:https        # Start dev server (HTTPS) - WebAuthn testing
npm run preview          # Preview production build locally

# Building
npm run build            # Production build
npm run type-check       # TypeScript validation
npm run lint             # ESLint check
npm run lint:fix         # Fix ESLint issues automatically

# Testing & Quality
npm run test             # Vitest unit tests
npm run security:audit   # Check for vulnerabilities
npm run lighthouse       # PWA audit (run after npm run build)
```

---

## 📁 Project Structure

```
trustvault-pwa/
├── src/
│   ├── presentation/      # UI Layer
│   │   ├── components/    # React components
│   │   ├── pages/        # Page components
│   │   ├── store/        # Zustand state management
│   │   └── theme/        # Material-UI theme
│   ├── domain/           # Business logic & entities
│   ├── data/             # Data layer & IndexedDB
│   └── core/             # Crypto, auth utilities
├── public/               # Static assets & PWA icons
├── vite.config.ts        # Vite + PWA configuration
├── tsconfig.json         # TypeScript strict config
├── CLAUDE.md             # Claude Code session guide
└── package.json          # Dependencies & scripts
```

---

## 🔒 Security Features

✅ **AES-256-GCM Encryption** — All passwords encrypted at rest  
✅ **PBKDF2 (600k iterations)** — OWASP 2025 compliant key derivation  
✅ **Scrypt (N=32768, r=8, p=1)** — Memory-hard password hashing  
✅ **WebAuthn** — Biometric authentication (fingerprint/face)  
✅ **IndexedDB** — Secure local storage with encryption  
✅ **Zero Telemetry** — No tracking, complete privacy  

Read full security details: [SECURITY.md](./SECURITY.md)

---

## 🌐 Deployment to Vercel

### Prerequisites
- GitHub repository pushed
- Vercel account linked to GitHub

### Automatic Deployment
1. Push to GitHub: `git push origin main`
2. Vercel auto-builds in ~2 minutes
3. Visit your deployment URL (shown in Vercel dashboard)

### Configuration Files

Two files configure Vercel deployment (already in repo):

**vite.config.ts:**
```typescript
base: '/'  // Vercel serves from root path (not GitHub Pages /TrustVault-PWA/)
```

**vercel.json:**
```json
{
  "buildCommand": "npm run build",
  "framework": "vite",
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }  // SPA routing
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

### Manual Verification (if needed)

If seeing asset 404 errors on Vercel:

1. Check `vite.config.ts` has `base: '/'`
2. Verify `vercel.json` exists in repository root
3. Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R)
4. Check Vercel deployment logs

---

## 🎯 Next Steps After Setup

1. **Explore the Dashboard** — Add your first credential
2. **Generate Passwords** — Use the built-in password generator
3. **Enable Biometric Auth** — Set up fingerprint/face recognition (HTTPS required)
4. **Review Security Score** — Check the security audit dashboard
5. **Export Backup** — Create an encrypted backup of your vault

---

## ⚠️ Important Notes

### Master Password
- **Cannot be recovered** if lost
- Use a strong, unique password (passphrase recommended: 6+ words)
- Write it down and store securely offline

### Browser Compatibility
| Browser | Support | Notes |
|---------|---------|-------|
| Chrome/Edge 90+ | ✅ Best | Full WebAuthn support |
| Firefox 88+ | ✅ Best | Full WebAuthn support |
| Safari 14+ | ⚠️ Good | Limited WebAuthn |

**HTTPS Required** for biometric authentication

### Data Security
- All data stored **locally** in IndexedDB
- Encrypted with your master password
- **No cloud sync** — offline-only
- Export backups regularly

---

## 🐛 Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### WebAuthn (biometric) not working
- Ensure using HTTPS: `npm run dev:https`
- Check browser compatibility (Chrome/Edge/Firefox)
- Verify device has biometric hardware

### Build errors
```bash
npm run type-check  # See TypeScript errors
npm run lint:fix    # Auto-fix linting issues
```

### Dependencies won't install
```bash
npm cache clean --force
npm install
```

### PWA not appearing in browser
- Check `manifest.webmanifest` loads (DevTools → Network tab)
- Verify icons are valid PNG (not 1x1 placeholders)
- Ensure HTTPS (Vercel provides automatically)
- Run `npm run lighthouse` for detailed diagnostics

### Service Worker not updating after deployment
1. Hard refresh: Cmd+Shift+R / Ctrl+Shift+R
2. DevTools → Application → Service Workers → Unregister
3. Clear site data and reload

---

## 📚 Documentation Map

| Document | Purpose | When to Use |
|----------|---------|------------|
| **README.md** | Project overview | First-time project intro |
| **GETTING_STARTED.md** | This file — setup & deployment | Getting your environment ready |
| **SECURITY.md** | Cryptography & threat model | Security details & architecture |
| **CLAUDE.md** | Claude Code session guide | AI-assisted development |
| **ROADMAP.md** | Feature roadmap | Understanding planned work |
| **CHANGELOG.md** | Version history | See what changed |

---

## 🔗 Quick Links

- **Repository**: https://github.com/opnsrcntrbtr/TrustVault-PWA
- **Vercel Dashboard**: https://vercel.com/opnsrcntrbtr
- **Live Demo**: https://trust-vault-pwa.vercel.app

---

## 📖 External Resources

- [React 19 Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Material-UI v6](https://mui.com/)
- [WebAuthn Guide](https://webauthn.guide/)
- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)
- [Vercel Deployment Docs](https://vercel.com/docs/frameworks/vite)

---

## 💬 Need Help?

- 📖 Check relevant documentation above
- 🔍 Search repository issues on GitHub
- 🐛 Report bugs with detailed steps to reproduce
- 💡 Start a discussion for feature requests

---

**Happy secure password managing! 🔒**
