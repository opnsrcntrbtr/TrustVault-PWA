# Native Android OCR — Implementation Plan (Capacitor + ML Kit)

**Status:** Proposed (not started)
**Author:** Architecture validation, 2026-06-26
**Scope:** Android only (sideload/internal APK). iOS deferred.
**Supersedes:** the external "ML Kit via WebView/TWA" analysis (TWA bridge mechanism rejected — see §1).

---

## 0. Goal & Premise

TrustVault's OCR-based credential entry currently runs **Tesseract.js** in the browser
(`src/core/ocr/`: `cameraCapture.ts`, `tesseractService.ts`, `credentialParser.ts`, `CameraScanDialog.tsx`).
Accuracy is capped by the stock English model, minimal preprocessing, and CPU-bound WASM (~5–10 s/frame).

**Objective:** add an optional **native Android OCR path** at the highest feasible precision/confidence,
using Google **ML Kit Text Recognition v2** (on-device, offline, zero-egress), while keeping Tesseract.js
as the universal browser fallback behind a single provider seam.

### Validated decisions

| Decision | Rationale | Source |
|---|---|---|
| **Capacitor 7** as the wrapper | TWA renders via Chrome Custom Tabs in a separate process — **no DOM bridge**, so `@JavascriptInterface`/`evaluateJavascript` are impossible. Raw WebView works but means a hand-rolled, origin-less bridge to audit. Capacitor gives a typed, managed bridge over your existing built PWA. | [JS bridge is a WebView feature](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge), [WebView bridge risks](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges), [TWA — Chrome Status](https://chromestatus.com/feature/4857483210260480) |
| **ML Kit Text Recognition v2** | Fully on-device, offline, no cloud billing — satisfies the zero-knowledge / no-egress constraint. | [ML Kit v2 — Android](https://developers.google.com/ml-kit/vision/text-recognition/v2/android) |
| **Camera stays web** | Reuse `getUserMedia` capture, `assessImageQuality`, `clearImageData`. Native plugin does **OCR only** (receives a base64 frame). Smallest native surface. | — |
| **No pure-web alternative exists** | Shape Detection `TextDetector` was never standardized, is flag-gated, and was demoted to a non-normative spec. A wrapper is genuinely required for native-quality OCR. | [Shape Detection API](https://developer.chrome.com/docs/capabilities/shape-detection), [Text Detection — Chrome Status](https://chromestatus.com/feature/5644087665360896) |

---

## 1. Why not TWA / raw WebView (rejected alternatives)

- **TWA:** cannot host a JS bridge — the PWA runs in Chrome Custom Tabs out-of-process. The external
  analysis that proposed `window.TrustVaultOcr` via `evaluateJavascript` **cannot work in a TWA**.
- **Raw `android.webkit.WebView` + `@JavascriptInterface`:** technically works, but it is not Chrome
  (separate storage jar, lagging web APIs) and exposes an origin-less, all-frames bridge you must fence
  off manually — a poor fit for auditing a zero-knowledge vault.
- **Capacitor (chosen):** wraps the built PWA in a WebView **and** provides a declared, typed plugin
  bridge — one auditable surface, no manual `evaluateJavascript` string-escaping.

---

## 2. Plugin selection

Two maintained on-device OCR plugins, with a real trade-off:

| Plugin | Result shape | Confidence | Bounding boxes | Firebase / `google-services.json` | Verdict |
|---|---|---|---|---|---|
| **`@jcesarmobile/capacitor-ocr`** | `results: [{ text, confidence }]` (block-level) | ✅ | ❌ | ❌ (standalone `com.google.mlkit:text-recognition@16.0.1`, bundled model) | **Default / MVP** |
| `@capacitor-community/image-to-text` | `textDetections: [{ text, topLeft, topRight, bottomLeft, bottomRight }]` (corner points) | ❌ | ✅ | ⚠️ **Requires `google-services.json`** (Firebase ML Vision) | **Overlay phase only (opt-in)** |

Sources: [@jcesarmobile/capacitor-ocr](https://github.com/jcesarmobile/capacitor-ocr) ·
[@capacitor-community/image-to-text](https://github.com/capacitor-community/image-to-text) (v8.0.0, Jan 2026 → Capacitor 7).

**Decision:** ship `@jcesarmobile/capacitor-ocr` as the default native path. It is **Firebase-free**
(no `google-services.json`, no Google telemetry surface — important for a ZK vault) and exposes a
calibrated confidence we can merge into the parse result. The bounding-box overlay (§Phase 4) is a
**separate, opt-in capability** that pulls in the heavier, Firebase-backed `image-to-text` plugin —
gated behind a Settings toggle so the Firebase dependency is never present unless the user opts in.

> **Consequence for confidence logic:** `@jcesarmobile/capacitor-ocr` returns block-level
> `text + confidence` already pre-filtered by ML Kit. Do **not** re-implement per-element thresholding.
> Join `results[].text` with `\n`, aggregate confidence (mean), pass to `parseCredentialText`.

---

## 3. Toolchain & requirements (verified — Capacitor 7)

| Requirement | Value |
|---|---|
| Node.js | ≥ 20 (project already requires this) |
| Android API | minSdk 24+ (Android 7+) |
| JDK | 21 |
| Android Studio | Ladybug 2024.2.1+ |
| WebView | Chrome 60+ |

Sources: [Capacitor 7 GA](https://ionic.io/blog/capacitor-7-has-hit-ga) · [Updating to 7.0](https://capacitorjs.com/docs/updating/7-0).

---

## Phase 1 — Provider seam (pure web, zero native, ships to all users)

**Goal:** introduce the abstraction and the per-flow quick wins that improve the *Tesseract* path for
100% of users (desktop, iOS-Safari, un-wrapped Android) — independent of any wrapper.

- [ ] Define `OcrProvider` in `src/core/ocr/index.ts`:
  ```ts
  export interface OcrProvider {
    isAvailable(): boolean;
    recognize(
      getBlob: () => Promise<Blob>,
      onProgress?: (p: OCRProgress) => void,
    ): Promise<{ text: string; engineConfidence?: number }>;
    readonly streamsProgress: boolean; // Tesseract=true, native=false
  }
  ```
- [ ] Extract current logic into `TesseractOcrProvider` (behaviour unchanged).
- [ ] `cameraCapture.ts`: add grayscale + contrast-stretch (and optional de-skew) before `toBlob`.
- [ ] `tesseractService.recognizeText`: accept a mode (`'form' | 'line' | 'block'`) → set
      `tessedit_pageseg_mode` (`SINGLE_COLUMN` / `SINGLE_LINE` / `SPARSE_TEXT`).
- [ ] `credentialParser.ts`: tighten heuristics (reject date/amount-shaped values, tune fallback confidence).
- [ ] `CameraScanDialog.tsx`: select provider from `[…available].find(p => p.isAvailable())`,
      gate the progress bar on `provider.streamsProgress`.

**Exit:** no behaviour regression; Tesseract accuracy measurably improved on the manual matrix. No wrapper.

---

## Phase 2 — Biometric-under-WebView spike (highest-risk validation, BEFORE native wiring)

**Goal:** de-risk the single thing that can invalidate the whole effort.

- [x] **Research complete — see [OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md](./OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md).**
- [ ] On-device confirmation of PRF pass-through (spike §4) — *optional, off the OCR critical path.*

**Finding:** `prf-v1` biometric unlock does **not** work transparently in a Capacitor WebView.
Capacitor's WebView doesn't enable WebAuthn by default; PRF extension pass-through is undocumented on
every path; and Credential Manager ties the origin to the **app signature** (not the web RP ID), so
browser-enrolled passkeys don't carry over. PRF itself is fine in Chrome-on-Android — the gap is the
WebView embedding.

**Decision (D1/D2):** the Capacitor Android build ships OCR with **master-password unlock** (the
existing non-PRF path); **biometric-in-WebView is decoupled** into a separate optional track. This was
the plan's pre-registered mitigation, so **Phase 3 proceeds** — no re-plan needed.

**Exit:** ✅ met via documented mitigation. Biometric disabled/hidden on the Capacitor surface;
master-password unlock intact.

---

## Phase 3 — Native ML Kit OCR provider (Android default path)

**Goal:** wire `@jcesarmobile/capacitor-ocr` behind the seam.

```bash
npm i @capacitor/core @capacitor/cli @jcesarmobile/capacitor-ocr
npx cap init TrustVault io.trustvault.app --web-dir=dist
npm run build && npx cap add android && npx cap sync
```

`capacitor.config.ts`:
```ts
const config: CapacitorConfig = {
  appId: 'io.trustvault.app',
  webDir: 'dist',
  server: { androidScheme: 'https' },     // https://localhost — closest to real CSP/origin model
  android: { allowMixedContent: false },
};
```

`src/core/ocr/nativeMlKitOcrProvider.ts`:
```ts
import { Capacitor } from '@capacitor/core';
import { Ocr } from '@jcesarmobile/capacitor-ocr';

export class NativeMlKitOcrProvider implements OcrProvider {
  readonly streamsProgress = false;
  isAvailable() { return Capacitor.isNativePlatform(); }

  async recognize(getBlob: () => Promise<Blob>) {
    const blob = await getBlob();
    const image = await blobToDataUrl(blob);          // 'data:image/png;base64,...'
    const { results } = await Ocr.process({ image });
    await clearImageData(blob);                        // reuse existing zeroization
    const text = results.map(r => r.text).join('\n');
    const engineConfidence = results.length
      ? results.reduce((s, r) => s + r.confidence, 0) / results.length
      : undefined;
    return { text, engineConfidence };
  }
}
```

- [ ] Register `new NativeMlKitOcrProvider()` first in the selection array.
- [ ] Pre-build hook (mirror `copy-ocr-assets.js`): `npm run build && npx cap sync` before Android build.
- [ ] Downstream (`parseCredentialText`, field-confidence merge) unchanged.

**Exit:** on-device Android OCR functioning; parser output parity vs. Tesseract on identical ground-truth.

---

## Phase 4 — Optional bounding-box overlay (opt-in, gated)

**Goal:** offer a live bounding-box overlay as a **Settings toggle**, accepting its trade-offs explicitly.

- [ ] New setting `ocrShowBoundingBoxOverlay` (default **off**, marked experimental).
- [ ] When **on**, the native provider routes through `@capacitor-community/image-to-text`
      (`detectText({ base64 })` → corner points) to render an overlay over the camera frame.
- [ ] **Trade-offs to surface in the toggle's help text / decision log:**
  - Pulls in **Firebase ML Vision** + `google-services.json` → new Google dependency/telemetry surface
    (must be reconciled with `SECURITY.md` ZK boundary).
  - Plugin returns **no confidence** → fall back to parser-only field confidence when overlay mode is active.
- [ ] If the Firebase dependency is judged unacceptable, keep the toggle but back it with bounding boxes
      from a future standalone-ML-Kit plugin instead. **Do not bundle `image-to-text` unless the toggle ships.**

**Exit:** overlay toggle works; default builds remain Firebase-free.

---

## Phase 5 — Security / CSP / origin re-audit (gate before any distribution)

The Capacitor app loads from `https://localhost`, **not** the deployed origin. This is a **new platform
target**, not a transparent shim.

- [ ] **CSP parity** — re-assert strict hash-based CSP inside the WebView (`securityHeaders.ts` /
      `vercel.json` headers are not applied in-WebView); add `https://localhost` where origin checks
      assume the production domain.
- [ ] **WebAuthn/PRF** — per Phase 2 (D1/D2): confirm biometric is **disabled/hidden** on the Capacitor
      surface and the **master-password unlock path is intact**. (PRF-in-WebView is out of scope here.)
- [ ] **No new egress** — confirm bundled ML Kit model (jcesarmobile default `16.0.1`), no Play-Services
      model download. (Phase 4 Firebase path audited separately if enabled.)
- [ ] **In-memory only** — base64 path holds no disk temp file; do **not** switch to `@capacitor/camera`
      file capture.
- [ ] **AI/WebGPU surface** — note this is a *second* Android surface alongside the kill-switched
      WebLLM/LiteRT path; no code overlap, but document it.
- [ ] Update `SECURITY.md` and `SECURITY_AUDIT_REPORT.md`.

---

## Phase 6 — Build, sideload distribution & docs

- [ ] Gradle build + signing key (new — none exists today).
- [ ] **Distribution: internal/sideload APK** (no Play Store listing for now). The web PWA stays fully
      functional via Tesseract, so the Android APK is a pure enhancement and can ship independently.
- [ ] Update `PROJECT_STATUS.md`, `ROADMAP.md`, `TEST_STATUS.md`, `CLAUDE.md`.

---

## Testing

- [ ] Unit: `NativeMlKitOcrProvider` with mocked `@jcesarmobile/capacitor-ocr`
      (mirror `tesseractService.test.ts` / `cameraCapture.test.ts` style).
- [ ] `isAvailable()` selection: native → native provider; browser → Tesseract.
- [ ] Parser parity: identical ground-truth strings through both providers → same
      `{ username, password, url }`.
- [ ] Manual on-device matrix in `TEST_STATUS.md`: credential cards/screenshots, low-light, skewed —
      cases where ML Kit should beat Tesseract.

---

## Risks & open items

| Risk | Mitigation |
|---|---|
| WebAuthn/PRF biometric breaks under `https://localhost` | ✅ **Resolved (Phase 2):** confirmed it does not work transparently in a Capacitor WebView → Android build uses **master-password unlock**; biometric decoupled. See [spike doc](./OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md). |
| Overlay's Firebase `google-services.json` violates ZK posture | Overlay is opt-in/off-by-default; Firebase never bundled unless toggle ships (Phase 4) |
| Second Android maintenance surface (build/signing pipeline) | Sideload-only scope; PWA remains the primary, fully-functional surface |
| Plugin abandonment | Provider seam isolates the dependency; swap plugins behind `NativeMlKitOcrProvider` |

---

## Decisions locked (this revision)

1. **Android only** — iOS Vision path deferred (not enabled even though jcesarmobile supports it).
2. **Sideload/internal APK** — no Play Store listing for now.
3. **Overlay = Settings toggle**, off by default, backed by `@capacitor-community/image-to-text`,
   with its Firebase/no-confidence trade-offs flagged and gated (Phase 4).

---

## Sources

- [ML Kit Text Recognition v2 — Android](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [JS bridge / WebView — Android Developers](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge)
- [WebView native-bridge risks](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges)
- [Trusted Web Activities — Chrome Status](https://chromestatus.com/feature/4857483210260480)
- [@jcesarmobile/capacitor-ocr](https://github.com/jcesarmobile/capacitor-ocr) · [npm](https://www.npmjs.com/package/@jcesarmobile/capacitor-ocr)
- [@capacitor-community/image-to-text](https://github.com/capacitor-community/image-to-text)
- [Capacitor 7 GA](https://ionic.io/blog/capacitor-7-has-hit-ga) · [Updating to 7.0](https://capacitorjs.com/docs/updating/7-0)
- [Shape Detection API](https://developer.chrome.com/docs/capabilities/shape-detection) · [Text Detection — Chrome Status](https://chromestatus.com/feature/5644087665360896)
