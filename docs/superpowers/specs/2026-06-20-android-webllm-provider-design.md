# Android On-Device AI via WebLLM — Provider Abstraction Design

**Date:** 2026-06-20
**Status:** Draft (pending user review)
**Author:** Brainstormed with Claude Code
**Related:** `2026-06-20-ondevice-ai-breach-impact-design.md`, `SECURITY.md` §On-Device AI Boundary, `CLAUDE.md` On-device AI note

---

## 1. Context & Goal

TrustVault's on-device AI ("Explain with AI" — password-strength explanation + breach-impact analysis) runs only via Chrome's built-in `LanguageModel` (Gemini Nano), which is **desktop-only**. Confirmed on an Android device via remote DevTools: `typeof LanguageModel === 'undefined'`, so `getAiAvailability()` resolves `'unavailable'` and both features silently disappear. This is a platform limitation, not a defect (see `SECURITY_AUDIT_REPORT.md` AI2).

**Goal:** Bring the *same two features* to Android by adding a second, fully-local inference backend — **WebLLM** (MLC, WebGPU-accelerated) — behind a clean provider abstraction, without changing desktop behavior and without weakening the zero-knowledge data boundary.

**Non-goal (this spec):** LiteRT-LM integration and iOS enablement are explicitly deferred (see §13). The abstraction is designed so they slot in later without rework.

---

## 2. Scope

**In scope**
- A provider abstraction (`AiProvider`) generalizing the current `promptApi.ts`.
- `chromeBuiltinProvider` — the existing logic, refactored behind the interface (desktop unchanged).
- `webllmProvider` — new WebGPU backend using WebLLM's `MLCEngine`.
- Capability-based provider selection, **surfaced only on Android for v1**.
- Settings-driven, explicit, one-time model download with a configurable model size (small default / mid option).
- CSP, build, and service-worker changes required for the WebLLM CDN + runtime.

**Out of scope**
- LiteRT-LM provider (future; interface-ready).
- iOS surfacing (capability gate stays honest; UI feature-flagged off).
- Any change to the prompts themselves (`strengthExplain.ts`, `breachImpactExplain.ts` are reused verbatim).
- Self-hosting model weights (decision: third-party CDN, opt-in — see §5).

---

## 3. Architecture — Provider Abstraction

Today `promptApi.ts` is documented as "THE ONLY module that calls `create()`/`promptStreaming()`." We generalize that single responsibility into an interface so the inference backend is swappable; feature modules and hooks keep their current shape.

```ts
// src/core/ai/providers/types.ts
export type AiProviderId = 'chrome-builtin' | 'webllm';

export interface AiDownloadProgress {
  loaded: number;       // bytes or 0..1 fraction (normalized to 0..1)
  total?: number;
  text?: string;        // human label, e.g. "Fetching weights 42%"
}

export interface AiProvider {
  readonly id: AiProviderId;
  /** Cheap, read-only capability probe. Never triggers a download. */
  getAvailability(): Promise<AiAvailability>;   // reuse existing union
  /** Ensure the model is usable. No-op for chrome-builtin; downloads for webllm. */
  ensureReady(onProgress?: (p: AiDownloadProgress) => void): Promise<void>;
  /** Prime a base session for a system prompt (latency optimization). */
  warmUp(systemPrompt: string): Promise<void>;
  /** Stream a completion. */
  runStreaming(args: { systemPrompt: string; userPrompt: string; signal?: AbortSignal }):
    AsyncIterableIterator<string>;
}
```

**Registry / selection** (`src/core/ai/providers/registry.ts`):
- Prefer `chrome-builtin` when its `getAvailability()` is `'available'`.
- Else select `webllm` when WebGPU is present (`'gpu' in navigator`) **and** the platform is enabled for v1 (Android, behind a feature flag).
- Else no active provider → features stay disabled (current degrade-silently behavior preserved).

`promptApi.ts` keeps `runPromptStreaming` / `runPrompt` / `warmUpAi` signatures but delegates to `registry.active()`. **Feature modules (`strengthExplain.ts`, `breachImpactExplain.ts`) and the hooks are not modified** beyond the availability/readiness signal already threaded through `useAiStrengthExplain` / `useAiBreachImpactExplain`.

**Design rationale:** preserves the existing "one module owns inference" invariant; both existing features light up on Android for free because they route through the same path; desktop path is byte-for-byte the current code, just relocated.

---

## 4. Module / File Layout

```
src/core/ai/
├── aiTypes.ts                         # + AiProvider types (or new providers/types.ts)
├── aiAvailability.ts                  # becomes a thin facade over registry.active().getAvailability()
├── promptApi.ts                       # delegates to registry; keeps public API
├── providers/
│   ├── types.ts                       # AiProvider, AiProviderId, AiDownloadProgress
│   ├── registry.ts                    # selection + caching of the active provider
│   ├── chromeBuiltinProvider.ts       # current promptApi internals (warm-up/clone cache)
│   └── webllmProvider.ts              # MLCEngine wrapper (lazy dynamic import)
├── webllmModels.ts                    # model catalog (small default + mid), model_id mapping
├── strengthExplain.ts                 # unchanged
└── breachImpactExplain.ts             # unchanged

src/core/ai/aiSettings.ts             # + webLlmModelId, mobileAiDownloaded flags
src/presentation/components/AiAssistanceSettings.tsx   # + download UI, model picker
src/presentation/hooks/
├── useAiStrengthExplain.ts            # unchanged public API
└── useAiBreachImpactExplain.ts        # unchanged public API
```

WebLLM is a **lazy dynamic import** inside `webllmProvider.ts` (never top-level), per the CLAUDE.md "heavy WASM/UMD → lazy dynamic import + exclude from optimizeDeps" rule, mirroring how Tesseract is loaded.

---

## 5. WebLLM Provider Details

- **Engine:** `@mlc-ai/web-llm` `MLCEngine`, created via `CreateMLCEngine(modelId, { initProgressCallback })`.
- **Weights source:** WebLLM's default prebuilt model URLs (Hugging Face / MLC CDN). Opt-in; see §6 and §8 for CSP/consent.
- **Model catalog** (`webllmModels.ts`), configurable in Settings:
  - *Small (default):* a ~0.5–1.5B 4-bit instruct model (e.g. `Llama-3.2-1B-Instruct-q4f16_1-MLC` or `Qwen2.5-1.5B-Instruct-q4f16_1-MLC`) — ~0.3–0.8 GB, 4 GB-RAM floor.
  - *Mid:* a ~2–3B 4-bit model (e.g. `gemma-2-2b-it-q4f16_1-MLC`) — ~1.3–2 GB, higher-end devices.
  - Exact `model_id` strings pinned to the installed `@mlc-ai/web-llm` version's prebuilt list at implementation time.
- **System/user prompts:** mapped to WebLLM chat messages `[{role:'system'}, {role:'user'}]` — same two-message shape `chromeBuiltinProvider` already uses.
- **Streaming:** `engine.chat.completions.create({ stream: true, ... })`; yield `choices[0].delta.content`. `AbortSignal` wired to WebLLM's interrupt (`engine.interruptGenerate()` on abort).
- **Warm-up/clone:** WebLLM holds one engine per loaded model; we keep a single engine instance per `model_id` (analogous to the base-session cache). No per-call clone needed — instead we reset chat state between calls (`engine.resetChat()`) to preserve the "clean context per call" property that the desktop clone provides.
- **Storage:** WebLLM caches weights in the Cache API / IndexedDB itself. On `ensureReady`, request persistent storage (`navigator.storage.persist()`) to reduce eviction risk.

---

## 6. Settings UX & Download Flow

Per decision: **Settings-only activation**, **configurable model**.

In `AiAssistanceSettings.tsx`, when the active provider is `webllm` (Android v1):
1. The existing master/sub-toggles remain, but a new block appears: **"On-device AI model (Android)"** with:
   - A model picker (Small / Mid) with size disclosure per option.
   - A primary action: **"Download model (~X MB)"** with an explicit note: *"Downloads once from a third-party AI CDN. After download, all analysis runs locally on your device — your data never leaves it."*
   - A determinate progress bar bound to `ensureReady`'s `initProgressCallback`.
   - After success: status "Model ready (Small)", plus a "Remove model" action (clears the WebLLM cache).
2. The breach-impact accordion and strength-explain button stay **inert until the model is downloaded** — same `ai.enabled` gating; `enabled` now requires `provider.getAvailability() === 'available'`, which for `webllm` means "weights cached."
3. Desktop (chrome-builtin) Settings UI is unchanged.

New persisted settings (`aiSettings.ts`, localStorage):
- `webLlmModelId: string` (default = small model id)
- `mobileAiModelReady: boolean` (mirror of cache state for fast UI; verified against actual cache on load)

---

## 7. Data Flow

```
User opens Breach Details modal (Android, model downloaded)
  → useAiBreachImpactExplain effect: loadAiSettings() gates → registry.active() = webllmProvider
  → getAvailability() === 'available' (weights cached) → enabled = true → warmUp(BREACH_SYSTEM_PROMPT)
  → user expands AI accordion → analyze()
    → explainBreachImpact(input, signal)         [unchanged]
      → buildBreachPrompt(input)                 [unchanged, secret-free invariant]
      → runPromptStreaming({system,user,signal}) [promptApi → registry.active().runStreaming]
        → webllmProvider: engine.resetChat(); stream deltas
  → tokens stream into the accordion (whiteSpace: pre-line), abort on close/re-analyze
```

The desktop flow is identical except `registry.active()` resolves to `chromeBuiltinProvider` and `ensureReady`/download UI never appear.

---

## 8. CSP / Build / Service Worker Changes

**CSP (must update BOTH sources — parity is enforced):**
- [src/config/securityHeaders.ts](src/config/securityHeaders.ts): add the WebLLM weight CDN origin(s) to `connect-src` (e.g. `https://huggingface.co`, `https://cdn-lfs*.huggingface.co` / MLC origin — pinned to the actual hosts `@mlc-ai/web-llm` requests). WASM compile already covered by `'wasm-unsafe-eval'`.
- [vercel.json](vercel.json): mirror the identical `connect-src` additions (production parity).
- Document the egress exception in `SECURITY.md` §On-Device AI Boundary as a *weight-download-only* exception (no user data; one-time per device/model).

**Build:**
- `@mlc-ai/web-llm` added as a dependency; **lazy dynamic import only**, excluded from `optimizeDeps` in `vite.config.ts` (mirrors the WASM exclusion convention).
- No `copy-*-assets` script needed: weights come from the CDN (not `public/`), and the WebLLM runtime is bundled as a lazy chunk. (If we later self-host the runtime WASM, add a `copy-webllm-assets.js` predev/prebuild hook mirroring `copy-ocr-assets.js`.)
- `manualChunks`: leave WebLLM to its own lazy chunk (do **not** add to the vendor chunk allowlist) so it never loads on desktop.

**Service Worker (`vite.config.ts` workbox):**
- Weights are CDN-hosted and cached by WebLLM's own Cache API usage — **do not add a workbox `runtimeCaching` rule** for the CDN (avoid double-caching multi-hundred-MB blobs and SW quota pressure). Confirm the CDN origin isn't swept by `navigateFallback` (it won't be — cross-origin).
- If the WebLLM runtime ends up emitted under a path that matches `globPatterns` and is large, add a `globIgnores` entry mirroring `'**/ocr/**'`.

---

## 9. Error Handling & Eviction

- **No WebGPU:** `getAvailability()` → `'unavailable'`; features stay hidden; Settings shows "Not supported on this device/browser."
- **Download failure / interruption:** `ensureReady` rejects → Settings shows an error with Retry; `mobileAiModelReady` stays false. Partial caches handled by WebLLM; a "Remove model" action clears state.
- **Eviction (storage reclaimed):** on next `getAvailability()`/`ensureReady`, a missing cache is detected → status reverts to "not downloaded," prompting re-download rather than failing mid-inference. `navigator.storage.persist()` requested to minimize this.
- **Inference error / abort:** identical to today — breach accordion shows the error Alert + Retry; strength button degrades silently. `AbortSignal` → `interruptGenerate()`.
- **OOM on low-RAM device:** caught as an inference error; surface a one-time hint suggesting the Small model if Mid was selected.

---

## 10. Security & Privacy Posture

- **Zero-knowledge boundary unchanged:** prompts are still built by the unchanged secret-free builders; the same "never sent" list applies (passwords, keys, notes, TOTP). The leak tests on `buildBreachPrompt`/`buildStrengthPrompt` still guard this.
- **Inference is fully local:** WebLLM runs entirely in-browser via WebGPU; no prompt/response leaves the device — same property as desktop Gemini Nano.
- **New, bounded egress:** exactly one class of network call is added — **model weight download** from the AI CDN, one time per device/model, containing **no user data**. This is the only relaxation of the "no CDN egress" posture and is documented as such.
- **No logging/persistence** of prompts or responses (unchanged). `resetChat()` between calls preserves clean-context isolation across credentials.

---

## 11. Testing Strategy

- **Provider interface conformance:** a shared test suite run against a `fakeProvider` and (mocked) both real providers — `getAvailability`, `ensureReady` idempotency, `runStreaming` concatenation + abort + `destroy`/reset.
- **registry selection:** chrome-preferred-when-available; webllm-when-WebGPU-and-flagged; none otherwise. Pure unit tests with stubbed capability probes.
- **chromeBuiltinProvider:** existing `promptApi.test.ts` assertions migrate here unchanged (warm-up dedup, clone, fallback) — proves no desktop regression.
- **webllmProvider:** mock `@mlc-ai/web-llm` (`CreateMLCEngine`, streaming, `interruptGenerate`, `resetChat`); assert prompt→message mapping, streaming, abort, and `ensureReady` progress propagation. No real weights in tests.
- **Settings UI:** model picker persists; download action calls `ensureReady` and reflects progress/success/error; toggles gate correctly; desktop view unchanged.
- **No network in tests:** all CDN/WebGPU/engine calls mocked. Vitest + Testing Library, matching existing AI test conventions.

---

## 12. Validation Against Codebase Architecture & Best Practices

Each design decision cross-checked against the current codebase:

| # | Design decision | Aligned pattern in codebase | Verdict |
|---|---|---|---|
| 1 | Provider interface generalizing `promptApi.ts` | `promptApi.ts` already declared "the only module that calls create()/promptStreaming()" — interface formalizes the existing single-responsibility boundary | ✅ Strengthens existing invariant |
| 2 | Reuse `AiAvailability` union for provider probe | `aiTypes.ts` already exports `'available'｜'downloadable'｜'downloading'｜'unavailable'` | ✅ No new vocabulary |
| 3 | Lazy dynamic import of WebLLM, excluded from `optimizeDeps` | CLAUDE.md Rule 1 (heavy WASM/UMD), Tesseract precedent | ✅ Direct precedent |
| 4 | Settings in `aiSettings.ts` localStorage, not Zustand | `aiSettings.ts` header: "localStorage module — mirrors autofillSettings.ts. No Zustand." | ✅ Matches convention |
| 5 | Capability gate + feature-flag UI surface | mirrors the just-shipped `availability === 'unavailable'` disabling in `AiAssistanceSettings.tsx` | ✅ Consistent |
| 6 | CSP `connect-src` change in BOTH securityHeaders.ts + vercel.json | CLAUDE.md S2: "hash drift guard + vercel.json parity"; confirmed both files carry CSP | ⚠️ Must update both or break parity |
| 7 | Don't precache weights; rely on WebLLM Cache API | OCR uses `globIgnores: ['**/ocr/**']` + runtime CacheFirst; weights are cross-origin so already excluded | ✅ Consistent intent |
| 8 | Clean-context per call via `resetChat()` | preserves the clone-from-pristine-base property in `chromeBuiltinProvider` | ✅ Parity of security property |
| 9 | Secret-free prompts unchanged | `buildBreachPrompt`/`buildStrengthPrompt` + leak tests untouched | ✅ ZK boundary intact |
| 10 | Streaming + AbortSignal | existing `runPromptStreaming` + hooks' AbortController already stream/abort | ✅ Same shape |
| 11 | React 19 effect hygiene (mounted flag, cleanup) for download progress | CLAUDE.md Rule 2; existing hooks use `mounted` + abort cleanup | ✅ Apply same pattern |
| 12 | TS strict (no `any`, null-safe) for engine wrapper | tsconfig strict + `noUncheckedIndexedAccess`; existing code casts globals carefully | ✅ Wrapper must type the dynamic import surface |
| 13 | `drop_console: true` in prod | terser config present; providers must not rely on console | ✅ No sensitive logs |

**Best-practice notes / risks surfaced by validation:**
- **(R1) CSP parity is the highest-risk step.** A drift between `securityHeaders.ts` and `vercel.json` would either silently block weight download in prod (CSP too strict) or pass dev but fail prod. Add a test/assert that the two CSP strings' `connect-src` lists match, extending the existing parity guard.
- **(R2) Posture shift must be loud in docs.** Adding *any* CDN egress contradicts the current "no CDN egress" claim (OCR was deliberately self-hosted to avoid exactly this). The weight-download exception must be explicitly documented in `SECURITY.md`/`CLAUDE.md`, scoped to "weights only, no user data," so the posture statement stays truthful.
- **(R3) SW quota.** Multi-hundred-MB weights in Cache API can pressure the PWA storage budget shared with the encrypted vault and OCR caches. Validation: request persistent storage; do not double-cache via workbox; expose "Remove model."
- **(R4) Desktop must be provably untouched.** The chrome-builtin provider is a pure relocation; the migrated `promptApi.test.ts` suite is the regression proof. No desktop bundle should pull in `@mlc-ai/web-llm` (verify via chunk inspection).
- **(R5) iOS deferral is correct.** iOS Safari WebGPU exists only on iOS 26, and Safari's 7-day script-writable-storage eviction makes a low-frequency feature's weights prone to re-download — validated against the storage research; keeping iOS UI flagged off is the right call.

---

## 13. Future Work (interface-ready, out of scope here)

- **LiteRT-LM provider:** Google's actively-supported successor to MediaPipe LLM Inference (which is maintenance-only). Implements the same `AiProvider` interface; registry gains a third id and a selection preference (e.g. prefer LiteRT-LM over WebLLM when both viable). No feature/hook changes.
- **iOS surfacing:** flip the feature flag once iOS-26 WebGPU + storage-persistence behavior is validated on-device; add the metered-connection caveat.
- **Self-hosting weights:** if the CDN-egress exception proves unacceptable, add a `copy-webllm-assets`-style pipeline + same-origin hosting (revisits R2 at the cost of deploy size).

---

## 14. Rollout

1. Provider abstraction + chrome-builtin relocation (no behavior change; full test parity).
2. WebLLM provider + model catalog + Settings download UI (Android-flagged).
3. CSP/build/SW changes with parity guard.
4. Docs: `SECURITY.md`, `CLAUDE.md`, `SECURITY_AUDIT_REPORT.md` (AI3 patch note).
5. On-device Android verification (remote DevTools): availability → download → both features stream locally.
