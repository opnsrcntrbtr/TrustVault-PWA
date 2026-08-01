# Phase 5 — Security / CSP / Origin Re-audit (Capacitor Android surface)

**Status:** Audit complete · One follow-up gated to the on-device build (CSP injection)
**Date:** 2026-06-26
**Gate for:** [OCR_NATIVE_ANDROID_PLAN.md](./OCR_NATIVE_ANDROID_PLAN.md) Phase 6 (distribution)
**Premise:** the Capacitor Android app is a **new platform target** (origin `https://localhost`, not the
deployed domain), so the web PWA's security guarantees do **not** transfer automatically. Each is
re-verified below against the actual code.

---

## Summary

| # | Control | Finding | Action |
|---|---|---|---|
| A | **CSP in WebView** | Strict CSP is **HTTP-header-only** ([securityHeaders.ts](../src/config/securityHeaders.ts)) — **absent** in a Capacitor WebView (no server sets headers). | ⏳ **Follow-up:** inject a meta CSP into the native `dist/index.html` at `cap sync` time. Gated to the on-device build (Phase 6). Decision below. |
| B | **Biometric / PRF** | `prf-v1` can't work in-WebView (Phase 2). | ✅ **Done:** `isBiometricAvailable()` now returns `false` in the native app → enrollment + UI hidden; master-password unlock only. |
| C | **New egress** | jcesarmobile uses the **bundled** ML Kit model (`16.0.1`), no download. | ✅ **Zero new CSP `connect-src` origin** — unlike WebLLM. No change to the allowlist. |
| D | **In-memory only** | Native path passes **base64** (`blobToDataUrl`) to `Ocr.process`; blob zeroized in `finally`. | ✅ No disk temp file introduced. |
| E | **AI / WebGPU surface** | Capacitor WebView is a 2nd Android surface where WebLLM/LiteRT *could* run. | ✅ Both stay kill-switched (`WEBLLM_ANDROID_ENABLED = false`); no OCR code overlap. Documented. |

---

## A. CSP parity in the WebView — the one real gap

**Finding.** [securityHeaders.ts](../src/config/securityHeaders.ts) is the single source of truth, applied
as **HTTP response headers** by the Vite servers and `vercel.json` (with a parity test guarding drift).
A Capacitor app serves the bundle from `https://localhost` via the native WebView — **no server, no HTTP
headers** — so the strict `default-src 'self'`, hash-based `script-src`, `frame-ancestors 'none'`, etc.
are **not enforced** in the native app unless re-asserted in-document.

**Constraints that shape the fix:**
- `index.html` is **shared** between the web and native builds. A `<meta http-equiv="Content-Security-Policy">`
  added there would also alter the production web policy and create a **second, drifting** source of truth
  next to the header-based one (the project deliberately keeps CSP in headers — `CLAUDE.md` §6).
- Several directives (`frame-ancestors`, `X-Frame-Options`) **cannot** be expressed via meta — but those
  matter far less inside a native WebView (no framing surface).
- Dev vs. prod policies differ (dev relaxes `script-src`); a static meta tag can't represent that.

**Decision A1.** Do **not** edit the shared `index.html`. Instead, add a **Capacitor-only post-`sync`
step** that injects a meta CSP derived from `buildContentSecurityPolicy()` into the **copied** native
`index.html` only (a script analogous to `scripts/copy-ocr-assets.js`, run inside `cap:sync`). This keeps
one source of truth (the builder function) and never touches the web bundle. The injected policy:
- reuses `buildContentSecurityPolicy()` so it can't drift;
- needs **no** OCR-specific `connect-src` addition (finding C);
- adds `https://localhost` only if any runtime check assumes the production origin (audit during the
  on-device spike — none found in OCR/parse paths).

**Status:** deferred with the on-device build (Phase 6), since it can only be validated once `android/`
exists and runs. Tracked here so distribution can't proceed without it.

---

## B. Biometric / PRF — implemented now

Per [Phase 2 spike](./OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md) (PRF doesn't survive WebView → Credential
Manager; origin binds to app signature), biometric must be **off** on the native surface.

- New seam [`src/core/platform/runtime.ts`](../src/core/platform/runtime.ts) — `isNativeApp()` /
  `isNativeAndroidApp()` (single source of truth for native detection; web reports `false`).
- [`isBiometricAvailable()`](../src/core/auth/webauthn.ts) now short-circuits to `false` when
  `isNativeApp()`. Both consumers — enrollment ([UserRepositoryImpl.ts:377](../src/data/repositories/UserRepositoryImpl.ts#L377))
  and the setup UI ([BiometricSetupDialog.tsx:86](../src/presentation/components/BiometricSetupDialog.tsx#L86))
  — therefore hide biometric, leaving the existing Scrypt master-password unlock as the only path.
- **Web is unaffected** (`isNativeApp()` is `false` there): pure no-op on the deployed PWA. Covered by tests.

---

## C. No new egress — verified positive

`@jcesarmobile/capacitor-ocr` bundles the ML Kit text-recognition model (`textRecognitionVersion 16.0.1`,
bundled variant) — recognition is fully on-device with **no model download**. Therefore the OCR native
path adds **zero** origins to `connect-src` in [securityHeaders.ts](../src/config/securityHeaders.ts).
This is a deliberate contrast with the deferred Phase 4 overlay plugin (`@capacitor-community/image-to-text`),
which would pull in Firebase/`google-services.json` — that remains gated and off by default.

---

## D. In-memory only — verified

`NativeMlKitOcrProvider.recognize()` calls `blobToDataUrl(blob)` and hands a `data:` URL to
`Ocr.process({ image })` — no `file://` temp, no `FileProvider`. The captured blob is zeroized via
`clearImageData(blob)` in a `finally`, even on failure. Matches the web path's zero-knowledge frame
handling. (If a future change switches to `@capacitor/camera` file capture, this finding must be re-opened.)

---

## E. Second Android surface — documented

The Capacitor WebView is now a second place WebLLM/LiteRT-LM *could* execute on Android. Both remain
**kill-switched** (`WEBLLM_ANDROID_ENABLED = false` in `capabilities.ts`) after the Adreno device-loss
finding, so on-device AI stays disabled on this surface too — consistent with the web build. OCR shares
no code with the AI providers. No action beyond this note.

---

## Exit criteria

- [x] B, C, D, E verified/implemented and tested in-repo.
- [ ] **A (CSP injection)** implemented and validated on-device — **blocks Phase 6 distribution**.
- [ ] `SECURITY.md` updated with the Capacitor surface boundary (this phase).

## Sources (carried from Phase 2)
- [Phase 2 biometric/WebView spike](./OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md)
- [securityHeaders.ts](../src/config/securityHeaders.ts) · [OCR_NATIVE_ANDROID_PLAN.md](./OCR_NATIVE_ANDROID_PLAN.md)
