# LiteRT-LM Web Provider — Design Spec

**Date:** 2026-06-21
**Status:** Approved design — amended with package-verified API facts during plan-writing
**Author:** Brainstorm session (Claude + ianpinto)
**Related:** [webllm-adreno-issue.md](../../../webllm-adreno-issue.md), `CLAUDE.md` §On-device AI, `SECURITY.md` §On-Device AI Boundary

> **2026-06-21 amendment:** §2 and §3 below were rewritten after downloading and
> inspecting the actual published `@litert-lm/core@0.13.1` tarball (`.d.ts` +
> compiled `.js`), not just the official docs. Two facts the docs omitted
> materially change the design:
> 1. `Engine.create()` triggers a **separate WASM bootstrap step**
>    (`getOrLoadGlobalLiteRtLm()`) that, left to its default, fetches a
>    **37MB WASM runtime from `https://cdn.jsdelivr.net`** — a third-party CDN
>    never mentioned in any doc, and one the project does not currently
>    allowlist. This must be self-hosted (mirroring the existing Tesseract OCR
>    pattern), not given a new CSP exception.
> 2. There is **no documented progress callback**, but `EngineSettings.model`
>    accepts a `ReadableStream<Uint8Array>` — so progress is implemented by
>    fetching the model ourselves and wrapping the response body.
> The rest of the goal/scope/security sections below are unchanged.

---

## 1. Goal

Add **LiteRT-LM** (`@litert-lm/core`) as a third browser-based on-device AI inference backend, behind the existing `AiProvider` abstraction, so it can be **A/B-compared against WebLLM on real Qualcomm Adreno hardware**.

WebLLM's Android surface is currently disabled (`WEBLLM_ANDROID_ENABLED = false`) after a systemic Adreno `VK_ERROR_DEVICE_LOST` at warm-up (see [webllm-adreno-issue.md](../../../webllm-adreno-issue.md)). LiteRT-LM is Google's actively-supported successor to the now maintenance-only MediaPipe LLM Inference API. The purpose of this work is to **empirically determine whether LiteRT-LM's WebGPU kernels survive Adreno where WebLLM's did not** — not to assume they do.

### Honest framing (do not lose this in implementation)

- LiteRT-LM **web** runs on the **same WebGPU/Dawn stack** that crashes Adreno. The root cause is a Qualcomm-Vulkan-via-Dawn driver issue, not a WebLLM-specific bug. LiteRT-LM may inherit the identical crash. Its kernels differ (Google ships LiteRT-LM inside Chrome — that is literally our desktop `chrome-builtin`/Gemini-Nano path), so it *might* sidestep the failing shader pattern. **This is an empirical unknown the A/B test exists to resolve.**
- Google labels the LiteRT-LM **Web/JS target "🚀 Early Preview"** — below the stable Android (Kotlin) / Python / C++ tiers. It must stay behind the kill-switch and is not exposed where it cannot run.
- A genuine Adreno fix (native NPU/GPU delegates bypassing Dawn) lives in LiteRT-LM's **native Android** runtime and would require a native shell (TWA/Capacitor). **That is explicitly out of scope here** — this remains a pure PWA change.

### Reference sources (official)

- LiteRT-LM JS guide — `https://developers.google.com/edge/litert-lm/js`
- LiteRT-LM overview — `https://developers.google.com/edge/litert-lm`
- MediaPipe → LiteRT-LM migration (Web) — `https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/web_js`
- Repo — `https://github.com/google-ai-edge/LiteRT-LM`

---

## 2. Verified API surface

Confirmed by downloading `@litert-lm/core@0.13.1` (`npm pack`) and reading its
`.d.ts` + compiled `.js` directly — **not** inferred from docs.

```ts
// Package: @litert-lm/core  (npm, published; deps on @litertjs/wasm-utils)
import { loadLiteRtLm, Engine, Backend } from '@litert-lm/core';

// Step 1 — bootstrap the WASM module ONCE, pointed at our self-hosted copy
// (see §3 — never the package default, which is jsdelivr).
await loadLiteRtLm('/litert/litertlm_wasm_internal.js');

// Step 2 — create the engine. `model` accepts a URL string OR a
// ReadableStream<Uint8Array> (used below for progress reporting).
const engine = await Engine.create({
  model: modelUrlOrStream,
  // backend defaults to Backend.GPU_ARTISAN when omitted — leave unset.
});

// Step 3 — conversation, mirrors WebLLM's system-prompt priming.
const conversation = await engine.createConversation({
  preface: { messages: [{ role: 'system', content: SYSTEM_PROMPT }] },
});

// Step 4 — streaming generation. IMPORTANT: this returns a
// ReadableStream<Message>, NOT an async-iterable/generator. Consume with
// `.getReader()`, not `for await`.
const stream = conversation.sendMessageStreaming(userPrompt);
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // value: Message { role, content?: string | MessageContentItem[] }
  const items = Array.isArray(value.content) ? value.content : [];
  for (const item of items) {
    if (item.type === 'text' && item.text) { /* yield item.text */ }
  }
}

// Step 5 — abort. A real `cancel()` method exists (no signal plumbing needed
// beyond calling it from an `abort` listener, exactly like WebLLM's
// `interruptGenerate()`).
conversation.cancel();

// Step 6 — dispose (mirrors WebLLM's `engine.unload()`).
await conversation.delete();
await engine.delete();
```

- **Models:** `.litertlm` (`-Web` variants) hosted on HuggingFace (`huggingface.co/.../resolve/...`), weight bytes served via HF-Xet CDN — the **same hosts already in `WEBLLM_MODEL_ORIGINS`**. No new `connect-src` origin for model weights.
- **WebGPU required**, backend selection (`Backend.GPU` / `GPU_ARTISAN` / `CPU` / `NPU`) is internal; `Engine.create()` calls `setupDefaultWebGpuDevice()` for us automatically when the backend is GPU-family — **we never call it directly**.
- **`Message.content`** can be `string | MessageContentItem[]` — code must check `Array.isArray` before iterating (the docs' "always an array" framing was wrong).

### Two real implementation requirements (not docs gaps — confirmed in the compiled source)

| Requirement | Detail | Plan |
|---|---|---|
| **WASM runtime must be self-hosted** | `Engine.create()` internally calls `getOrLoadGlobalLiteRtLm()`, which — unless `loadLiteRtLm()` was already called with an explicit path — defaults to `LiteRtLm.DEFAULT_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@litert-lm/core@0.13.1/wasm'`. This is a **third-party CDN** the project does not allowlist and that conflicts with the established "no CDN egress for runtime assets" convention (Tesseract OCR is self-hosted for exactly this reason). **The provider must call `loadLiteRtLm('/litert/...')` itself, once, before any `Engine.create()` call**, pointed at a same-origin copy of the package's `wasm/` directory (37MB: `litertlm_wasm_internal.{js,wasm}` + `_compat_internal` variants), copied into `public/litert/` by a new build script mirroring `scripts/copy-ocr-assets.js`. **No new CSP origin is added for the WASM runtime** (same-origin, like OCR). |
| **No documented download-progress callback** | `EngineSettings.model` accepts `string \| ReadableStream<Uint8Array>`. If given a string, the library does its own uninstrumented `fetch()`. To get progress, the provider must `fetch()` the model URL itself, read `Content-Length`, and wrap `response.body` in a `TransformStream` that reports cumulative bytes via `onProgress`, then pass the wrapped stream as `model`. | Implemented in Task 3 below — this is real progress, not an indeterminate stub. |

`conversation.cancel()` resolves the abort question definitively — it is **not** a gap; WebLLM's `interruptGenerate()` has a direct LiteRT equivalent.

---

## 3. Architecture

Drop-in third `AiProvider`. Mirrors `webllmProvider.ts` in structure, lifecycle, and error handling. WebLLM stays fully intact as the A/B control; LiteRT is purely additive. Desktop Gemini-Nano (`chrome-builtin`) path is untouched.

### Files to create

1. **`src/core/ai/providers/litertProvider.ts`** — implements `AiProvider`, `id: 'litert-lm'`.
   - `import('@litert-lm/core')` **lazy**, inside `createEngine()` only (never top-level; never on desktop).
   - Module-level singleton engine + `initPromise` guard (mirror webllm: `engine`, `engineModelId`, `initPromise`, `__resetLitertEngineForTesting()`).
   - Fresh conversation per `runStreaming` call (mirrors WebLLM `resetChat` / Chrome clone-per-call — no cross-call state leakage).
   - **Reuse the device-loss normalization**: same `isDeviceLostError()` predicate + `DEVICE_UNAVAILABLE_MESSAGE` so Adreno failures surface one clean error and reset the engine, instead of a console cascade. Extract the shared helper to avoid duplication (see §3.3).
   - `getAvailability()`: `unavailable` if no WebGPU; else `available` if `litertModelReady`, else `downloadable`.

2. **`src/core/ai/litertModels.ts`** — parallel catalog of `.litertlm` HF model URLs + tiers (mirrors `webllmModels.ts`): `LitertModel { id, label, tier, url, approxMB }`, `LITERT_MODELS`, `DEFAULT_LITERT_MODEL_ID`, `getLitertModelById()`. Seed with small Gemma `-Web.litertlm` variants (e.g. `gemma-3n-E2B-it`). Keep the lightest tier first for best low-end-GPU compatibility (same rationale as the WebLLM Tiny tier).

2a. **`scripts/copy-litert-assets.js`** — copies `node_modules/@litert-lm/core/wasm/{litertlm_wasm_internal.js,litertlm_wasm_internal.wasm,litertlm_wasm_compat_internal.js,litertlm_wasm_compat_internal.wasm}` into `public/litert/` (mirrors `copy-ocr-assets.js` exactly: same up-to-date check, same exit-code-on-missing behavior). Wired into `predev`/`prebuild`/`prebuild:deploy`/`prepreview` in `package.json` alongside the existing `ocr:assets` calls. `public/litert/` added to `.gitignore` (mirrors `public/ocr/`).

### Files to modify

3. **`src/core/ai/providers/types.ts`** — `AiProviderId` gains `'litert-lm'` → `'chrome-builtin' | 'webllm' | 'litert-lm'`. (`AiProvider` interface itself unchanged — that is the whole point of the abstraction.)

4. **`src/core/ai/providers/capabilities.ts`** — add an **independent** `LITERT_ANDROID_ENABLED` flag, separate from `WEBLLM_ANDROID_ENABLED`, so LiteRT can be enabled while WebLLM stays off. Generalize:
   ```ts
   const WEBLLM_ANDROID_ENABLED = false; // unchanged kill-switch
   const LITERT_ANDROID_ENABLED  = true; // new — enable LiteRT A/B surface
   export function isMobileAiSurfaceEnabled(): boolean {
     return isAndroid() && (WEBLLM_ANDROID_ENABLED || LITERT_ANDROID_ENABLED);
   }
   export function isWebllmEnabled(): boolean { return WEBLLM_ANDROID_ENABLED; }
   export function isLitertEnabled(): boolean { return LITERT_ANDROID_ENABLED; }
   ```
   `hasWebGpu()` / `isAndroid()` stay platform-honest and unchanged.

5. **`src/core/ai/providers/registry.ts`** — selection order:
   - `chrome-builtin` first if available (desktop — unchanged).
   - Else, on Android with WebGPU and surface enabled: pick the engine named by the new `mobileInferenceEngine` setting (default `'litert-lm'`), **restricted to engines whose flag is enabled** (if the chosen engine's flag is off, fall back to the other enabled engine; if none enabled, `null`).
   - Keep existing `override` / `cached` test seams.

6. **`src/core/ai/aiSettings.ts`** — add:
   - `mobileInferenceEngine: 'litert-lm' | 'webllm'` (default `'litert-lm'` — per chosen preference order).
   - `litertModelReady: boolean` (default `false`) — **separate** from `mobileAiModelReady`; downloads are per-engine.
   - `litertModelId: string` (default `DEFAULT_LITERT_MODEL_ID`).
   - Existing WebLLM settings unchanged.

7. **`src/presentation/components/AiAssistanceSettings.tsx`** — under the Android on-device section:
   - A **backend picker** (`LiteRT-LM (recommended)` / `WebLLM`), shown only on Android and only when **more than one** mobile engine flag is enabled (so it stays hidden in the common case). Writes `mobileInferenceEngine`.
   - Per-engine **download/remove control** bound to the selected engine's ready flag.
   - Entire section disabled when `getAiAvailability()` is `'unavailable'` (existing behavior preserved).

8. **`vite.config.ts`** — mirror the WebLLM treatment for `@litert-lm/core`:
   - `optimizeDeps.exclude`: add `'@litert-lm/core'` (alongside `@mlc-ai/web-llm`).
   - `manualChunks`: `if (/[\\/]node_modules[\\/]@litert-lm[\\/]core[\\/]/.test(id)) return 'litert-vendor';`
   - `globIgnores`: add `'**/litert-vendor-*.js'` (JS chunk) **and** `'**/litert/**'` (the new self-hosted 37MB WASM runtime under `public/litert/`, same treatment as `**/ocr/**`) — exclude both from SW precache.

9. **`src/config/securityHeaders.ts`** — **no new origin.** LiteRT `.litertlm` weights load from the same HF hosts already in `WEBLLM_MODEL_ORIGINS` (`huggingface.co`, `*.xethub.hf.co`, `*.aws.cdn.hf.co`). Update the doc comment to note both WebLLM **and** LiteRT-LM use these origins (consider renaming the constant to `ONDEVICE_AI_MODEL_ORIGINS` for clarity — low-risk, optional). Confirm `vercel.json` CSP parity is unaffected (it is — same origins).

### 3.3 Shared device-loss helper

`isDeviceLostError()`, `DEVICE_UNAVAILABLE_MESSAGE`, and `resetEngineState()` currently live in `webllmProvider.ts`. Extract the GPU-agnostic pieces (`isDeviceLostError`, `DEVICE_UNAVAILABLE_MESSAGE`) into a small shared module (e.g. `src/core/ai/providers/gpuErrors.ts`) and import from both providers. This is a targeted improvement justified by the new consumer — not unrelated refactoring.

---

## 4. Data flow

```
feature hook (strength / breach explain)
  → promptApi.runPromptStreaming()            [unchanged facade]
    → registry.getActiveProvider()
        chrome-builtin (desktop)  ─ unchanged
        | litert-lm (Android, mobileInferenceEngine='litert-lm')  ← NEW
        | webllm     (Android, mobileInferenceEngine='webllm')
    → provider.runStreaming({ systemPrompt, userPrompt, signal })
```

`promptApi.ts`, `aiAvailability.ts`, `strengthExplain.ts`, `breachImpactExplain.ts`, and all feature hooks/UI are **unchanged** — they already delegate through the registry/facade. That is the dividend of the existing abstraction.

---

## 5. Security & privacy (no boundary change)

LiteRT inherits the **exact** on-device AI boundary already documented in `SECURITY.md`:

- **Fully local inference; no data leaves the device** at runtime. Same WebGPU-local execution as WebLLM.
- **Only weights download**, only on explicit opt-in, only from the already-allowlisted HF origins. No new `connect-src` exception.
- Strength prompt: label + rounded entropy only. Breach prompt: public breach data + non-secret metadata (title/username/category/age). **Never** password / secret notes / keys — unchanged, provider-agnostic (prompts are built upstream of the provider).
- No prompt/response logged or persisted; conversation/engine discarded after each call.
- AI remains outside the ZK boundary (decrypted plaintext in browser runtime) — already documented; LiteRT does not change this.

`SECURITY.md` §On-Device AI Boundary and `CLAUDE.md` get a note that a second WebGPU backend (LiteRT-LM, Android A/B, early-preview) exists behind its own kill-switch.

---

## 6. Testing

### Automated (mirror `__tests__/providers/`, `@litert-lm/core` mocked like the web-llm mock)

- `litertProvider.test.ts` — availability gating (no WebGPU → unavailable; ready flag → available/downloadable); lazy-import isolation (module not imported until `ensureReady`); device-loss normalization → clean message + engine reset; fresh conversation per `runStreaming`; abort breaks the stream.
- `registry.test.ts` (extend) — Android + `mobileInferenceEngine='litert-lm'` selects LiteRT; `='webllm'` selects WebLLM; chosen-but-disabled engine falls back to the other enabled engine; none enabled → null; desktop still selects chrome-builtin.
- `capabilities.test.ts` (extend) — `isMobileAiSurfaceEnabled` true when either flag on; `isLitertEnabled`/`isWebllmEnabled` reflect flags.
- `litertModels.test.ts` — catalog integrity, default id resolves, lightest tier first.
- `aiSettings.test.ts` (extend) — `mobileInferenceEngine` / `litertModelReady` / `litertModelId` defaults + round-trip + back-compat merge with stored partial settings.

### Manual — the actual goal (capture in `TEST_STATUS.md`)

On-device A/B on the two known Adreno devices (Adreno 6xx / Android 10; Adreno 810 / SD 7s Gen 3 / Android 16):
1. Enable LiteRT, download a `-Web.litertlm` model, trigger "Explain with AI".
2. Record: does `Engine.create()` / first generation survive, or reproduce `VK_ERROR_DEVICE_LOST`?
3. Compare directly against WebLLM (flip `mobileInferenceEngine`) on the same device/model tier.
4. Record outcome → decide whether to keep `LITERT_ANDROID_ENABLED = true` and/or re-enable WebLLM.

### Definition of Done gates (from `CLAUDE.md`)

- `npm run type-check` 0 errors, `npm run lint` 0 errors, targeted `npm run test` pass.
- LiteRT feature flag-gated (✅ `LITERT_ANDROID_ENABLED`).
- No sensitive data logged; no CryptoKey exposure (provider only sees pre-built non-secret prompts).
- Docs refreshed: `CLAUDE.md`, `SECURITY.md`, `TEST_STATUS.md`, `PROJECT_STATUS.md`/`ROADMAP.md` as needed.

---

## 7. Scope guards (YAGNI)

**In scope:** one additive browser `AiProvider` (text-in/text-out), per-engine settings + download, Android-only A/B picker, vite chunking, tests, docs.

**Out of scope:**
- Native shell (TWA/Capacitor) / native LiteRT-LM Android runtime — the only real Adreno fix, but a separate, much larger project. Noted as the follow-up if web LiteRT also fails Adreno.
- Multimodal / function-calling / image-in (LiteRT supports it; we don't need it).
- Streaming tokens to the Chrome extension.
- Any change to desktop Gemini-Nano behavior, prompts, or UI copy.
- Removing or altering WebLLM (it is the A/B control).

---

## 8. Open items (resolved during plan-writing vs. still open for on-device verification)

**Resolved** by inspecting the published `@litert-lm/core@0.13.1` tarball (see §2 amendment): exported symbols and shapes (`loadLiteRtLm`, `Engine.create`, `createConversation({ preface })`, `sendMessageStreaming` returns `ReadableStream<Message>`), abort via `conversation.cancel()`, no progress callback (worked around via a manual fetch + `TransformStream`), and the jsdelivr-default WASM path (worked around via self-hosting).

**Still open — confirm on real device during implementation/manual testing:**
1. Confirm the exact HF model URL for the chosen `-Web.litertlm` model resolves within the existing CSP origins (network tab on-device) and its actual download size matches the catalog estimate.
2. Confirm `conversation.cancel()` actually halts in-flight GPU work cleanly (vs. just stopping the stream) — mirrors the same verification WebLLM's `interruptGenerate()` got.
3. The actual Adreno A/B result — does `Engine.create()` / first generation survive on the two known-bad devices, or reproduce `VK_ERROR_DEVICE_LOST`? This is the test's whole purpose, not a pre-condition for shipping the code.
