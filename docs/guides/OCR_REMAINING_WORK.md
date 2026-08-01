# Native Android OCR — Remaining Work (2026-06-26)

Quick reference for resuming Phases 4 & 6 after Phase 5 security audit. See main plan
[OCR_NATIVE_ANDROID_PLAN.md](./OCR_NATIVE_ANDROID_PLAN.md) for full context.

---

## Blockers (must complete before distribution)

| Task | Why | Where to implement | Status |
|---|---|---|---|
| **CSP injection script** | Capacitor WebView has no HTTP headers → CSP missing in-app. Injects meta tag derived from `buildContentSecurityPolicy()`. | `scripts/inject-csp-for-capacitor.js` + hook in `package.json:cap:sync`/`cap:android` | **Done (2026-06-28)** — imports the policy builder directly via Node 24 native TS stripping, idempotent, skips gracefully without `android/`. Manually verified against a throwaway fixture. |
| **On-device parity test** | Confirm ML Kit OCR produces same `{username,password,url}` as Tesseract on ground-truth cards/screenshots. Run on real device (API 24+). Record in `TEST_STATUS.md`. | Android device / emulator | Not started — requires Android SDK machine |

---

## Deferred (optional, can ship without)

| Task | Why | Where to implement | Notes |
|---|---|---|---|
| **Phase 4 overlay — on-device verification only** | Code is done (see Status recap below); only on-device confirmation that the overlay renders correctly and Firebase ML Vision actually loads on a real device remains. | n/a — needs Android device | Not blocked on anything else; low priority |
| **Phase 2 on-device PRF verification** | Test whether PRF extension results survive WebView → Credential Manager on real hardware (Capacitor 8, AndroidX WebKit 1.12.1+). Settles "10% uncertainty" in spike doc. | Minimal Capacitor harness + Android device | Optional; doesn't block OCR |

---

## Entry points for code review

| File | Purpose | Line(s) | Notes |
|---|---|---|---|
| [capacitor.config.ts](../capacitor.config.ts) | Native app config (origin `https://localhost`, app ID, Android settings) | — | **Shared with native build** — no edits post-gen needed |
| [src/core/platform/runtime.ts](../src/core/platform/runtime.ts) | Platform seam — single source of truth for native detection | 14–23 | Used by biometric + OCR provider |
| [src/core/auth/webauthn.ts](../src/core/auth/webauthn.ts) | Biometric gate — returns `false` on native app (Phase 2 D1/D2) | 52–70 | Blocks enrollment + setup UI on Capacitor surface |
| [src/core/ocr/nativeMlKitOcrProvider.ts](../src/core/ocr/nativeMlKitOcrProvider.ts) | Native OCR provider — lazy-imports plugin, no disk temp | 14, 31 | Wired ahead of Tesseract in provider registry |
| [src/config/securityHeaders.ts](../src/config/securityHeaders.ts) | CSP builder (source of truth) | 64–82 | CSP injection script will call `buildContentSecurityPolicy()` |
| [SECURITY.md](../SECURITY.md) | Updated with Capacitor surface boundary | L431–L451 | Explains biometric/CSP decisions |

---

## Checklist for resuming (in order)

- [x] **CSP injection script** (Phase 6 blocker) — done 2026-06-28
  - [x] Create `scripts/inject-csp-for-capacitor.js`
  - [x] Update `package.json:cap:sync`/`cap:android` to run the script post-sync
  - [ ] Test on-device: inspect native `android/.../index.html`, confirm meta CSP present (deferred — needs real `android/` project)
  
- [ ] **On-device build** (on a machine with Android SDK)
  - [ ] `npx cap add android` (generates `android/` project)
  - [ ] `npm run cap:android` (build web → sync → open Studio)
  - [ ] Build & run on device
  - [ ] Record parity test results in `TEST_STATUS.md`
  - [ ] Confirm biometric is **hidden** (Settings)
  - [ ] Confirm CSP is enforced (DevTools, no CSP violations)
  
- [x] **Phase 4** — done 2026-06-28
  - [x] `@capacitor-community/image-to-text` installed + `NativeBoundingBoxOcrProvider` + `ocrSettings.ts` toggle + `OcrOverlaySettings.tsx` Settings UI
  - [x] No Firebase CSP origin needed — `detectText()` is a native-bridge call, not WebView JS network traffic (CSP doesn't apply); see plan doc Phase 4 for the full reasoning
  - [ ] Test overlay on device (needs Android SDK machine)
  
- [ ] **Distribution** (sideload / internal APK)
  - [ ] Set up APK signing key (not covered here)
  - [ ] Update `PROJECT_STATUS.md`, `ROADMAP.md` with OCR feature entry
  - [ ] Create internal APK distribution channel (not Play Store)

---

## Status recap

**Done (in-repo):** Phases 1–5 all verified, plus the Phase 6 CSP injection script.
- Phase 1: provider seam, image preprocessing, per-flow PSM, parser heuristics.
- Phase 2: biometric spike → biometric disabled on native.
- Phase 3: native ML Kit provider + Capacitor deps + `capacitor.config.ts`.
- Phase 4: bounding-box overlay toggle (`ocrSettings.ts`, `NativeBoundingBoxOcrProvider`, `OcrOverlaySettings.tsx`, `CameraScanDialog.tsx` review screen) — off by default, single-shot review not live video (see plan doc).
- Phase 5: security audit → biometric gate + platform seam + SECURITY.md updated.
- Phase 6 (partial): `scripts/inject-csp-for-capacitor.js` — meta CSP injection, wired into `cap:sync`/`cap:android`.

**Not done:** on-device build + parity test + CSP enforcement check + Phase 4 overlay on-device verification (all require an Android SDK machine), distribution.

---

## Related docs

- [OCR_NATIVE_ANDROID_PLAN.md](./OCR_NATIVE_ANDROID_PLAN.md) — full plan with session continuation guide
- [OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md](./OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md) — why PRF doesn't work in-WebView
- [OCR_PHASE5_SECURITY_AUDIT.md](./OCR_PHASE5_SECURITY_AUDIT.md) — CSP gap details + in-memory + egress audit
