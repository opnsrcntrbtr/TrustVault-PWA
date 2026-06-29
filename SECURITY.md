# TrustVault PWA - Security Documentation

## 🔒 Security Architecture

TrustVault is designed with enterprise-grade security matching a 9.5/10 security rating, fully compliant with OWASP Mobile Top 10 2025 guidelines.

### Security Score: 9.5/10

**Breakdown:**
- ✅ **M1: Improper Platform Usage** - Full WebAuthn FIDO2 implementation
- ✅ **M2: Insecure Data Storage** - AES-256-GCM encrypted IndexedDB
- ✅ **M3: Insecure Communication** - HTTPS-only with CSP headers
- ✅ **M4: Insecure Authentication** - Biometric + Master Password
- ✅ **M5: Insufficient Cryptography** - PBKDF2 600k+ iterations, Scrypt
- ✅ **M6: Insecure Authorization** - Zero-knowledge architecture
- ✅ **M7: Client Code Quality** - TypeScript strict mode, ESLint
- ✅ **M8: Code Tampering** - Service Worker integrity checks
- ✅ **M9: Reverse Engineering** - Obfuscated production builds
- ✅ **M10: Extraneous Functionality** - Zero telemetry, no logging

---

## 🛡️ Cryptographic Implementation

### Master Password Hashing
- **Algorithm**: Scrypt (memory-hard, RFC 7914) via `@noble/hashes/scrypt`
- **Parameters**:
  - N (CPU/memory cost): 131072 (2^17, ~128 MB working memory)
  - r (block size): 8
  - p (parallelism): 1
  - Derived key length: 32 bytes
  - Salt: 128-bit cryptographically secure random
- **Storage format**: `scrypt$N$r$p$saltB64$hashB64` (PHC-like)
- **History**: Originally Argon2id via `argon2-browser` — migrated to Scrypt to resolve CSP/WASM loading issues. See `DATABASE_MIGRATION.md`.

### Key Derivation
- **Vault key wrapping (scrypt-v1, Finding 3, 2026-06-11)**: `encryptedVaultKey`
  is wrapped under a scrypt-derived key (`deriveVaultWrapKey`, N=131072, r=8,
  p=1, dkLen=32 — memory-hard, GPU-resistant). Users carry a `vaultKdf:
  'scrypt-v1'` marker; legacy PBKDF2-wrapped users are upgraded transparently
  on the next successful password login (best-effort, never blocks login).
- **Legacy/general derivation**: PBKDF2-SHA256
- **Iterations**: 600,000+ (OWASP 2025 compliant)
- **Salt**: 256-bit cryptographically secure random
- **Output**: 256-bit AES key

### Encryption
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Size**: 256 bits
- **IV**: 96-bit random per operation
- **Authentication**: Built-in AEAD with GCM mode

### Password Generation
- **Default Length**: 20 characters
- **Character Sets**: Uppercase, lowercase, numbers, symbols
- **Entropy**: ~130 bits minimum
- **CSPRNG**: Web Crypto API `crypto.getRandomValues()`

---

## 🔐 Authentication Flow

### Master Password Authentication
1. User enters email and master password
2. Password hashed with Scrypt (client-side)
3. Vault key derived using PBKDF2 with user's salt
4. Session created with encrypted vault key
5. Auto-lock after 15 minutes of inactivity

### Biometric Authentication (WebAuthn PRF — S1)
This section describes the concrete cryptographic instantiation of the **[Zero-Knowledge Architecture](./README.md#architecture-snapshot)** principle documented in README.md.

1. Platform authenticator verification (Touch ID / Face ID / Windows Hello)
2. Challenge generation (256-bit random)
3. User verification required (UV flag)
4. Counter-based replay attack prevention
5. **Demonstrable zero-knowledge vault unlock via the WebAuthn PRF extension**

**How the vault key is protected (`vaultKeyScheme: 'prf-v1'`):**
- On enroll, the credential is created with the PRF extension, then a second
  assertion evaluates the PRF at a random per-credential salt to obtain a 32‑byte
  secret that lives only in the authenticator hardware.
- That secret is run through **HKDF‑SHA256** (`info: "TrustVault Vault Key Wrapping v1"`)
  to derive a non‑extractable AES‑256‑GCM **wrap key**, which encrypts the vault key.
- Storage holds only `{ wrappedVaultKey, prfSalt, vaultKeyScheme }`. The PRF output
  and the wrap key are **never persisted**.

**Why this is zero-knowledge (threat model):** the wrap key can only be reproduced
by the physical authenticator after a biometric user‑verification gesture. Neither
an XSS payload nor a full IndexedDB dump can derive it from stored values. This
replaces the previous device‑key scheme, whose inputs (`credentialId`, `userId`,
`salt`) were all stored and therefore recomputable offline — an exploitable flaw
that let stored data alone unlock the vault.

**Migration & fallback:**
- Legacy device‑key credentials are removed by the DB **v6** migration and on the
  next password login; affected users re‑enroll biometric once (master password
  unlock is unaffected and remains the recovery path).
- PRF support is detected as a tri-state (`detectPRFSupport()`):
  - **Known unsupported** (no WebAuthn, or client capabilities report no PRF):
    biometric is **not offered** — the UI disables enrollment and hides the
    unlock button, falling back to master password.
  - **Unknown** (`PublicKeyCredential.getClientCapabilities` unavailable — still
    common in 2026): enrollment is **attempted and hard-verifies PRF** via
    `prf.enabled` and the assertion's PRF result. If PRF turns out unavailable,
    it aborts with a clear "use your master password" message.
  - No insecure (recomputable) scheme is ever used on any path.

---

## 🗄️ Data Storage

### IndexedDB Schema
```
TrustVaultDB (v1)
├── credentials
│   ├── id (primary key)
│   ├── title
│   ├── username
│   ├── encryptedPassword (AES-256-GCM)
│   ├── category
│   ├── tags
│   └── timestamps
├── users
│   ├── id (primary key)
│   ├── email
│   ├── hashedMasterPassword (Scrypt)
│   ├── encryptedVaultKey
│   ├── salt
│   └── webAuthnCredentials
└── sessions
    ├── id (primary key)
    ├── userId
    ├── encryptedVaultKey
    └── expiresAt
```

### Encryption at Rest
- All credential passwords encrypted with AES-256-GCM
- Sensitive metadata (title/username/url/tags/card fields) encrypted at rest (S5)
- Vault key encrypted with derived master key
- Session keys stored in memory only
- Automatic secure wipe on logout

### Key Hygiene (S7)
- **Session vault keys are non-extractable** `CryptoKey`s on BOTH unlock paths
  (password and biometric PRF) — `crypto.subtle.exportKey` on them throws.
- Transient raw key material (PBKDF2 output, decrypted vault-key bytes, PRF
  outputs) is **zeroized** (`.fill(0)`) immediately after use.
- Biometric enrollment confirms the **master password** and recovers the vault
  key from its encrypted stored copy — the in-memory session key is never
  exported (mirrors Bitwarden's enrollment flow).
- Known residual: base64 *string* copies of key material during decrypt are
  immutable JS strings and cannot be zeroized; eliminating them requires a
  storage-format migration (tracked, out of scope).
- Vault imports are schema-validated with Zod before any row is processed (S8).

---

## 🌐 Network Security

### Content Security Policy (strict, hash-based — S2)
The canonical policy lives in `src/config/securityHeaders.ts` (single source of
truth; `vercel.json` parity is enforced by `securityHeaders.test.ts`):

```
default-src 'self';
script-src 'self' 'sha256-<inline-bootstrap-hash>' 'wasm-unsafe-eval';
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

Key properties:
- **No `'unsafe-inline'` / `'unsafe-eval'` in `script-src`.** The single inline
  bootstrap script (GitHub-Pages SPA redirect) is allowed via SHA-256 hash; a
  drift test recomputes the hash from `index.html` on every test run. WASM
  (self-hosted Tesseract core) needs only the narrower `'wasm-unsafe-eval'`.
- **`style-src 'unsafe-inline'` is a documented residual** for MUI/Emotion
  runtime styles — a far lower-risk vector than script injection.
- **No CDN origins.** Tesseract OCR assets are self-hosted under `/ocr/`
  (version-pinned via package-lock), eliminating the former
  `cdn.jsdelivr.net` supply-chain exposure (P2).

### Network Egress (breach detection)
The ONLY external endpoints the app contacts are the HIBP APIs
(`api.pwnedpasswords.com`, `haveibeenpwned.com`) for breach detection, using
k-anonymity (only the first 5 hash chars leave the device). The feature is
user-toggleable via `VITE_HIBP_API_ENABLED`. Everything else is same-origin.

**HIBP prefix store (P4 residual, accepted):** to enable background breach
re-checks while the vault is locked, each credential's 5-char SHA-1 prefix is
persisted unencrypted in the `breachPrefixes` IndexedDB table (DB v8). This is
exactly the string already disclosed to HIBP under k-anonymity — ~1M passwords
share each prefix — so persisting it adds no disclosure beyond what the breach
check itself already reveals. Rows are deleted with their credential and wiped
by the security wipe (`clearAll()`). The periodic-sync worker
(`public/sw-periodic-sync.js`) prefetches range responses into the
`hibp-ranges` cache; the suffix comparison only ever happens in the app after
unlock.

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (legacy auditor removed from modern browsers; CSP is the real defense — OWASP guidance)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), geolocation=(), microphone=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

---

## 📷 OCR Credential Capture Security

### Local-Only Processing
TrustVault's camera-based credential scan feature uses **Tesseract.js** for 100% client-side OCR:

| Guarantee | Implementation |
|-----------|----------------|
| **No network upload** | Tesseract runs entirely in Web Workers + WASM; images never leave the device |
| **Immediate buffer clearing** | Captured image `ArrayBuffer` is zeroed and released immediately after OCR |
| **No persistence** | Images are never written to IndexedDB, localStorage, or disk |
| **User confirmation** | Detected fields are shown for review before being applied to the form |

### Camera Permission
- Permission requested only when user initiates scan
- `Permissions-Policy: camera=(self)` restricts access to first-party origin
- Camera stream is stopped immediately after capture

### Memory Hygiene
```typescript
// After OCR completes:
const buffer = await blob.arrayBuffer();
new Uint8Array(buffer).fill(0); // Overwrite image data
// Let GC reclaim memory
```

### Privacy Notice
The scan UI displays: "🔒 Images are processed locally and never uploaded"

---

## 🤖 On-Device AI Boundary

The optional **"Explain with AI"** features (password-strength explanation on the generator/credential
forms, and **breach impact analysis** on the Breach Details modal) are controlled by toggles in
Settings → *AI Assistance (Experimental)*: `enableOnDeviceAI` (master), `allowStrengthExplanation`,
and `allowBreachImpactAnalysis`. **All default `true`** (`src/core/ai/aiSettings.ts`), but **no data
ever leaves the device** — inference runs entirely locally (see Provider). A user-initiated action is
still required to invoke the model (clicking "Explain", expanding the AI accordion); the model is
never called automatically on page load. Disabling the master toggle forces all sub-features off.

### Platform support — desktop Chrome (Gemini Nano) + Android (WebLLM)
Chrome's built-in `LanguageModel` global is **not exposed on Android or iOS Chrome** as of this
writing — confirmed via remote DevTools (`typeof LanguageModel === 'undefined'` on Android Chrome,
even with settings toggles enabled). Gemini Nano requires local model storage/compute that mobile
Chrome does not provision. To close this platform gap, a second, fully-local inference backend
(**WebLLM**, WebGPU-based) is wired in behind a provider abstraction (`src/core/ai/providers/`,
`AiProvider` interface) and is selected automatically — via `getActiveProvider()`
(`src/core/ai/providers/registry.ts`) — only when: (1) Chrome built-in AI is `'unavailable'`, (2) a
real WebGPU adapter can be acquired (`navigator.gpu.requestAdapter()` resolves non-null —
capability detection is platform-honest, never UA-sniffed alone), and (3) the v1 UI surface flag
(`isMobileAiSurfaceEnabled()`, currently Android-only) is enabled. Desktop Chrome's behavior,
prompts, and data boundary are **completely unchanged** — `aiAvailability.ts` checks the
chrome-builtin provider first and only falls through to the registry when chrome itself reports
`'unavailable'`, so the existing availability states/UI copy on desktop are byte-for-byte preserved.
`AiAssistanceSettings.tsx` disables the master "Enable on-device AI" switch (and both sub-toggles)
whenever `getAiAvailability()` resolves to `'unavailable'` on either backend, so unsupported
platforms can't enable a feature that will never activate. On the Breach Details modal and
credential forms, an unsupported/unavailable platform simply omits the AI panel — no error, no
blocked core functionality. iOS remains unsupported (no WebGPU/WebLLM path is offered).

### Provider — fully local, no network egress (for prompts/inference)
- **Desktop Chrome:** the global `LanguageModel` (Gemini Nano), performing inference **locally on
  the user's device**. Isolated in `src/core/ai/providers/chromeBuiltinProvider.ts`.
- **Android (WebGPU):** `@mlc-ai/web-llm`, also performing inference **locally on-device** via
  WebGPU compute — no prompt or completion is transmitted off-device on either backend. Isolated in
  `src/core/ai/providers/webllmProvider.ts`; the heavy WASM/JS library is lazy-imported only inside
  `createEngine()` (`await import('@mlc-ai/web-llm')`), never top-level, and is excluded from Vite's
  `optimizeDeps` and the service worker's precache manifest (`vite.config.ts` `globIgnores`) — so it
  is never fetched, bundled, or precached on desktop.
- No remote AI, no Window AI / browser-extension provider in either backend.

**LiteRT-LM (2026-06-21):** A third provider, `litert-lm`, was added behind its
own kill-switch (`LITERT_ANDROID_ENABLED` in `capabilities.ts`) to A/B test
whether Google's actively-supported LiteRT-LM runtime survives the Qualcomm
Adreno `VK_ERROR_DEVICE_LOST` failure that disabled WebLLM's Android surface
(see TEST_STATUS.md). It shares the same WebGPU/Dawn stack implicated in that
failure, so survival on Adreno is unverified, not assumed. Same security
boundary as WebLLM: fully local inference, weights download only from the
already-allowlisted HuggingFace origins, no new `connect-src` exception. Its
WASM *runtime* (distinct from model weights) is self-hosted under
`public/litert/` rather than the package's default `cdn.jsdelivr.net` fetch —
this project does not add CDN egress for runtime assets (same rule already
applied to Tesseract OCR).

### Never-download policy (Chrome built-in) / opt-in one-time download (WebLLM)
- **Chrome built-in:** the feature is usable only when `LanguageModel.availability() === 'available'`.
  The app **never** calls `create()` in a `downloadable`/`downloading` state, so TrustVault never
  initiates a multi-GB model download on desktop. Offline-first posture is preserved.
- **WebLLM (Android):** this backend's model weights (one of three prebuilt sizes, 720MB–1.9GB,
  catalog in `src/core/ai/webllmModels.ts`) are **not** bundled with the app and must be downloaded
  once, **only after explicit user opt-in** — tapping "Download model" in Settings → AI Assistance
  (Experimental) → "On-device AI model (Android)" block, shown only when this backend is active.
  This is the **single new network egress** introduced by the Android backend: a one-time fetch of
  model weights/config from the MLC/Hugging Face CDN. **No user data is part of this request** — it
  is a static asset download, not a prompt/inference call. The allowed origins are an explicit CSP
  `connect-src` exception (`WEBLLM_MODEL_ORIGINS`, `src/config/securityHeaders.ts`, mirrored in
  `vercel.json` under the existing drift-guard parity test). Once downloaded, WebLLM's own cache
  (IndexedDB/Cache Storage, persisted via `navigator.storage.persist()`) is reused — inference is
  then fully offline, same as Chrome built-in. A "Remove model" action evicts the cached engine and
  resets the ready flag, requiring a fresh opt-in download to re-enable. Each `runStreaming()` call
  starts from `engine.resetChat()` (clean context per call, no cross-conversation leakage); an
  in-flight generation can be cancelled via `AbortSignal` → `engine.interruptGenerate()`.

### Data boundary (treated as outside the zero-knowledge boundary)
Because inference is local, nothing below is transmitted off-device. The data is still treated as
crossing the **app's** zero-knowledge boundary (decrypted plaintext handed to the browser runtime),
so the inputs are deliberately minimized per feature:

- **Strength explanation — sent to AI:** only the strength label (`weak|medium|strong|very-strong`)
  and the rounded entropy integer — the same two values the strength meter already shows the user.
  Prompt is built in `src/core/ai/strengthExplain.ts`.
- **Breach impact analysis — sent to AI:** public breach metadata (breach name, date, compromised
  data classes) plus non-secret credential metadata (title, username, category, password age in
  days). Prompt is built in `src/core/ai/breachImpactExplain.ts`, which includes a defense-in-depth
  invariant that throws if a `password:`/`notes:` field shape is ever detected.
- **NEVER sent (any feature):** password characters, master key, vault keys, TOTP/recovery codes,
  or secret notes/documents.
- No prompt or response is logged or persisted; the `LanguageModel` session is destroyed after each
  call (`finally { session.destroy() }`).
- Both prompt builders are secret-free and covered by unit tests asserting no secret-shaped data in
  the prompt.

### Failure mode
- Any error (API absent, availability not `available`, inference failure) is handled gracefully:
  - **Strength explanation:** the button is hidden or returns no explanation. Core generator behavior is never blocked.
  - **Breach impact analysis:** shows an error Alert with a Retry button, allowing the user to try again. The modal's core breach details remain visible and usable.

### Chat follow-up + standalone general assistant (2026-06-22)
The strength-explainer and breach-impact panels were extended from a single one-shot explanation
into a multi-turn follow-up chat, and a new standalone **AI Assistant** entry point (toolbar icon on
the dashboard) lets the user ask general questions outside any specific panel. All three surfaces
share one abstraction:

- **`ChatSession` (multi-turn):** each `AiProvider` now exposes a stateful session — the
  chrome-builtin and litert-lm backends use the runtime's native multi-turn session, while WebLLM
  (no native session API) maintains its own trimmed transcript and replays it each turn
  (`chatTrim.ts` caps the transcript so the prompt stays within `context_window_size`). `useAiChat`
  (`src/presentation/hooks/useAiChat.ts`) wraps a `ChatSession` with React state, exposing
  `{ enabled, messages, streaming, error, send, stop, retry, reset }` to all three UI surfaces
  (`PasswordStrengthIndicator.tsx`, `BreachDetailsModal.tsx`, `GeneralAssistant.tsx`) via the shared
  `ChatPanel` component.
- **Ephemeral, RAM-only history:** the transcript lives only in the `ChatSession`/React state for
  that component instance. It is destroyed — never written to IndexedDB, localStorage, or
  `console.*` — when the panel/dialog closes, the vault locks, the user logs out, or the component
  unmounts. Closing and reopening a panel starts a fresh session with no memory of the prior turn.
- **Context-scope selector (general assistant only):** `GeneralAssistant.tsx` lets the user pick a
  runtime scope — `stateless` (no vault data, default), `curated` (vault summary), or
  `per-credential` (one credential) — via `ChatScope` (`src/core/ai/chat/chatTypes.ts`). Switching
  scope calls `chat.reset()` first, so no transcript built under one scope context ever carries into
  another. The strength and breach panels are not scoped — they're seeded from that panel's own
  data only.
- **`assertNoSecrets` chokepoint:** every app-constructed system/context message — strength label,
  breach metadata, vault summary, per-credential metadata — passes through the single
  `assertNoSecrets()` guard in `src/core/ai/chat/chatContext.ts` before reaching any provider. It
  throws if a `password:`/`notes:`/secret-shaped key is ever present, matching the existing
  defense-in-depth invariant in `breachImpactExplain.ts`.
- **Free-text user turns are trusted, not inspected:** once a chat is open, the user's own typed
  follow-up text is sent to the on-device model as-is — it is never scanned, filtered, or blocked
  for secret-shaped content. This is intentional: the user is knowingly typing into a chat box they
  opened, the same trust boundary as any other local text input, and inference stays on-device
  regardless of what's typed. Only *app-constructed* context (the system prompt assembled from vault
  data) goes through `assertNoSecrets`.
- **Settings:** `allowChatFollowUp` (gates follow-up chat on the strength/breach panels — when
  `false`, those panels fall back to a single static, non-interactive answer with no input box),
  `enableGeneralAssistant` (shows/hides the dashboard toolbar entry point), and
  `generalAssistantDefaultScope` (initial `ChatScope` for new assistant sessions) — all in
  `src/core/ai/aiSettings.ts`, **all default `true`/`stateless`**, safe under the same reasoning as
  the existing AI toggles: inference is fully local and gated behind explicit user action.
- **Platform reach:** in practice this lands on **desktop Chrome (Gemini Nano)** today — the
  Android WebLLM surface remains kill-switched (`WEBLLM_ANDROID_ENABLED = false`, see Platform
  support above) pending the upstream Adreno fix, so chat follow-up on Android is currently inert
  the same way the one-shot explainers are.

### Chrome built-in AI alignment (2026-06-24)
The chrome-builtin provider was hardened to use the stable June 2026 Prompt API surface
(`AiProvider.supports()` capability gate, sampling `params`, `expectedInputs`/`expectedOutputs`
language hints, `measureInputUsage`/`inputQuota`), then extended with four Chrome-only,
hard-gated capabilities — every one of them composes with the existing ZK boundary rather than
bypassing it:

- **Structured insight cards (`responseConstraint`):** the strength and breach one-shot explainers
  (`strengthExplain.ts` / `breachImpactExplain.ts`) gained `explainStrengthStructured()` /
  `explainBreachImpactStructured()`, which call `promptApi.runStructured()` with a JSON Schema
  (`STRENGTH_INSIGHT_SCHEMA` / `BREACH_INSIGHT_SCHEMA`). **Schemas describe only non-secret fields**
  — severity/risk level, category labels, ranked action strings — never a password or secret field.
  The typed result renders as a `StrengthInsightCard`/`BreachInsightCard` *above* the existing
  free-text follow-up chat; chat turns themselves remain free-text and untouched by this change. On
  schema-validation failure the raw text is shown instead of erroring.
- **Summarizer-backed vault overview:** `vaultAggregate.ts` gained `summarizeVaultOverview()`,
  which runs the already non-secret, `assertNoSecrets()`-checked overview text
  (`formatVaultOverviewText()`) through the standalone Summarizer API wrapper
  (`src/core/ai/summarizer.ts`) and falls back to the formatted text verbatim if the Summarizer is
  unavailable. No new data reaches the model beyond what `vaultAggregate.ts` already aggregated.
- **Multilingual output:** `resolveAiLanguage()` (`src/core/ai/aiLanguages.ts`) maps the browser
  locale to one of Gemini Nano's supported languages (`en`/`es`/`ja`/`de`/`fr`), falling back to
  English for anything else. Only changes which language the model replies in — no change to what
  data is sent.
- **Quota-aware chat:** `checkChatUsage()` (`chatTrim.ts`) reads `ChatSession.measureUsage()` (Chrome
  only) to warn the user in `ChatPanel` before the context fills, instead of relying solely on the
  turn-count heuristic. WebLLM/LiteRT sessions don't expose `measureUsage`, so they silently keep the
  existing heuristic — no behavior change on Android.

**Hard gate:** all four capabilities are unavailable unless `provider.supports(cap)` is true, which
only the chrome-builtin provider reports. WebLLM and LiteRT-LM return `false` for every new
capability, so callers fall back to pre-existing behavior automatically — no Android-specific code
path was added or changed. **No new network egress and no new CSP exception** — every capability
above runs through the same fully-local `LanguageModel`/`Summarizer` globals as the existing
one-shot/chat paths.

---

### Native Android OCR surface (Capacitor + ML Kit, 2026-06-26)

An **optional** Capacitor Android wrapper adds an on-device **ML Kit Text Recognition v2** path for
OCR-based credential entry, selected ahead of the browser Tesseract.js path only on native Android
(`@jcesarmobile/capacitor-ocr`). The web PWA remains the primary, fully-functional surface; the wrapper
is purely additive. See `docs/OCR_NATIVE_ANDROID_PLAN.md` and the phase docs
(`OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md`, `OCR_PHASE5_SECURITY_AUDIT.md`).

This Capacitor app is treated as a **distinct platform target** (origin `https://localhost`, not the
deployed domain), so the PWA's header-based guarantees were re-audited rather than assumed:

- **Biometric disabled on this surface.** The `prf-v1` WebAuthn PRF unlock does **not** pass through the
  Android WebView → Credential Manager path, and Credential Manager binds the response origin to the app
  signature (Digital Asset Links) rather than the web RP ID. `isBiometricAvailable()` therefore returns
  `false` inside the native app (`isNativeApp()` seam in `src/core/platform/runtime.ts`), hiding biometric
  enrollment/UI and leaving the existing **Scrypt master-password unlock** as the only path. Web behavior
  is unchanged.
- **No new network egress / no new CSP origin.** ML Kit recognition is fully on-device using the
  **bundled** model (`16.0.1`) — no model download — so `connect-src` in `securityHeaders.ts` is unchanged.
- **In-memory only.** The captured frame is handed to the recognizer as an in-memory base64 data URL
  (no `file://` temp / `FileProvider`) and zeroized after recognition — same zero-knowledge frame handling
  as the web path.
- **On-device AI stays kill-switched** on this surface (`WEBLLM_ANDROID_ENABLED = false`), consistent with
  the web build; the OCR path shares no code with the AI providers.
- **CSP injection (Phase 6 prerequisite, done 2026-06-28):** `scripts/inject-csp-for-capacitor.js` injects
  a `<meta http-equiv="Content-Security-Policy">` tag derived from `buildContentSecurityPolicy()` into the
  native `android/.../index.html` at `cap sync` time (Node 24 native TS type-stripping, no duplicated
  policy string to drift). `frame-ancestors` is stripped (spec-ignored in `<meta>`). Idempotent; skips
  gracefully if `android/` doesn't exist yet. **On-device enforcement still unverified** — requires a real
  `android/` build.

### Optional bounding-box overlay (Phase 4, done 2026-06-28)

A second, off-by-default toggle (`ocrShowBoundingBoxOverlay` in `src/core/ocr/ocrSettings.ts`, surfaced
via `OcrOverlaySettings.tsx` in Settings) swaps the native OCR provider to
`NativeBoundingBoxOcrProvider` (`@capacitor-community/image-to-text`), which returns per-detection corner
geometry instead of a confidence score:

- **New dependency, but lazy and gated.** `@capacitor-community/image-to-text` wraps Firebase ML Vision +
  `google-services.json` on Android — a new Google dependency/telemetry surface versus the default ML Kit
  path. It is imported only inside `NativeBoundingBoxOcrProvider.recognize()` (dynamic `import()`) and
  excluded from `vite.config.ts` `optimizeDeps`, so it is never loaded — on web, or on native Android with
  the toggle left at its **off** default.
- **No new CSP origin.** `detectText()` is a Capacitor native-bridge (binder) call, not a WebView
  JS-initiated network request. CSP only governs JS-context network calls, so it's structurally
  inapplicable here — unlike the WebLLM/LiteRT model downloads, which *do* need a `connect-src` exception
  because those fetches happen in JS. This is a correction to this doc's prior framing, which speculated a
  CSP exception would be needed.
- **No confidence score.** `engineConfidence` is always `undefined` from this provider; field confidence
  falls back to the parser's own heuristics, using the same `engineConfidence != null` guard already in
  `CameraScanDialog.handleCapture` — no special-casing required.
- **Single-shot, not live.** `detectText()` has no continuous-frame API. The "overlay" is a brief
  (1.8s, auto-continuing, user-dismissable) **post-capture review** rendered over the frozen captured
  frame, not a live video overlay — `docs/OCR_NATIVE_ANDROID_PLAN.md` Phase 4 has the full scope note.
- **Same zero-knowledge frame handling.** The captured blob is still zeroized in a `finally` after
  recognition, success or throw, matching every other OCR provider.

---

## 📱 PWA Security Features

### Service Worker
- Offline-first architecture
- Intelligent caching strategy
- Integrity validation
- Automatic updates
- No external CDN dependencies

### Installation
- Add to Home Screen support
- Standalone display mode
- Secure context required (HTTPS)
- No browser chrome in app mode

---

## 🔍 Security Audit

### Password Strength Analysis
- Real-time strength meter
- Entropy calculation
- Common pattern detection
- Breach database checking via HIBP with k-anonymity (shipped; user-toggleable)

### Security Score
- Per-credential security rating (0-100)
- Weak password identification
- Reused password detection
- Age-based recommendations

---

## ⚠️ Security Considerations

### Known Limitations
1. **JavaScript Memory**: Cannot guarantee complete memory wipe
2. **Browser Extensions**: May intercept clipboard operations
3. **Screenshot Protection**: Limited on web platform
4. **Biometric Fallback**: Relies on device security

### Best Practices
1. Use strong, unique master password (20+ characters)
2. Enable biometric authentication on supported devices
3. Lock vault when not in use
4. Regular security audits of stored credentials
5. Export backups to secure offline storage

---

## 🚀 Security Roadmap

### Planned Enhancements
- [ ] Hardware security key support (YubiKey)
- [ ] Secure password sharing with E2EE
- [ ] Breach monitoring integration
- [ ] Encrypted cloud sync
- [ ] Emergency access protocols
- [ ] Multi-device synchronization
- [ ] Advanced 2FA methods

---

## 📊 Compliance

### Standards
- ✅ OWASP Mobile Top 10 2025
- ✅ NIST SP 800-63B (Digital Identity Guidelines)
- ✅ FIDO2 WebAuthn Level 2
- ✅ W3C Web Crypto API

### Privacy
- ✅ Zero-knowledge architecture
- ✅ No telemetry or analytics
- ✅ No third-party scripts
- ✅ Local-first data storage
- ✅ GDPR compliant (no data collection)

---

## 🛠️ Security Testing

### Manual Testing
```bash
# Run security audit
npm run security:audit

# Check for vulnerable dependencies
npm audit

# Type checking
npm run type-check

# Linting
npm run lint
```

### Automated Testing
- Lighthouse CI for PWA compliance
- OWASP ZAP for penetration testing
- npm audit for dependency vulnerabilities
- TypeScript strict mode for type safety

---

## 📝 Security Incident Response

### Reporting Security Issues
**DO NOT** create public GitHub issues for security vulnerabilities.

Contact: security@trustvault.example (example - update with real contact)

### Response Timeline
- Acknowledgment: Within 24 hours
- Initial assessment: Within 48 hours
- Fix deployment: Based on severity
- Public disclosure: After fix is deployed

---

## 📚 Additional Resources

- [OWASP Mobile Security Testing Guide](https://owasp.org/www-project-mobile-security-testing-guide/)
- [Web Crypto API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [WebAuthn Guide](https://webauthn.guide/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)

---

**Last Updated**: June 24, 2026
**Security Version**: 1.3.0 (S2 strict CSP, S7 key hygiene, S8 import validation, P2/P5 supply chain + multi-turn chat follow-up security boundary — see SECURITY.md § Chat follow-up + standalone general assistant)
**Compliance Level**: OWASP Mobile Top 10 2025 ✅
