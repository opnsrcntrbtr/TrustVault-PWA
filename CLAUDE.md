# TrustVault PWA - Claude Code Guide

**Tech Stack:** React 19 + Vite 6.4 + TypeScript 5.7 + PWA + IndexedDB (Dexie)
**Architecture:** Clean Architecture (Domain/Data/Presentation) + Offline-First

---

## Key Docs

**Status & Planning:**
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** ← Start here (single source of truth, all 7 phases complete, deployment checklist)
- [ROADMAP.md](./ROADMAP.md) — Phased development timeline (all phases 0–7 documented)
- [README.md](./README.md) — Project overview & tech stack

**Deep Dives:**
- [SECURITY.md](./SECURITY.md) — Cryptographic implementation, OWASP compliance
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) — Hub linking all feature deep-dives

**Validation:**
- [DOC_VALIDATION_REPORT.md](./DOC_VALIDATION_REPORT.md) — Documentation audit, lint errors, test gaps

---

## Current Status (June 2026)

**✅ Phase 7 Complete (2026-06-18)** — All 7 phases delivered, feature-complete, production-ready.
- Phase 1 (2026-05-20): Core CRUD + dashboard
- Phases 2–3 (2026-06-01): Security features, settings, import/export
- Phases 4–5 (2026-06-12): Biometric, responsive design, testing (1098/1099 tests passing)
- Phases 6–7 (2026-06-18): Production hardening, multi-vault profiles

Update `PROJECT_STATUS.md`, `ROADMAP.md`, or `AGENTS.md` if scope/timeline shifts.

### Definition of Done
1. Feature flagged or guarded if experimental.
2. `npm run type-check` (0 errors), `npm run lint` (0 errors — **currently 13 test-file lint errors must be fixed before next PR**), targeted `npm run test` pass locally.
3. Manual verification in `TEST_STATUS.md` (+ `SECURITY_AUDIT_REPORT.md` for security).
4. Docs refreshed (README/ROADMAP/PROJECT_STATUS/CLAUDE/copilot as needed).
5. No sensitive data logged; CryptoKey objects stay memory-bound.

> **Note:** See `DOC_VALIDATION_REPORT.md` for current linting status (13 errors in 4 test files + 1 flaky import-export test). Fix before next feature PR.

---

## Quick Commands

```bash
npm run dev          # Dev server @ :3000 (auto port if taken)
npm run build        # Type-check → Production build
npm run preview      # Preview production build
npm run type-check   # TypeScript validation only
npm run lint         # ESLint (max 0 warnings)
npm run test         # Vitest unit tests
npm run lighthouse   # PWA audit (target: >90 all metrics)
```

---

## Critical Rules

### 1. Module Loading Patterns

- **argon2-browser NOT used** — removed (CSP/WASM). Use `@noble/hashes/scrypt` instead (see `DATABASE_MIGRATION.md`).
- Heavy WASM/UMD: lazy dynamic import + exclude from `optimizeDeps` in vite.config.ts. Never top-level import.

### 2. React 19 Patterns

**StrictMode Safe UseEffect:**
```typescript
useEffect(() => {
  let mounted = true;
  let hasCompleted = false;

  const completeInitialization = () => {
    if (mounted && !hasCompleted) {
      hasCompleted = true;
      setInitialized(true);
    }
  };

  // Async work with timeout fallback
  const timeout = setTimeout(completeInitialization, 2000);

  initializeDatabase()
    .then(() => { clearTimeout(timeout); completeInitialization(); })
    .catch(() => { clearTimeout(timeout); completeInitialization(); });

  return () => {
    mounted = false;
    clearTimeout(timeout);
  };
}, []); // Empty deps - run once
```
- StrictMode runs effects 2x in dev
- Use `mounted` flag to prevent state updates after unmount
- Timeout fallbacks for DB/network (max 2s)

### 3. PWA/Offline-First

**Database Initialization:**
```typescript
// Always fail gracefully - app must work offline
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('DB initialized');
  } catch (error) {
    console.error('DB failed:', error);
    // Don't throw - allow app to continue without persistence
  }
}
```

**Service Worker (vite-plugin-pwa):**
- Auto-updates: `registerType: 'autoUpdate'`
- Caches: `js,css,html,ico,png,svg,woff2,wasm`
- Runtime: `CacheFirst` for fonts
- Dev SW enabled (`devOptions.enabled: true`)

### 4. TypeScript Strict Mode

```typescript
// tsconfig.json strict flags ENFORCED
strict: true
noUncheckedIndexedAccess: true  // array[i] returns T | undefined
exactOptionalPropertyTypes: true // optional props can't be undefined
noImplicitReturns: true
```

**Common Fixes:**
```typescript
// ❌ Unchecked array access
const item = array[0].name; // Error if array empty

// ✅ Null-safe access
const item = array[0]?.name ?? 'default';

// ❌ Missing return
function process(x: number) {
  if (x > 0) return x;
  // Error: not all code paths return
}

// ✅ Explicit return
function process(x: number): number {
  return x > 0 ? x : 0;
}
```

### 5. Path Aliases (tsconfig + vite)

```typescript
import { User } from '@/domain/entities/User';
import { db } from '@/data/storage/database';
import { useAuthStore } from '@/presentation/store/authStore';
```

**Structure:**
```
src/
├── core/          # Crypto, auth utilities
├── data/          # Repositories, IndexedDB
├── domain/        # Entities, interfaces
└── presentation/  # React components, stores
    ├── pages/
    ├── store/     # Zustand
    └── theme/
```

### 6. Security Headers

Set via HTTP, NOT meta tags. Defined in `src/config/securityHeaders.ts`, imported by vite.config.ts (`server.headers` + `preview.headers`).
- ❌ Never `<meta http-equiv="X-Frame-Options">` (invalid)
- ❌ Never duplicate headers inline — edit `securityHeaders.ts` only

### 7. PWA Icons Requirements

**Required in `public/`:**
```
pwa-192x192.png          # 192x192 PNG
pwa-512x512.png          # 512x512 PNG
pwa-maskable-192x192.png # 192x192 with safe zone
pwa-maskable-512x512.png # 512x512 with safe zone
apple-touch-icon.png     # 180x180 for iOS
favicon.ico              # 32x32
```
- Valid PNG (not 1x1 placeholders in prod)
- Maskable icons: content in 40% safe zone

### 8. Performance Targets (Lighthouse)

```bash
npm run lighthouse  # After preview server running
```

**Min scores (all >90):**
- Performance: >90 (FCP <1.8s, LCP <2.5s, CLS <0.1)
- Accessibility: >90
- Best Practices: >90
- SEO: >90
- PWA: 100 (installable, offline)

**Optimize:** `manualChunks` (vite.config.ts ~159), `drop_console: true` (prod), lazy-load heavy modules, IndexedDB for offline.

### 9. State Management

**Zustand (not Redux):**
```typescript
// stores use Zustand for simplicity
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
}));
```

**IndexedDB (Dexie):**
```typescript
// Encrypted local storage
export class TrustVaultDB extends Dexie {
  credentials!: Table<StoredCredential, string>;
  users!: Table<StoredUser, string>;
}
```

---

## Troubleshooting

### Loading Spinner Stuck
**Symptom:** Static HTML spinner never replaced
**Cause:** JS module error prevents React mount
**Fix:**
1. Check console for import errors (especially UMD)
2. Verify DB init has timeout fallback (<2s)
3. Use dynamic imports for WASM/crypto

### PWA Icon Errors
**Symptom:** `Download error or resource isn't a valid image`
**Fix:** Valid PNG at required sizes (not 1x1)
```bash
file public/pwa-192x192.png  # Should show: PNG image data, 192 x 192
```

### TypeScript Errors on Build
**Symptom:** `npm run build` fails, dev works
**Fix:** Run `npm run type-check`
- Enable `strict: true`
- Array access: `arr[i]` → `arr[i]?`
- Explicit return types for complex functions

### WASM Loading Fails
**Symptom:** `Could not resolve "a"` in argon2-browser
**Fix:**
- Exclude from `optimizeDeps`
- Lazy dynamic import (see Module Loading Patterns)
- Ensure `vite-plugin-wasm` loads before React plugin

### Service Worker Not Updating
**Symptom:** Old version cached post-deploy
**Fix:**
- `skipWaiting: true` in workbox (already set)
- Hard refresh: Cmd+Shift+R / Ctrl+Shift+R
- Check Application → Service Workers in DevTools

---

## Code Standards Checklist

- [ ] TypeScript strict mode (no `any`, proper null checks)
- [ ] React 19 patterns (mounted flags, cleanup)
- [ ] Lazy-load heavy modules (>100KB, crypto, WASM)
- [ ] Error boundaries for critical sections
- [ ] Offline-first (graceful DB failures, cached UI)
- [ ] Security headers via HTTP (not meta tags)
- [ ] PWA icons valid PNG at required sizes
- [ ] Console logs removed in production (`drop_console: true`)
- [ ] Lighthouse >90 (run before PR merge)
- [ ] Path aliases used (`@/` not `../../`)

---

## Security Notes

**OWASP Mobile Top 10 (M1–M5):**
- M1: Improper Platform Usage → PWA security headers
- M2: Insecure Data Storage → Dexie encryption
- M3: Insecure Communication → CSP, HTTPS only
- M4: Insecure Authentication → Scrypt + WebAuthn
- M5: Insufficient Cryptography → @noble/hashes

**Sensitive Operations:**
- Master password hashing: Scrypt via `@noble/hashes/scrypt` (N=131072, r=8, p=1, dkLen=32). Migrated from Argon2id (CSP/WASM) — see `DATABASE_MIGRATION.md`.
- Vault key derivation: PBKDF2-SHA256 (600,000 iterations, OWASP 2025)
- Key hygiene (S7, 2026-06-10): session vault keys non-extractable both unlock paths; transient material zeroized; biometric enrollment confirms master password (never exports session key).
- CSP (S2, 2026-06-10): strict hash-based — `script-src 'self' 'sha256-…' 'wasm-unsafe-eval'`, no `unsafe-inline`/`unsafe-eval`. Source: `src/config/securityHeaders.ts` (hash drift guard + vercel.json parity). OCR (Tesseract) self-hosted at `public/ocr/` (via `scripts/copy-ocr-assets.js` pre-hooks) — no CDN egress.
- Biometric: WebAuthn platform authenticator + PRF extension (S1). Vault key wrapped with HKDF-SHA256 from PRF output (never stored) → zero-knowledge unlock. Scheme: `vaultKeyScheme: 'prf-v1'`; legacy stripped by DB v7 migration; non-PRF fallback to master password. See `SECURITY.md`.
- Background breach re-checks (P4, 2026-06-10): 5-char SHA-1 prefixes in `breachPrefixes` table (DB v8) — disclosed to HIBP under k-anonymity, residual documented in `SECURITY.md`. `public/sw-periodic-sync.js` (workbox `importScripts`) prefetches ranges into `hibp-ranges` cache while locked; unlock triggers 7-day staleness re-validation cache-first via `src/core/breach/rangeCache.ts`. Offline deep-links use `navigateFallback` (P1); manifest: `id`/`shortcuts`/`launch_handler` (P3, screenshots pending).
- Chrome extension (X1–X3, 2026-06-11): **no secrets at rest** — plaintext `chrome.storage.local` removed (legacy purged on install/update); `GET_CREDENTIALS` empty until secure transport from PWA's encrypted vault, fill path stays inert. Permissions minimal: no `webNavigation`, host limited to TrustVault origins, content script HTTPS-only, dead `web_accessible_resources` removed. Autofill matcher (`src/core/autofill/credentialManagementService.ts`): dot-boundary host-suffix matching + scheme equality — never naive eTLD (`mybank.co.uk` ≠ `evil.co.uk`).
- Multi-vault profiles (Phase 7, 2026-06-18): `vaultProfiles` table (DB v10), one shared master vault key across profiles (Iteration 1 — see `ROADMAP.md` §7.3 for the future per-profile-DEK HKDF plan). Profile `name` encrypted at rest (`encryptedName`); `type`/`accentColor`/`icon`/`isDefault` plaintext. `profileId` lives only on `StoredCredential` (optional, trailing repo-method param) — never on the domain `Credential`/`CredentialInput`, mirroring the existing `userId` convention. Default "Personal" profile created post-login via `ensureDefaultProfile()`, not in the Dexie `.upgrade()` (no vault key available during schema migration).
- On-device AI (2026-06-20, Android backend added 2026-06-21): optional "Explain with AI" — strength explanation (generator/credential forms) and **breach impact analysis** (Breach Details modal). Toggles `enableOnDeviceAI` (master) + `allowStrengthExplanation` + `allowBreachImpactAnalysis` in `src/core/ai/aiSettings.ts` (localStorage), **all default `true`** — safe because inference is **fully local; no data ever leaves the device**, and the model runs only on explicit user action (click "Explain"/expand AI panel), never auto-run. Two inference backends behind a provider abstraction in `src/core/ai/providers/` (`AiProvider` interface, `types.ts`): **Chrome built-in** (`chromeBuiltinProvider.ts`, global `LanguageModel`/Gemini Nano, desktop Chrome only — not exposed on Android/iOS, confirmed via remote DevTools) and **WebLLM** (`webllmProvider.ts`, `@mlc-ai/web-llm`, WebGPU, Android only — gated by `isMobileAiSurfaceEnabled()`/`hasWebGpu()` in `capabilities.ts`). `getActiveProvider()` (`registry.ts`) prefers chrome-builtin when available, else falls back to webllm when WebGPU+Android; `aiAvailability.ts`/`promptApi.ts` delegate through the registry so desktop behavior, prompts, and UI copy are unchanged. WebLLM model weights (catalog in `webllmModels.ts`, 380MB–1.9GB incl. a Tiny 0.5B tier for low-end GPUs) are downloaded **only on explicit opt-in** (Settings → AI Assistance → "On-device AI model (Android)" → "Download model"), never auto-fetched — this is the one new CSP `connect-src` exception (`WEBLLM_MODEL_ORIGINS` in `securityHeaders.ts`, mirrored in `vercel.json`; origins confirmed on-device Task 11 2026-06-21: `huggingface.co`, `*.xethub.hf.co` + `*.aws.cdn.hf.co` HF-Xet weight CDNs, `raw.githubusercontent.com` — legacy `cdn-lfs*` removed). `createEngine()` caps `context_window_size` at 2048 and normalizes WebGPU device-loss (resets engine + clean error). **Android WebLLM surface is currently DISABLED** (`WEBLLM_ANDROID_ENABLED = false` in `capabilities.ts` → `isMobileAiSurfaceEnabled()` returns false) after Task 11 found a **systemic Qualcomm Adreno** `VK_ERROR_DEVICE_LOST` at WebLLM warm-up — reproduced on two Adreno generations (6xx/Android 10 and Adreno 810 / SD 7s Gen 3 / Android 16), both q4f16 **and** q4f32, both 0.5B/1B, latest web-llm; plain WebGPU compute works on the same devices, so it's WebLLM-vs-Adreno, not an app bug. Desktop Gemini-Nano path unaffected; flip the flag back to re-enable once fixed upstream + re-verified. See `TEST_STATUS.md`. A third provider, **LiteRT-LM** (`litert-lm`, `@litert-lm/core`), was added 2026-06-21 behind its own `LITERT_ANDROID_ENABLED` kill-switch (on by default) to A/B test whether Google's actively-supported runtime survives the same Adreno failure — it shares the WebGPU/Dawn stack implicated in WebLLM's crash, so this is an open question pending on-device verification (see `TEST_STATUS.md`). Its WASM runtime is self-hosted under `public/litert/` (`scripts/copy-litert-assets.js`) rather than the package's default `cdn.jsdelivr.net` fetch, to avoid a new CDN-egress CSP exception. Settings gains a LiteRT-LM/WebLLM picker, hidden unless both engines are enabled. The `@mlc-ai/web-llm` library is lazy-imported only inside `createEngine()`, excluded from `optimizeDeps`, and isolated into its own `webllm-vendor` chunk excluded from the service worker's precache manifest (`vite.config.ts`) — never loaded or bundled on desktop. Strength prompt sends only label + rounded entropy; breach prompt sends public breach data + non-secret credential metadata (title/username/category/age) — **never** password/secret notes/keys, on either backend. AI treated as outside the app's ZK boundary (decrypted plaintext to browser runtime), no prompt/response logged or persisted, session destroyed after each call. `AiAssistanceSettings.tsx` disables the master toggle (and sub-toggles) when `getAiAvailability()` is `'unavailable'` so the feature can't be enabled where it can never run. See `SECURITY.md` §On-Device AI Boundary.
- Chat follow-up + general assistant (2026-06-22): the strength-explainer and breach-impact panels became multi-turn — a new `ChatSession` abstraction (per-provider: native multi-turn session on chrome-builtin/litert-lm, trimmed-transcript replay via `chatTrim.ts` on WebLLM) backs `useAiChat` (`src/presentation/hooks/useAiChat.ts`), exposing `{ enabled, messages, streaming, error, send, stop, retry, reset }` to a shared `ChatPanel` UI used by `PasswordStrengthIndicator.tsx`, `BreachDetailsModal.tsx`, and a new standalone `GeneralAssistant.tsx` (dashboard toolbar entry point, `ChatScope` picker: stateless/curated/per-credential, switching scope calls `chat.reset()` first). All app-constructed context (strength label, breach metadata, vault summary, per-credential metadata) passes through one `assertNoSecrets()` chokepoint (`src/core/ai/chat/chatContext.ts`) before reaching any provider; the user's own free-text follow-up turns are trusted and never content-inspected. Three new settings in `aiSettings.ts` — `allowChatFollowUp`, `enableGeneralAssistant`, `generalAssistantDefaultScope` — **all default `true`/`stateless`**. Chat history is ephemeral/RAM-only: destroyed on panel close, vault lock, logout, or unmount, never persisted. Desktop-only in practice — Android WebLLM stays kill-switched (`WEBLLM_ANDROID_ENABLED = false`), so this inherits the same Adreno-blocked reach as the one-shot explainers. See `SECURITY.md` §Chat follow-up + standalone general assistant.
- Chrome built-in AI alignment (2026-06-24): hardened the chrome-builtin provider to the stable June 2026 Prompt API — `AiProvider.supports(cap)` capability gate (`'structured' | 'params' | 'quota' | 'languages'`), sampling `params`, `expectedInputs`/`expectedOutputs` language hints, `measureInputUsage`/`inputQuota` — then layered four **Chrome-only, hard-gated** extensions on top: (1) **structured insight cards** — `runStructured()` (`responseConstraint` + JSON Schema) powers `explainStrengthStructured()`/`explainBreachImpactStructured()`, rendered as `StrengthInsightCard`/`BreachInsightCard` above the existing free-text chat (chat turns stay free-text; schemas carry only non-secret fields like severity/risk-level/ranked actions); (2) **Summarizer-backed vault overview** — `summarizeVaultOverview()` (`src/core/ai/summarizer.ts`) wraps the standalone Summarizer API with a formatted-text fallback; (3) **multilingual output** — `resolveAiLanguage()` (`src/core/ai/aiLanguages.ts`) maps browser locale to a Gemini-Nano-supported language (en/es/ja/de/fr), else falls back to English; (4) **quota-aware chat** — `checkChatUsage()` (`chatTrim.ts`) reads `ChatSession.measureUsage()` to warn in `ChatPanel` before the context fills. WebLLM/LiteRT report `supports() === false` for every new capability, so Android is untouched and falls back to pre-existing behavior automatically. No new network egress or CSP exception. See `SECURITY.md` §Chrome built-in AI alignment.

---

**Last Updated:** 2026-06-24 (On-device AI: hardened the **Chrome built-in AI** provider to the stable June 2026 Prompt API surface (capability gate, sampling params, language hints, quota seam) and added four Chrome-only extensions — structured insight cards above the existing chat, Summarizer-backed vault overview, multilingual output, quota-aware chat warning — all hard-gated behind `AiProvider.supports()` so WebLLM/LiteRT-LM on Android are unaffected; prev: added multi-turn **chat follow-up** to the strength/breach explain panels plus a standalone **general assistant** entry point on the dashboard — new `ChatSession` abstraction (native session on chrome-builtin/litert-lm, trimmed-transcript replay on WebLLM), shared `useAiChat`/`ChatPanel`, single `assertNoSecrets` chokepoint for app-constructed context, three new settings (`allowChatFollowUp`/`enableGeneralAssistant`/`generalAssistantDefaultScope`, default on/stateless), ephemeral RAM-only history, desktop-only in practice pending the Android WebLLM kill-switch; prev: added **LiteRT-LM** (`@litert-lm/core`) as a third provider behind its own `LITERT_ANDROID_ENABLED` kill-switch (on by default) to A/B test against WebLLM's Adreno failure — WASM runtime self-hosted under `public/litert/`, model weights reuse the existing HF CSP allowlist, Settings gains a LiteRT-LM/WebLLM picker (hidden unless both engines enabled), on-device verification still pending; prev: Task 11 Android verification across 2 devices — **WebLLM Android surface DISABLED** (kill-switch) due to systemic Qualcomm Adreno `VK_ERROR_DEVICE_LOST` at warm-up (both precisions/sizes); desktop Gemini-Nano unaffected; kept CSP-origin reconciliation to HF-Xet CDNs, `context_window_size` cap + device-loss handling for the re-enable path; prev: added WebLLM/WebGPU provider for Android behind a provider abstraction, desktop Gemini-Nano path unchanged; settings disable AI toggles on platforms without `LanguageModel` support, breach impact analysis, AI strength-explain, Phase 7 multi-vault profiles)
**Node:** ≥20.0.0 | **NPM:** ≥10.0.0

## graphify

Knowledge graph at graphify-out/ with god nodes, community structure, cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before source files, grep/glob, or codebase questions. Graph is primary map.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of raw files
- Cross-module "how does X relate to Y": prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — traverses EXTRACTED + INFERRED edges
- After code changes, run `graphify update .` to keep current (AST-only, no API cost)