# TrustVault PWA - Deployment Guide

**Version:** 1.0.0
**Last Updated:** 2025-10-25

---

## Table of Contents

1. [Build Instructions](#build-instructions)
2. [Environment Configuration](#environment-configuration)
3. [Hosting Options](#hosting-options)
4. [SSL/HTTPS Requirements](#sslhttps-requirements)
5. [Security Headers](#security-headers)
6. [Service Worker Configuration](#service-worker-configuration)
7. [Domain Setup](#domain-setup)
8. [Performance Optimization](#performance-optimization)
9. [Monitoring & Analytics](#monitoring--analytics)
10. [Troubleshooting Deployment](#troubleshooting-deployment)

---

## Build Instructions

### Prerequisites

- Node.js >= 20.0.0
- NPM >= 10.0.0
- Git

### Local Development

```bash
# Clone repository
git clone https://github.com/yourusername/trustvault-pwa.git
cd trustvault-pwa

# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Run type checking
npm run type-check

# Run tests
npm run test

# Run linter
npm run lint
```

### Production Build

```bash
# Build for production
npm run build

# Output directory: dist/
# - dist/assets/ - Optimized JS, CSS chunks
# - dist/index.html - Entry point
# - dist/manifest.json - PWA manifest
# - dist/sw.js - Service worker
# - dist/*.png - PWA icons
```

### Preview Production Build

```bash
# Build and preview locally
npm run build
npm run preview

# Opens preview server at http://localhost:4173
```

### Build Output Verification

```bash
# Check bundle sizes
ls -lh dist/assets/

# Expected sizes (gzipped):
# - Main chunk: ~150-200 KB
# - React vendor: ~130-150 KB
# - MUI vendor: ~200-250 KB
# - Security vendor: ~50-70 KB
# - Total: <600 KB (target)

# Run Lighthouse audit
npm run lighthouse

# Target scores (all >90):
# - Performance: 90+
# - Accessibility: 90+
# - Best Practices: 90+
# - SEO: 90+
# - PWA: 100
```

---

## Environment Configuration

### Environment Variables

TrustVault: no backend, minimal env vars.

**Optional:**

```env
# .env.production (if needed for analytics/monitoring)
VITE_APP_VERSION=1.0.0
VITE_ANALYTICS_ID=G-XXXXXXXXXX  # Google Analytics (optional)
```

**Important:** Never commit `.env` files w/ secrets. TrustVault client-only, so no API keys expose.

### Build-time Configuration

Edit `vite.config.ts` for customization:

```typescript
export default defineConfig({
  base: '/',  // Change if deploying to subdirectory
  build: {
    outDir: 'dist',
    sourcemap: false,  // Set true for debugging production issues
    minify: 'terser',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Customize code splitting here
        }
      }
    }
  }
});
```

---

## Hosting Options

### Option 1: Vercel (Recommended)

**Pros:** Auto HTTPS, CDN, Git integration, zero config
**Free Tier:** Unlimited static sites

**Deployment:**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
npm run build
vercel --prod

# Or connect GitHub repo for automatic deployments
```

**Vercel Configuration (`vercel.json`):**

Repo includes canonical `vercel.json` w/ exact prod headers & routing. `Content-Security-Policy` kept in strict parity w/ `src/config/securityHeaders.ts` — don't hand-edit docs, copy exact values from `vercel.json`.

Use provided `vercel.json` for Vercel config; contains rewrites routing SPA paths to `index.html` & headers enforcing HSTS, COOP/CORP, strict CSP.

### Option 2: Netlify

**Pros:** Git integration, CDN, redirects, free SSL
**Free Tier:** 100 GB bandwidth/month

**Deployment:**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
npm run build
netlify deploy --prod

# Or connect GitHub repo
```

**Netlify Configuration (`netlify.toml`):**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'sha256-SPRG1jijJMMtUP5+1fDMpHzEVwoIHr49w64NNXdvcv8=' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.pwnedpasswords.com https://haveibeenpwned.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';"
```

### Option 3: GitHub Pages

**Pros:** Free, Git-integrated, simple
**Cons:** No custom headers (security limit)

**⚠️ Not Recommended** for TrustVault due to security headers limitation.

**Deployment (if must):**

```bash
# Install gh-pages
npm install -D gh-pages

# Add script to package.json
"scripts": {
  "deploy:gh-pages": "npm run build && gh-pages -d dist"
}

# Deploy
npm run deploy:gh-pages
```

**GitHub Pages Configuration:**
- Repository Settings → Pages → Source: gh-pages branch
- Custom domain: Add CNAME file to public/ directory

### Option 4: Self-Hosted (Nginx)

**Pros:** Full control, custom headers, no vendor lock-in
**Cons:** Requires server mgmt, SSL setup

**Nginx Configuration (`/etc/nginx/sites-available/trustvault`):**

```nginx
server {
    listen 443 ssl http2;
    server_name trustvault.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/trustvault.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trustvault.yourdomain.com/privkey.pem;

    root /var/www/trustvault/dist;
    index index.html;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-SPRG1jijJMMtUP5+1fDMpHzEVwoIHr49w64NNXdvcv8=' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.pwnedpasswords.com https://haveibeenpwned.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service worker (no cache)
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name trustvault.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

**SSL Certificate (Let's Encrypt):**

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d trustvault.yourdomain.com

# Auto-renewal (cron)
sudo certbot renew --dry-run
```

---

## SSL/HTTPS Requirements

### Why HTTPS is Mandatory

TrustVault **requires** HTTPS for:
1. Service Worker registration (PWA)
2. WebCrypto API (encryption)
3. WebAuthn (biometric auth)
4. Clipboard API (copy/paste)
5. Security best practices

**Exception:** `localhost` (dev only)

### Obtaining SSL Certificate

**Free Options:**
- Let's Encrypt (self-hosted)
- Cloudflare (proxy)
- Vercel/Netlify (auto)

**Paid Options:**
- DigiCert, GlobalSign (org)

### SSL Configuration Checklist

- [ ] Certificate valid, not expired
- [ ] HTTP → HTTPS redirect (301)
- [ ] HSTS header enabled
- [ ] TLS 1.2+ only (disable 1.0/1.1)
- [ ] Strong cipher suites
- [ ] OCSP stapling enabled

**Test SSL:**
- https://www.ssllabs.com/ssltest/
- Target: A or A+ rating

---

## Security Headers

### Required Headers

**Pre-configured in vite.config.ts for dev:**

```typescript
headers: {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'sha256-...' 'wasm-unsafe-eval'; ..."
}
```

Canonical source: `src/config/securityHeaders.ts` (imported by `vite.config.ts` for dev/preview & parity-tested vs `vercel.json` in `src/config/__tests__/securityHeaders.test.ts`). Edit `securityHeaders.ts` only — never duplicate headers inline.

**For prod hosting, configure in:**
- Vercel: `vercel.json`
- Netlify: `netlify.toml` or `_headers` file
- Nginx: `nginx.conf`
- Apache: `.htaccess`

### Content Security Policy (CSP)

**Current CSP** (from `vercel.json`, synced w/ `securityHeaders.ts`):

```
default-src 'self';
script-src 'self' 'sha256-SPRG1jijJMMtUP5+1fDMpHzEVwoIHr49w64NNXdvcv8=' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self' https://api.pwnedpasswords.com https://haveibeenpwned.com;
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self';
```

**Explanation:**
- `default-src 'self'` - Resources from same origin only
- `script-src 'self' 'sha256-…' 'wasm-unsafe-eval'` - No `unsafe-inline`/`unsafe-eval`. Hash pins single inline GH-Pages SPA-redirect bootstrap script (`index.html`); `'wasm-unsafe-eval'` required for self-hosted Tesseract OCR WASM core. Hash drift-guarded by `securityHeaders.test.ts` — regenerate if `index.html` inline script changes.
- `style-src 'unsafe-inline'` - Material-UI/Emotion runtime styles residual
- `fonts.googleapis.com` - Material-UI fonts
- `data: blob:` - PWA icons & generated content
- `connect-src ... pwnedpasswords.com haveibeenpwned.com` - HIBP breach-detection API (k-anonymity range queries)
- `worker-src 'self' blob:` - Service worker + OCR web workers
- `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'` - Defense-in-depth lockdowns

**Customization:**
Add external services (analytics, CDN) → update CSP:

```typescript
connect-src 'self' https://analytics.google.com;
```

### Security Headers Verification

**Online Tools:**
- https://securityheaders.com/
- Target: A or A+ rating

**Common Issues:**
- Missing CSP → Add to hosting config
- `'unsafe-inline'` flagged → Material-UI limit, acceptable
- HSTS not set → Add: `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## Service Worker Configuration

### Workbox Settings

**Current config (vite.config.ts):**

```typescript
VitePWA({
  registerType: 'autoUpdate',
  devOptions: { enabled: true },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\./,
        handler: 'CacheFirst',
        options: {
          cacheName: 'fonts',
          expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 }
        }
      }
    ]
  }
})
```

### Update Strategy

**Auto-Update (Current):**
- New version auto-installs
- User prompted to reload
- UpdateAvailableSnackbar shows notification

**Manual Update (Alternative):**
Change `registerType: 'prompt'` for user control

### Service Worker Lifecycle

1. **Installation** - Assets cached on first visit
2. **Activation** - SW takes control
3. **Fetch** - Intercepts requests, serves from cache
4. **Update** - New version detected, prompts user

### Debugging Service Worker

**Chrome DevTools:**
1. DevTools → Application tab
2. Service Workers section
3. Check status, update, unregister

**Common Issues:**
- SW not registering → Check HTTPS
- Old SW stuck → Unregister & hard refresh
- Updates not applying → Check `skipWaiting` setting

---

## Domain Setup

### DNS Configuration

**For Custom Domain:**

```
Type    Name                Value                 TTL
A       trustvault          <your-server-ip>      3600
CNAME   www.trustvault      trustvault.yourdomain.com.  3600
```

**For Vercel/Netlify:**

Follow platform docs:
- Vercel: Dashboard → Domain Settings → Add Domain
- Netlify: Dashboard → Domain Management → Add Domain

### Subdomain vs Root Domain

**Root Domain (Recommended):**
- `https://trustvault.com`
- Better for PWA install prompts
- Cleaner branding

**Subdomain:**
- `https://vault.example.com`
- Good for adding to existing site

### Domain Verification

After DNS setup:
1. Wait for propagation (48h typical, <1h common)
2. Check: `nslookup trustvault.yourdomain.com`
3. Test HTTPS: `curl -I https://trustvault.yourdomain.com`

---

## Performance Optimization

### Code Splitting

**Current Strategy:**

```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'mui-vendor': ['@mui/material', '@mui/icons-material'],
  'security-vendor': ['@noble/hashes'],
  'storage-vendor': ['dexie']
}
```

**Benefits:**
- Separate vendor chunks for better caching
- Lazy-loaded routes (implemented)
- Bundle size reduced ~40%

### Lazy Loading

**Routes:**
```typescript
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
```

**Heavy Components:**
- Password Generator (on-demand)
- TOTP (if credential has TOTP)
- Biometric (if available)

### Asset Optimization

**Images:**
- PWA icons: Optimized PNGs at required sizes
- Use WebP w/ PNG fallback for screenshots

**Fonts:**
- Material-UI uses Google Fonts (SW cached)
- Subset fonts if possible

**CSS:**
- Minified in prod
- Critical CSS inlined (Vite default)

### Caching Strategy

**Static Assets:**
- `CacheFirst` - Fonts, images (1 year)
- `StaleWhileRevalidate` - JS, CSS chunks

**Dynamic Content:**
- All data in IndexedDB (offline-first)
- No API calls (fully client-side)

### Lighthouse Performance

**Target Scores:**
- Performance: 90+
- Accessibility: 90+
- Best Practices: 90+
- SEO: 90+
- PWA: 100

**Common Improvements:**
- Enable compression (gzip/brotli)
- Use HTTP/2
- Minimize main-thread work
- Reduce JS execution time

---

## Monitoring & Analytics

### Error Tracking (Optional)

**Sentry Integration:**

```bash
npm install @sentry/react
```

```typescript
// src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter sensitive data
    delete event.user;
    delete event.request?.data;
    return event;
  }
});
```

**⚠️ Privacy:** Never log passwords, vault keys, PII

### Analytics (Optional)

**Google Analytics 4:**

```typescript
// src/utils/analytics.ts
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function trackPageView(path: string) {
  window.gtag?.('config', import.meta.env.VITE_GA_ID, {
    page_path: path,
    anonymize_ip: true
  });
}

export function trackEvent(category: string, action: string) {
  window.gtag?.('event', action, { event_category: category });
}
```

**Events to Track:**
- User signups (no email)
- Credential created/updated/deleted counts
- PWA installs
- Export/import ops
- Biometric enabled

**Never Track:**
- Passwords
- Email addresses
- Credential titles/usernames
- Decrypted data

### Uptime Monitoring

**Self-Hosted:**
- Uptime Kuma (open source)
- Statping

**SaaS:**
- UptimeRobot (free tier)
- Pingdom
- StatusCake

**Monitor:**
- HTTPS endpoint reachability
- SSL cert expiration
- Response time (<500ms target)
- Service worker updates

---

## Troubleshooting Deployment

### Build Failures

**Error:** `Cannot find module '@noble/hashes'`
**Solution:** `npm install` ensure all deps

**Error:** `TypeScript errors in build`
**Solution:** Run `npm run type-check` first, fix

**Error:** `WASM loading failed`
**Solution:** Ensure `vite-plugin-wasm` installed & configured

### Service Worker Issues

**Error:** SW not registering in prod
**Solution:** Ensure HTTPS, check browser console

**Error:** Update not applying
**Solution:** Unregister SW in DevTools, hard refresh

**Error:** Offline mode not working
**Solution:** Check workbox caching patterns, ensure files cached

### Routing Issues

**Error:** 404 on direct URL access
**Solution:** Configure SPA routing (see hosting-specific configs)

**Error:** Assets not loading
**Solution:** Check `base` path in vite.config.ts

### Performance Issues

**Error:** Lighthouse score <90
**Solution:**
1. Enable compression
2. Check bundle sizes (`npm run build`)
3. Lazy load more components
4. Optimize images

**Error:** Slow initial load
**Solution:**
1. Code split vendors
2. Inline critical CSS
3. Use CDN for hosting
4. Enable HTTP/2

### Security Header Issues

**Error:** CSP blocking resources
**Solution:** Review CSP, add necessary domains

**Error:** Mixed content warnings
**Solution:** Ensure all resources via HTTPS

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm run test`)
- [ ] Type check passing (`npm run type-check`)
- [ ] Lint passing (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Bundle size acceptable (<600 KB)
- [ ] Lighthouse scores >90

### Security

- [ ] HTTPS configured
- [ ] SSL cert valid
- [ ] Security headers configured
- [ ] CSP tested & working
- [ ] No secrets in code
- [ ] Env vars secured

### PWA

- [ ] Service worker registering
- [ ] Offline mode working
- [ ] Install prompt appearing
- [ ] Icons valid & correct sizes
- [ ] Manifest.json valid

### Performance

- [ ] Lighthouse Performance >90
- [ ] First Contentful Paint <1.8s
- [ ] Time to Interactive <3.8s
- [ ] Compression enabled
- [ ] Assets cached properly

### Monitoring

- [ ] Error tracking configured (if used)
- [ ] Analytics configured (if used)
- [ ] Uptime monitoring set up
- [ ] SSL expiration monitoring

### Post-Deployment

- [ ] Test on real devices (mobile, tablet, desktop)
- [ ] Test on multiple browsers (Chrome, Safari, Firefox, Edge)
- [ ] Verify PWA installation
- [ ] Test offline functionality
- [ ] Check security headers (securityheaders.com)
- [ ] Run Lighthouse audit on live URL
- [ ] Monitor error logs (first 24h)

---

## Continuous Deployment

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:run

      - name: Type check
        run: npm run type-check

      - name: Build
        run: npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

**Last Updated:** 2025-10-25
**Version:** 1.0.0