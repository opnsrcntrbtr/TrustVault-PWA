# Deployment Verification Guide

Checklist for verifying PWA installability and icon correctness after a deploy that touches icons, manifest, or service worker config. Originally written for a 2025-11-09 icon/manifest fix (commit 9888510); kept as a reusable emergency-procedure runbook (see `README.md`).

## Clear Caches Before Testing
Old icons/manifest may be cached by the browser and service worker:
- **Chrome/Firefox**: DevTools → Application/Storage → "Clear site data" + unregister service workers, then hard refresh (Cmd/Ctrl+Shift+R)
- **Safari**: Develop menu → Empty Caches, then Cmd+R

## Verify Icons & Manifest
1. Favicon in browser tab matches current branding.
2. `/manifest.webmanifest` lists all required icons with correct `purpose` values (`any` for 192/512, `maskable` for the maskable variants).
3. Spot-check icon files directly: `/pwa-512x512.png`, `/pwa-192x192.png`, `/pwa-maskable-512x512.png`, `/apple-touch-icon.png`.

## Verify PWA Install Prompt
- **Desktop (Chrome/Edge)**: install icon (+) appears in address bar within ~10s; install dialog shows correct icon.
- **Android Chrome**: "Add to Home screen" banner appears; added icon matches branding.
- **iOS Safari**: Share → "Add to Home Screen" uses `apple-touch-icon.png`.

## Maskable Icon Check (Android)
Verify via [maskable.app/editor](https://maskable.app/editor) that icon content stays within the 40% safe zone across circle/squircle/rounded shapes — no clipping.

## DevTools / Lighthouse
- Application → Manifest: "Installable", no "suitable icon" warnings, all icons preview correctly.
- Lighthouse PWA audit: "Installable" ✅, "Manifest has a maskable icon" ✅, viewport meta ✅, PWA score 100.
- Application → Service Workers: status "activated and is running", version matches latest deploy.

## Troubleshooting
- **Icons still show old version**: clear cache, unregister SW, wait 2-3 min for CDN propagation, try incognito.
- **Install prompt not showing**: confirm manifest `purpose` values, valid PNGs, HTTPS, not already installed, wait 5-10s after load.
- **Maskable icon clipped**: re-check 40% safe zone padding via maskable.app.
- **iOS/Android/Desktop show different icons**: expected — iOS uses `apple-touch-icon.png` (180x180), Android uses `pwa-512x512.png`/maskable variant, desktop uses `favicon.ico`.

## Post-Deployment
- Test install/uninstall/reinstall on Desktop Chrome/Edge, Mobile Chrome (Android), Mobile Safari (iOS).
- Test update flow: deploy a change while PWA is open, confirm update notification and successful update with icon intact.
- Check Vercel deploy logs and browser console for manifest/SW warnings.
