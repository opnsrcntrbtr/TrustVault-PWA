# Phase 2 Spike — WebAuthn/PRF Biometric Unlock under a Capacitor WebView

**Status:** Research complete · On-device confirmation pending
**Date:** 2026-06-26
**Gate for:** [OCR_NATIVE_ANDROID_PLAN.md](./OCR_NATIVE_ANDROID_PLAN.md) Phase 3 (native wiring)
**Question:** Does TrustVault's `prf-v1` biometric unlock (WebAuthn platform authenticator + PRF
extension → HKDF-wrapped vault key) work inside the Android WebView that Capacitor uses, served from
`https://localhost`?

---

## Verdict

**No — not transparently, and likely not at all for PRF without significant native work.**
This does **not** block the OCR feature. The mitigation was anticipated in the plan: the Capacitor
Android build ships OCR with **master-password unlock** (the existing non-PRF path), and
**biometric-in-WebView is deferred to its own investigation**, decoupled from OCR.

Confidence: **High** on "not transparent / Capacitor default fails." **Medium-high** on "PRF unavailable"
— the last 10% requires the on-device test in §4 because no source documents PRF extension results
surviving the WebView → Credential Manager path.

---

## 1. Findings (authoritative sources)

### F1 — Android WebView WebAuthn is opt-in and new
Historically Android WebView had **no** WebAuthn support. AndroidX WebKit **1.12.1+** added
`WebSettingsCompat.setWebAuthenticationSupport()`, gated by
`WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)`. Calls route to the platform
**Credential Manager**. Must be set on the UI thread.
→ [Authenticate users with WebView](https://developer.android.com/identity/sign-in/credential-manager-webview),
[Jetpack WebKit releases](https://developer.android.com/jetpack/androidx/releases/webkit)

### F2 — Capacitor's WebView does not enable it by default
A stock Capacitor Android project never calls `setWebAuthenticationSupport()`, so
`navigator.credentials.create/get` **fails out of the box**. Enabling it means editing the native
`MainActivity` (or a custom plugin) to call the AndroidX API — i.e. ejecting from the default shell.
→ [Ionic forum: bridging PublicKeyCredential](https://forum.ionicframework.com/t/how-would-i-go-about-bridging-publickeycredential-in-android/228530),
[passkeys.dev — Android](https://passkeys.dev/docs/reference/android/)

### F3 — PRF extension pass-through is undocumented on every path
- The official WebView WebAuthn guide makes **no mention** of extensions or PRF.
- Passkey-shim plugins (e.g. [Cap-go/capacitor-passkey](https://github.com/Cap-go/capacitor-passkey),
  [Argo-Navis](https://github.com/Argo-Navis-Dev/capacitor-passkey-plugin)) copy extensions "as-is"
  and return a generic `clientExtensionResults`, but **do not confirm** PRF/`hmac-secret` results are
  returned — the exact field `prf-v1` depends on.
- PRF itself is well-supported by the Android **platform authenticator in Chrome/Edge/Samsung Internet**
  (default-enabled in Chromium since May 2023) — the uncertainty is strictly the **WebView/Capacitor**
  embedding, not Android or PRF generally.
→ [WebAuthn PRF — Chrome Status](https://chromestatus.com/feature/5138422207348736),
[Intent to Ship: PRF](https://groups.google.com/a/chromium.org/g/blink-dev/c/iTNOgLwD2bI)

### F4 — Origin / RP-ID is tied to the app signature, not the web origin
Credential Manager treats a non-browser app's response origin as the **Android app signature**
(`android:apk-key-hash:…`) via **Digital Asset Links**, *not* your website's RP ID. Consequences:
- A passkey enrolled in the **browser PWA** (RP ID = web domain) is **not** transparently usable from
  the **Capacitor app** (origin = app signature), and vice versa.
- Even if PRF worked, the **PRF output is salted per credential** — a different credential scope means a
  different derived key, so the wrapped vault key would not unlock across surfaces without re-enrollment.
- `WEB_AUTHENTICATION_SUPPORT_FOR_APP` (app acts as RP, asset-link origin) vs `…_FOR_BROWSER` (behaves
  like a browser) changes this, but `FOR_BROWSER` is intended for actual browser apps and carries its
  own privileged-context requirements.
→ [Corbado — WebAuthn origin validation in native apps](https://www.corbado.com/blog/webauthn-origin-validation-native-apps),
[Corbado — native vs WebView passkeys](https://www.corbado.com/blog/native-app-passkeys)

---

## 2. Why this does not block OCR

`prf-v1` is **one of two** unlock paths. TrustVault already ships a **master-password unlock** that uses
no WebAuthn at all (`SECURITY.md` / CLAUDE.md: "non-PRF fallback to master password"; session vault key
derived via Scrypt + PBKDF2, non-extractable). The OCR enhancement is independent of how the vault is
unlocked. Therefore:

- **Decision D1:** the Capacitor Android build targets **master-password unlock**. Biometric is hidden
  or disabled on that surface unless/until F3+F4 are resolved on-device.
- **Decision D2:** biometric-in-WebView becomes a **separate, optional spike** — it is no longer on the
  critical path for OCR.

This is the outcome the plan's risk table pre-registered ("biometric breaks under https://localhost →
master-password fallback on Android build").

---

## 3. If biometric-in-WebView is pursued later (out of scope for OCR)

Two avenues, both requiring native work and on-device verification:

| Avenue | Mechanism | PRF risk |
|---|---|---|
| **A. Native WebAuthn in WebView** | Patch Capacitor `MainActivity` → `setWebAuthenticationSupport(WEB_AUTHENTICATION_SUPPORT_FOR_APP)`, set up Digital Asset Links | PRF extension results may be stripped — unverified (F3) |
| **B. Passkey shim plugin** | `CapacitorPasskey.autoShimWebAuthn()` patches `navigator.credentials`, bridges to Credential Manager | Plugin returns generic `clientExtensionResults`; PRF unconfirmed (F3) |

Either way, expect **re-enrollment** in the app context (F4) — browser-enrolled `prf-v1` credentials will
not carry over. This is a meaningful redesign of the unlock flow, not a config flag.

---

## 4. On-device confirmation protocol (the remaining 10%)

Run this to convert "Medium-high" into a definitive yes/no before investing in §3:

1. Minimal Capacitor 7 shell, `androidScheme: 'https'`, loading a one-page WebAuthn harness.
2. In `MainActivity`, gate on `WebViewFeature.WEB_AUTHENTICATION` and call
   `setWebAuthenticationSupport(…_FOR_APP)`; configure Digital Asset Links for the test origin.
3. Harness calls `navigator.credentials.create({ publicKey: { …, extensions: { prf: { eval: { first }}}}})`.
4. **Assert:** `getClientExtensionResults().prf?.enabled === true` and a subsequent `get()` with
   `prf.eval.first` returns a stable `results.first` ArrayBuffer.
5. Record device/Android/WebView/Chromium versions and AndroidX WebKit version in `TEST_STATUS.md`.

**Pass** → §3 Avenue A is viable; re-evaluate enabling biometric on the app build.
**Fail (no `prf` results)** → biometric stays browser-only; D1/D2 stand permanently.

---

## 5. Net effect on the plan

- Phase 3 (native OCR wiring) proceeds **now**, assuming master-password unlock on the Android build.
- Phase 5 security re-audit drops the "verify PRF under https://localhost" blocker and replaces it with
  "confirm biometric is disabled/hidden on the Capacitor surface; master-password path intact."
- A new, **optional**, lower-priority track owns §3/§4 if biometric-in-app is ever desired.

---

## Sources
- [Authenticate users with WebView — Android Developers](https://developer.android.com/identity/sign-in/credential-manager-webview)
- [Jetpack WebKit releases — Android Developers](https://developer.android.com/jetpack/androidx/releases/webkit)
- [WebAuthn PRF extension — Chrome Status](https://chromestatus.com/feature/5138422207348736) · [Intent to Ship: PRF](https://groups.google.com/a/chromium.org/g/blink-dev/c/iTNOgLwD2bI)
- [Cap-go/capacitor-passkey](https://github.com/Cap-go/capacitor-passkey) · [Argo-Navis capacitor-passkey-plugin](https://github.com/Argo-Navis-Dev/capacitor-passkey-plugin)
- [Corbado — WebAuthn origin validation in native apps](https://www.corbado.com/blog/webauthn-origin-validation-native-apps) · [native vs WebView passkeys](https://www.corbado.com/blog/native-app-passkeys)
- [passkeys.dev — Android](https://passkeys.dev/docs/reference/android/)
