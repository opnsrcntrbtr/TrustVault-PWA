# LiteRT-LM Web Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LiteRT-LM (`@litert-lm/core`) as a third on-device `AiProvider` (alongside `chrome-builtin` and `webllm`), Android-only, behind its own kill-switch, with a user-facing backend picker — so it can be A/B tested against WebLLM on the two known Qualcomm Adreno devices that crash WebLLM with `VK_ERROR_DEVICE_LOST`.

**Architecture:** Drop-in `AiProvider` mirroring `webllmProvider.ts`'s lifecycle (lazy-imported engine singleton, device-loss normalization, fresh conversation per call). The package requires a self-hosted WASM runtime bootstrap (`loadLiteRtLm()`) instead of its jsdelivr default, mirroring the existing self-hosted-OCR pattern. Registry gains an engine-selection setting; Settings UI gains a backend picker visible only when more than one mobile engine is enabled.

**Tech Stack:** `@litert-lm/core@0.13.1` (Apache-2.0, npm), TypeScript strict mode, Vitest, React 19 + MUI.

## Global Constraints

- TypeScript strict mode: no `any`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, explicit return types on complex functions.
- `npm run type-check` (0 errors), `npm run lint` (0 errors, max-warnings 0), targeted `npm run test` pass before each commit.
- No new CSP `connect-src` origin: LiteRT model weights use HF hosts already in `WEBLLM_MODEL_ORIGINS`; the WASM runtime is self-hosted same-origin (never the package's jsdelivr default).
- Heavy/WASM modules: lazy dynamic import only, excluded from `optimizeDeps`, isolated into a named `manualChunks` entry excluded from the service worker precache manifest.
- No sensitive data logged; AI prompts contain only non-secret metadata (unchanged from existing WebLLM/Chrome-builtin behavior — this plan does not touch prompt construction).
- `mounted` guard pattern for any React state set after an async boundary (per `CLAUDE.md` React 19 patterns).
- Desktop `chrome-builtin` behavior, prompts, and UI copy must not change.
- `LITERT_ANDROID_ENABLED` defaults `true` (new A/B surface); `WEBLLM_ANDROID_ENABLED` stays `false` (untouched, existing kill-switch).
- Default `mobileInferenceEngine` setting is `'litert-lm'`.

---

### Task 1: Self-host the LiteRT-LM WASM runtime (build-time asset pipeline)

**Files:**
- Create: `scripts/copy-litert-assets.js`
- Modify: `package.json` (dependencies, scripts)
- Modify: `.gitignore`
- Modify: `vite.config.ts:106-110,168-170,186-198` (globIgnores, optimizeDeps, manualChunks)
- Test: manual script run (no unit test — this is a build script, mirrors `copy-ocr-assets.js` which also has none)

**Interfaces:**
- Produces: `public/litert/litertlm_wasm_internal.js`, `public/litert/litertlm_wasm_internal.wasm`, `public/litert/litertlm_wasm_compat_internal.js`, `public/litert/litertlm_wasm_compat_internal.wasm` — the path `'/litert/litertlm_wasm_internal.js'` is the exact string Task 3's provider passes to `loadLiteRtLm()`.

- [ ] **Step 1: Install the package**

```bash
npm install @litert-lm/core@0.13.1
```

Expected: `package.json` `dependencies` gains `"@litert-lm/core": "^0.13.1"`, `package-lock.json` updates.

- [ ] **Step 2: Write the self-hosting copy script**

Create `scripts/copy-litert-assets.js`:

```js
#!/usr/bin/env node
/**
 * Copy self-hosted LiteRT-LM WASM runtime into public/litert/ (Android on-device AI).
 *
 * @litert-lm/core's Engine.create() bootstraps its WASM module via
 * getOrLoadGlobalLiteRtLm(), which defaults to fetching ~37MB from
 * https://cdn.jsdelivr.net/npm/@litert-lm/core@<version>/wasm — a third-party
 * CDN this project does not allowlist. Self-hosting (same pattern as Tesseract
 * OCR in copy-ocr-assets.js) keeps the runtime same-origin so no new CSP
 * connect-src/script-src exception is needed.
 * public/litert/ is gitignored; this script runs via predev/prebuild hooks.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const NM = path.join(ROOT, 'node_modules');
const OUT = path.join(ROOT, 'public', 'litert');

const ASSETS = [
  // [source (relative to node_modules), destination filename]
  ['@litert-lm/core/wasm/litertlm_wasm_internal.js', 'litertlm_wasm_internal.js'],
  ['@litert-lm/core/wasm/litertlm_wasm_internal.wasm', 'litertlm_wasm_internal.wasm'],
  ['@litert-lm/core/wasm/litertlm_wasm_compat_internal.js', 'litertlm_wasm_compat_internal.js'],
  ['@litert-lm/core/wasm/litertlm_wasm_compat_internal.wasm', 'litertlm_wasm_compat_internal.wasm'],
];

fs.mkdirSync(OUT, { recursive: true });

let copied = 0;
for (const [src, dest] of ASSETS) {
  const srcPath = path.join(NM, src);
  const destPath = path.join(OUT, dest);
  if (!fs.existsSync(srcPath)) {
    console.error(`[litert-assets] MISSING: ${src} — run npm install`);
    process.exitCode = 1;
    continue;
  }
  if (fs.existsSync(destPath)) {
    const s = fs.statSync(srcPath);
    const d = fs.statSync(destPath);
    if (s.size === d.size && d.mtimeMs >= s.mtimeMs) {
      continue;
    }
  }
  fs.copyFileSync(srcPath, destPath);
  copied += 1;
}

console.log(`[litert-assets] public/litert ready (${copied} file(s) copied, ${ASSETS.length} total)`);
```

- [ ] **Step 3: Run it and verify output**

Run: `node scripts/copy-litert-assets.js`
Expected: `[litert-assets] public/litert ready (4 file(s) copied, 4 total)` and:

```bash
ls -la public/litert/
```
Expected: 4 files present, `litertlm_wasm_internal.wasm` several MB (confirm non-zero size).

- [ ] **Step 4: Wire into npm lifecycle scripts**

In `package.json`, change each line that currently runs only the OCR copy to run both scripts:

```json
"ocr:assets": "node scripts/copy-ocr-assets.js",
"litert:assets": "node scripts/copy-litert-assets.js",
"predev": "node scripts/copy-ocr-assets.js && node scripts/copy-litert-assets.js",
"prebuild": "node scripts/copy-ocr-assets.js && node scripts/copy-litert-assets.js",
"prebuild:deploy": "node scripts/copy-ocr-assets.js && node scripts/copy-litert-assets.js",
"prepreview": "node scripts/copy-ocr-assets.js && node scripts/copy-litert-assets.js"
```

- [ ] **Step 5: Add to `.gitignore`**

In `.gitignore`, near the existing OCR entry:

```gitignore
# Self-hosted OCR assets (generated by scripts/copy-ocr-assets.js)
public/ocr/

# Self-hosted LiteRT-LM WASM runtime (generated by scripts/copy-litert-assets.js)
public/litert/
```

- [ ] **Step 6: Update `vite.config.ts` — precache exclusion, dep optimization, chunking**

In `vite.config.ts`, find the `globIgnores` line (~line 110):

```ts
globIgnores: ['**/ocr/**', '**/webllm-vendor-*.js'],
```

Replace with:

```ts
globIgnores: ['**/ocr/**', '**/webllm-vendor-*.js', '**/litert/**', '**/litert-vendor-*.js'],
```

Find `optimizeDeps` (~line 168):

```ts
optimizeDeps: {
  exclude: ['@mlc-ai/web-llm'],
},
```

Replace with:

```ts
optimizeDeps: {
  exclude: ['@mlc-ai/web-llm', '@litert-lm/core'],
},
```

Find the `manualChunks` function (~line 186), and the WebLLM line inside it:

```ts
          if (/[\\/]node_modules[\\/]@mlc-ai[\\/]web-llm[\\/]/.test(id)) return 'webllm-vendor';
          return undefined;
```

Replace with:

```ts
          if (/[\\/]node_modules[\\/]@mlc-ai[\\/]web-llm[\\/]/.test(id)) return 'webllm-vendor';
          // Same rationale as webllm-vendor above: lazy-loaded only on
          // Android/WebGPU (LiteRT-LM A/B), excluded from SW precache below.
          if (/[\\/]node_modules[\\/]@litert-lm[\\/]core[\\/]/.test(id)) return 'litert-vendor';
          return undefined;
```

Find the `runtimeCaching` array (~line 111) and add a `CacheFirst` entry for the self-hosted WASM runtime, mirroring the OCR entry right after it:

```ts
          // Self-hosted LiteRT-LM WASM runtime (~37MB) — served from
          // public/litert/ (no CDN egress, see copy-litert-assets.js).
          // Runtime-cached on first on-device-AI use instead of precached.
          {
            urlPattern: ({ url }) => url.pathname.includes('/litert/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'litert-assets-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
```

- [ ] **Step 5: Run a build to confirm the config is well-formed**

Run: `npm run build:deploy`
Expected: build succeeds; `dist/assets/js/` contains a `litert-vendor-*.js` chunk is **not required yet** (no code imports `@litert-lm/core` until Task 3) — this step only confirms `vite.config.ts` has no syntax errors. If the build fails on unrelated grounds, stop and report; do not proceed.

- [ ] **Step 6: Commit**

```bash
git add scripts/copy-litert-assets.js package.json package-lock.json .gitignore vite.config.ts
git commit -m "build: self-host LiteRT-LM WASM runtime, avoid jsdelivr CDN"
```

---

### Task 2: LiteRT model catalog

**Files:**
- Create: `src/core/ai/litertModels.ts`
- Test: `src/core/ai/__tests__/litertModels.test.ts`

**Interfaces:**
- Produces: `LitertModel { id: string; label: string; tier: 'tiny' | 'small' | 'mid'; url: string; approxMB: number }`, `LITERT_MODELS: ReadonlyArray<LitertModel>`, `DEFAULT_LITERT_MODEL_ID: string`, `getLitertModelById(id: string): LitertModel | undefined`. Task 3's provider consumes `LitertModel.url`; Task 6's settings consume `DEFAULT_LITERT_MODEL_ID`; Task 7's UI consumes `LITERT_MODELS` + `getLitertModelById`.

- [ ] **Step 1: Write the failing test**

Create `src/core/ai/__tests__/litertModels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LITERT_MODELS, DEFAULT_LITERT_MODEL_ID, getLitertModelById } from '@/core/ai/litertModels';

describe('litertModels', () => {
  it('has at least one tiny model', () => {
    expect(LITERT_MODELS.some(m => m.tier === 'tiny')).toBe(true);
  });
  it('every model url points at a -Web.litertlm file', () => {
    for (const m of LITERT_MODELS) {
      expect(m.url).toMatch(/-Web\.litertlm$/);
    }
  });
  it('default model id exists in the catalog and is tiny tier', () => {
    const def = getLitertModelById(DEFAULT_LITERT_MODEL_ID);
    expect(def).toBeDefined();
    expect(def?.tier).toBe('tiny');
  });
  it('getLitertModelById returns undefined for unknown ids', () => {
    expect(getLitertModelById('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ai/__tests__/litertModels.test.ts`
Expected: FAIL — `Cannot find module '@/core/ai/litertModels'`

- [ ] **Step 3: Write the catalog**

Create `src/core/ai/litertModels.ts`:

```ts
/**
 * Catalog of LiteRT-LM prebuilt models offered on Android (A/B vs. WebLLM).
 * `url` must resolve to a `-Web.litertlm` file under the HF origins already
 * allowlisted for WebLLM (huggingface.co / *.xethub.hf.co / *.aws.cdn.hf.co).
 */
export interface LitertModel {
  id: string;
  label: string;
  tier: 'tiny' | 'small' | 'mid';
  url: string;
  approxMB: number;
}

export const LITERT_MODELS: ReadonlyArray<LitertModel> = [
  // Tiny tier first: lightest warm-up footprint, best chance of surviving
  // low-end/older Adreno GPUs where larger models are more likely to exceed
  // the warm-up memory budget (same rationale as the WebLLM Tiny tier).
  {
    id: 'gemma-3n-E2B-it',
    label: 'Tiny — Gemma 3n E2B (most compatible)',
    tier: 'tiny',
    url: 'https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-int4-Web.litertlm',
    approxMB: 1500,
  },
  {
    id: 'gemma-3n-E4B-it',
    label: 'Small — Gemma 3n E4B',
    tier: 'small',
    url: 'https://huggingface.co/google/gemma-3n-E4B-it-litert-lm/resolve/main/gemma-3n-E4B-it-int4-Web.litertlm',
    approxMB: 2700,
  },
];

export const DEFAULT_LITERT_MODEL_ID = 'gemma-3n-E2B-it';

export function getLitertModelById(id: string): LitertModel | undefined {
  return LITERT_MODELS.find((m) => m.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/ai/__tests__/litertModels.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/litertModels.ts src/core/ai/__tests__/litertModels.test.ts
git commit -m "feat(ai): add LiteRT-LM model catalog"
```

---

### Task 3: Extract shared GPU device-loss helper from `webllmProvider.ts`

**Files:**
- Create: `src/core/ai/providers/gpuErrors.ts`
- Modify: `src/core/ai/providers/webllmProvider.ts:34-50`
- Test: `src/core/ai/__tests__/providers/gpuErrors.test.ts`

**Interfaces:**
- Produces: `isDeviceLostError(err: unknown): boolean`, `DEVICE_UNAVAILABLE_MESSAGE: string`. Task 4's `litertProvider.ts` imports both; `webllmProvider.ts` is refactored to import them instead of defining its own copies.

- [ ] **Step 1: Write the failing test**

Create `src/core/ai/__tests__/providers/gpuErrors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isDeviceLostError, DEVICE_UNAVAILABLE_MESSAGE } from '@/core/ai/providers/gpuErrors';

describe('gpuErrors', () => {
  it('recognizes a WebGPU device-lost message', () => {
    expect(isDeviceLostError(new Error('Device was lost. This can happen due to insufficient memory.'))).toBe(true);
  });
  it('recognizes a dropped-instance message', () => {
    expect(isDeviceLostError(new Error('A valid external Instance reference no longer exists.'))).toBe(true);
  });
  it('recognizes a non-Error thrown value', () => {
    expect(isDeviceLostError('GPUDevice is lost')).toBe(true);
  });
  it('returns false for unrelated errors', () => {
    expect(isDeviceLostError(new Error('network timeout'))).toBe(false);
  });
  it('exposes a stable user-facing message', () => {
    expect(DEVICE_UNAVAILABLE_MESSAGE).toMatch(/on-device AI could not start/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ai/__tests__/providers/gpuErrors.test.ts`
Expected: FAIL — `Cannot find module '@/core/ai/providers/gpuErrors'`

- [ ] **Step 3: Create the shared module**

Create `src/core/ai/providers/gpuErrors.ts`:

```ts
/**
 * Shared WebGPU device-loss detection, used by every browser-based AiProvider
 * (WebLLM, LiteRT-LM). A device-loss failure cascades once the GPU device is
 * gone, so callers normalize it into one clean error instead of letting the
 * underlying library's internal rejections flood the console.
 */

/** User-facing message when the GPU can't sustain on-device inference. */
export const DEVICE_UNAVAILABLE_MESSAGE =
  "On-device AI could not start on this device's GPU. It may not support running this model.";

/** True for WebGPU device-loss / dropped-instance failures. */
export function isDeviceLostError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /device was lost|external instance reference|poperrorscope|gpudevice|device is lost/i.test(msg);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/ai/__tests__/providers/gpuErrors.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Refactor `webllmProvider.ts` to use the shared module**

In `src/core/ai/providers/webllmProvider.ts`, delete the local definitions (lines 29-45 in the current file, the `DEVICE_UNAVAILABLE_MESSAGE` constant and `isDeviceLostError` function) and import them instead:

```ts
import { isDeviceLostError, DEVICE_UNAVAILABLE_MESSAGE } from '@/core/ai/providers/gpuErrors';
```

Remove the now-duplicate comment block above the deleted constant/function. Leave every other line in `webllmProvider.ts` unchanged (`resetEngineState`, `createEngine`, `ensureReady`, `runStreaming`, the exported `webllmProvider` object all stay exactly as they are — they already reference `isDeviceLostError`/`DEVICE_UNAVAILABLE_MESSAGE` by name).

- [ ] **Step 6: Run the full WebLLM provider test suite to confirm no regression**

Run: `npx vitest run src/core/ai/__tests__/providers/webllmProvider.test.ts`
Expected: PASS (6 tests, unchanged from before the refactor)

- [ ] **Step 7: Run lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: 0 errors (no unused imports left behind in `webllmProvider.ts`)

- [ ] **Step 8: Commit**

```bash
git add src/core/ai/providers/gpuErrors.ts src/core/ai/__tests__/providers/gpuErrors.test.ts src/core/ai/providers/webllmProvider.ts
git commit -m "refactor(ai): extract shared GPU device-loss detection for reuse by LiteRT-LM provider"
```

---

### Task 4: `litertProvider.ts` — engine lifecycle, progress, streaming, abort

**Files:**
- Create: `src/core/ai/providers/litertProvider.ts`
- Test: `src/core/ai/__tests__/providers/litertProvider.test.ts`

**Interfaces:**
- Consumes: `LitertModel`/`getLitertModelById` from `@/core/ai/litertModels` (Task 2); `isDeviceLostError`/`DEVICE_UNAVAILABLE_MESSAGE` from `@/core/ai/providers/gpuErrors` (Task 3); `AiProvider`/`AiDownloadProgress` types from `@/core/ai/providers/types` (modified in Task 5); `loadAiSettings` from `@/core/ai/aiSettings` (extended in Task 6, but this task can be written against the settings shape directly since `loadAiSettings()` already exists).
- Produces: `litertProvider: AiProvider` with `id: 'litert-lm'`; `removeLitertModel(): Promise<void>`; `__resetLitertEngineForTesting(): void`. Task 7's Settings UI imports `litertProvider` and `removeLitertModel`. Task 5's registry imports `litertProvider`.

This task is written against `litertSettings.litertModelId` / `litertSettings.litertModelReady`, which do not exist on `AiSettings` until Task 6 lands. To keep this task buildable and testable in isolation, write it now against the **final** field names (`litertModelId`, `litertModelReady`) — the mock in this task's own test file supplies them; Task 6 will make `loadAiSettings()` actually return them for real. TypeScript will not complain because the test mocks the whole `aiSettings` module (same pattern `webllmProvider.test.ts` uses), and the provider source only reads `loadAiSettings().litertModelId` / `.litertModelReady` via property access (not validated against the real type until Task 6's `AiSettings` interface gains them — at which point `npm run type-check` must be re-run; Step 7 below does that).

- [ ] **Step 1: Write the failing tests**

Create `src/core/ai/__tests__/providers/litertProvider.test.ts`:

```ts
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

const loadLiteRtLm = vi.fn();
const engineCreate = vi.fn();
const conversationCancel = vi.fn();
const conversationDelete = vi.fn().mockResolvedValue(undefined);
const engineDelete = vi.fn().mockResolvedValue(undefined);

function makeReadableStream(messages: Array<{ role: string; content: Array<{ type: string; text?: string }> }>) {
  return new ReadableStream({
    start(controller) {
      for (const m of messages) controller.enqueue(m);
      controller.close();
    },
  });
}

const conversation = {
  sendMessageStreaming: vi.fn(),
  cancel: conversationCancel,
  delete: conversationDelete,
};
const engine = {
  createConversation: vi.fn().mockResolvedValue(conversation),
  delete: engineDelete,
};

// Mock the lazy-imported library.
vi.mock('@litert-lm/core', () => ({
  loadLiteRtLm: (...args: unknown[]): unknown => loadLiteRtLm(...args),
  Engine: { create: (...args: unknown[]): unknown => engineCreate(...args) },
}));
// Force WebGPU present + a known model + ready flag, mirroring webllmProvider.test.ts.
vi.mock('@/core/ai/providers/capabilities', () => ({
  hasWebGpu: vi.fn().mockResolvedValue(true),
  isAndroid: () => true,
  isMobileAiSurfaceEnabled: () => true,
}));
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: () => ({ litertModelId: 'gemma-3n-E2B-it', litertModelReady: true }),
  saveAiSettings: vi.fn(),
}));
vi.mock('@/core/ai/litertModels', () => ({
  getLitertModelById: () => ({ id: 'gemma-3n-E2B-it', url: 'https://huggingface.co/x/y/resolve/main/m-Web.litertlm', approxMB: 1500, tier: 'tiny', label: 'Tiny' }),
}));

const originalFetch = global.fetch;

import { litertProvider, __resetLitertEngineForTesting } from '@/core/ai/providers/litertProvider';

describe('litertProvider', () => {
  beforeEach(() => {
    loadLiteRtLm.mockResolvedValue(undefined);
    engineCreate.mockResolvedValue(engine);
    conversation.sendMessageStreaming.mockReturnValue(makeReadableStream([
      { role: 'assistant', content: [{ type: 'text', text: 'Hel' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'lo' }] },
    ]));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '10' }),
      body: makeReadableStream([]).pipeThrough(new TransformStream()) as unknown as ReadableStream<Uint8Array>,
    });
  });
  afterEach(() => {
    __resetLitertEngineForTesting();
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('id is litert-lm', () => {
    expect(litertProvider.id).toBe('litert-lm');
  });

  it('ensureReady bootstraps the WASM runtime exactly once, then creates the engine once', async () => {
    await litertProvider.ensureReady();
    await litertProvider.ensureReady();
    expect(loadLiteRtLm).toHaveBeenCalledTimes(1);
    expect(loadLiteRtLm).toHaveBeenCalledWith('/litert/litertlm_wasm_internal.js');
    expect(engineCreate).toHaveBeenCalledTimes(1);
  });

  it('runStreaming creates a conversation with the system preface and yields text chunks', async () => {
    let out = '';
    for await (const c of litertProvider.runStreaming({ systemPrompt: 'sys', userPrompt: 'u' })) out += c;
    expect(out).toBe('Hello');
    expect(engine.createConversation).toHaveBeenCalledWith({ preface: { messages: [{ role: 'system', content: 'sys' }] } });
    expect(conversation.sendMessageStreaming).toHaveBeenCalledWith('u');
  });

  it('normalizes a GPU device-lost failure during init and resets so a retry re-creates', async () => {
    engineCreate.mockReset();
    engineCreate.mockRejectedValueOnce(new Error('Device was lost. This can happen due to insufficient memory.'));
    await expect(litertProvider.ensureReady()).rejects.toThrow(/on-device AI could not start/i);
    engineCreate.mockResolvedValueOnce(engine);
    await litertProvider.ensureReady();
    expect(engineCreate).toHaveBeenCalledTimes(2);
  });

  it('runStreaming calls conversation.cancel() when the signal aborts', async () => {
    const controller = new AbortController();
    conversation.sendMessageStreaming.mockReturnValue(makeReadableStream([
      { role: 'assistant', content: [{ type: 'text', text: 'x' }] },
    ]));
    const drained: string[] = [];
    for await (const c of litertProvider.runStreaming({ systemPrompt: 's', userPrompt: 'u', signal: controller.signal })) {
      drained.push(c);
      controller.abort();
    }
    expect(conversationCancel).toHaveBeenCalled();
  });

  it('getAvailability reflects readiness from settings', async () => {
    expect(await litertProvider.getAvailability()).toBe('available');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/ai/__tests__/providers/litertProvider.test.ts`
Expected: FAIL — `Cannot find module '@/core/ai/providers/litertProvider'`

- [ ] **Step 3: Write the provider implementation**

Create `src/core/ai/providers/litertProvider.ts`:

```ts
/**
 * LiteRT-LM provider — fully-local WebGPU inference via @litert-lm/core.
 * Library is lazy-imported (heavy WASM) and never loaded on desktop Chrome.
 * The WASM runtime itself is self-hosted under /litert/ (see
 * scripts/copy-litert-assets.js) — the package's default bootstrap path
 * fetches ~37MB from cdn.jsdelivr.net, which this project does not allowlist.
 * Model weights download once from HuggingFace (gated by Settings opt-in).
 */
import type { AiAvailability } from '@/core/ai/aiTypes';
import type { AiProvider, AiDownloadProgress } from '@/core/ai/providers/types';
import { hasWebGpu } from '@/core/ai/providers/capabilities';
import { loadAiSettings } from '@/core/ai/aiSettings';
import { getLitertModelById } from '@/core/ai/litertModels';
import { isDeviceLostError, DEVICE_UNAVAILABLE_MESSAGE } from '@/core/ai/providers/gpuErrors';

const LITERT_WASM_PATH = '/litert/litertlm_wasm_internal.js';

interface LitertMessageContentItem {
  type: string;
  text?: string;
}
interface LitertMessage {
  role: string;
  content?: string | LitertMessageContentItem[];
}
interface LitertConversation {
  sendMessageStreaming(message: string): ReadableStream<LitertMessage>;
  cancel(): void;
  delete(): Promise<void>;
}
interface LitertEngine {
  createConversation(config: { preface: { messages: Array<{ role: 'system'; content: string }> } }): Promise<LitertConversation>;
  delete(): Promise<void>;
}

let wasmLoaded = false;
let wasmLoadPromise: Promise<void> | null = null;
let engine: LitertEngine | null = null;
let engineModelId: string | null = null;
let initPromise: Promise<LitertEngine> | null = null;

export function __resetLitertEngineForTesting(): void {
  wasmLoaded = false; wasmLoadPromise = null;
  engine = null; engineModelId = null; initPromise = null;
}

/** Drops all engine state so the next ensureReady() re-creates from scratch. */
function resetEngineState(): void {
  engine = null; engineModelId = null; initPromise = null;
}

/** Unloads the engine (frees GPU/WASM memory) so a different model can be picked. */
export async function removeLitertModel(): Promise<void> {
  if (engine) await engine.delete();
  engine = null; engineModelId = null; initPromise = null;
}

async function ensureWasmLoaded(): Promise<void> {
  if (wasmLoaded) return;
  if (wasmLoadPromise) { await wasmLoadPromise; return; }
  const { loadLiteRtLm } = await import('@litert-lm/core');
  wasmLoadPromise = loadLiteRtLm(LITERT_WASM_PATH).then(() => { wasmLoaded = true; });
  await wasmLoadPromise;
}

/**
 * Fetches the model ourselves (instead of passing a bare URL to Engine.create)
 * so download progress can be reported — @litert-lm/core has no progress
 * callback, but EngineSettings.model accepts a ReadableStream<Uint8Array>.
 */
async function fetchModelWithProgress(
  url: string,
  onProgress?: (p: AiDownloadProgress) => void,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok || !response.body) throw new Error(`Failed to fetch LiteRT model from ${url}`);
  const total = Number(response.headers.get('content-length') ?? 0);
  let loaded = 0;
  const reader = response.body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) { controller.close(); return; }
      loaded += value.byteLength;
      onProgress?.({ progress: total > 0 ? loaded / total : 0, text: 'Downloading model' });
      controller.enqueue(value);
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

async function createEngine(
  modelId: string,
  onProgress?: (p: AiDownloadProgress) => void,
): Promise<LitertEngine> {
  await ensureWasmLoaded();
  const { Engine } = await import('@litert-lm/core');
  const model = getLitertModelById(modelId);
  if (!model) throw new Error(`Unknown LiteRT model id: ${modelId}`);
  const modelStream = await fetchModelWithProgress(model.url, onProgress);
  const created = await Engine.create({ model: modelStream });
  return created as unknown as LitertEngine;
}

async function ensureReady(onProgress?: (p: AiDownloadProgress) => void): Promise<void> {
  const modelId = loadAiSettings().litertModelId;
  if (engine && engineModelId === modelId) return;
  if (initPromise) { await initPromise; return; }
  try { await navigator.storage.persist(); } catch { /* best-effort */ }
  initPromise = createEngine(modelId, onProgress)
    .then((e) => { engine = e; engineModelId = modelId; initPromise = null; return e; })
    .catch((err: unknown) => {
      resetEngineState();
      if (isDeviceLostError(err)) throw new Error(DEVICE_UNAVAILABLE_MESSAGE);
      throw err;
    });
  await initPromise;
}

async function* runStreaming(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
}): AsyncIterableIterator<string> {
  await ensureReady();
  if (!engine) throw new Error('LiteRT-LM engine not ready');
  const conversation = await engine.createConversation({
    preface: { messages: [{ role: 'system', content: args.systemPrompt }] },
  });
  const onAbort = () => { conversation.cancel(); };
  args.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const stream = conversation.sendMessageStreaming(args.userPrompt);
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const items = Array.isArray(value.content) ? value.content : [];
        for (const item of items) {
          if (item.type === 'text' && item.text) yield item.text;
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (err: unknown) {
    if (isDeviceLostError(err)) { resetEngineState(); throw new Error(DEVICE_UNAVAILABLE_MESSAGE); }
    throw err;
  } finally {
    args.signal?.removeEventListener('abort', onAbort);
    await conversation.delete();
  }
}

export const litertProvider: AiProvider = {
  id: 'litert-lm',
  async getAvailability(): Promise<AiAvailability> {
    if (!(await hasWebGpu())) return 'unavailable';
    return loadAiSettings().litertModelReady ? 'available' : 'downloadable';
  },
  ensureReady,
  warmUp(): Promise<void> { return ensureReady(); },
  runStreaming,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/ai/__tests__/providers/litertProvider.test.ts`
Expected: PASS (5 tests). If the `getAvailability` test fails because `AiProviderId`/`AiSettings` types don't yet include `'litert-lm'`/`litertModelId` (Tasks 5/6 not done yet), this is expected — `vi.mock` replaces the modules entirely, so runtime behavior is correct even before the real types land; only `npm run type-check` will fail until Task 5/6 land. Re-run `type-check` after Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/providers/litertProvider.ts src/core/ai/__tests__/providers/litertProvider.test.ts
git commit -m "feat(ai): add LiteRT-LM provider (engine lifecycle, streaming, device-loss handling)"
```

---

### Task 5: Wire `AiProviderId`, capability flags, and registry selection

**Files:**
- Modify: `src/core/ai/providers/types.ts:8`
- Modify: `src/core/ai/providers/capabilities.ts:37-46`
- Modify: `src/core/ai/providers/registry.ts`
- Test: `src/core/ai/__tests__/providers/capabilities.test.ts` (extend)
- Test: `src/core/ai/__tests__/providers/registry.test.ts` (extend)

**Interfaces:**
- Consumes: `litertProvider` from `@/core/ai/providers/litertProvider` (Task 4).
- Produces: `isLitertEnabled(): boolean`, `isWebllmEnabled(): boolean` (capabilities.ts) — consumed by Task 7's UI to decide whether to show the backend picker. `getActiveProvider()` now also returns `litertProvider` for `id: 'litert-lm'`.

- [ ] **Step 1: Update `AiProviderId`**

In `src/core/ai/providers/types.ts`, change line 8:

```ts
export type AiProviderId = 'chrome-builtin' | 'webllm';
```

to:

```ts
export type AiProviderId = 'chrome-builtin' | 'webllm' | 'litert-lm';
```

- [ ] **Step 2: Write the failing capabilities test**

In `src/core/ai/__tests__/providers/capabilities.test.ts`, add (after the existing `isMobileAiSurfaceEnabled` test):

```ts
  it('isLitertEnabled() reflects the LiteRT-LM kill-switch (on by default for the A/B)', () => {
    expect(isLitertEnabled()).toBe(true);
  });

  it('isWebllmEnabled() reflects the WebLLM kill-switch (off, unchanged post-Task-11)', () => {
    expect(isWebllmEnabled()).toBe(false);
  });

  it('isMobileAiSurfaceEnabled() is true on Android because LiteRT is enabled, even though WebLLM stays off', () => {
    setNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
    expect(isMobileAiSurfaceEnabled()).toBe(true);
  });
```

Update the existing test right above it (it currently asserts the surface is fully disabled — that is no longer true once LiteRT is on by default):

```ts
  it('isMobileAiSurfaceEnabled() is disabled (kill-switch off post-Task-11) even on Android', () => {
```

Replace with the new `isMobileAiSurfaceEnabled() is true ... ` test added above (delete the old assertion entirely — it contradicts the new default; don't leave both).

Update the import line at the top of the file:

```ts
import { hasWebGpu, isAndroid, isMobileAiSurfaceEnabled } from '@/core/ai/providers/capabilities';
```

to:

```ts
import { hasWebGpu, isAndroid, isMobileAiSurfaceEnabled, isLitertEnabled, isWebllmEnabled } from '@/core/ai/providers/capabilities';
```

- [ ] **Step 3: Run capabilities tests to verify they fail**

Run: `npx vitest run src/core/ai/__tests__/providers/capabilities.test.ts`
Expected: FAIL — `isLitertEnabled is not exported` / `isWebllmEnabled is not exported`

- [ ] **Step 4: Update `capabilities.ts`**

In `src/core/ai/providers/capabilities.ts`, replace lines 22-46 (the `WEBLLM_ANDROID_ENABLED` constant and `isMobileAiSurfaceEnabled` function) with:

```ts
/**
 * Master kill-switch for the WebLLM (Android) on-device AI surface.
 *
 * DISABLED 2026-06-21 after on-device verification (Task 11). WebLLM inference
 * reliably crashes the Qualcomm Adreno Vulkan driver with VK_ERROR_DEVICE_LOST
 * during engine warm-up — reproduced on two Adreno generations (Adreno 6xx /
 * Android 10 and Adreno 810 / SD 7s Gen 3 / Android 16), both q4f16 AND q4f32,
 * both 0.5B and 1B, with reduced context, on the latest @mlc-ai/web-llm. Plain
 * WebGPU compute works on the same devices, so it is WebLLM's heavy kernels vs.
 * the Adreno driver — not an app bug and not fixable at the app layer. Adreno is
 * the dominant Android GPU and no working Android GPU case is known, so the
 * surface is gated off rather than shipping a multi-hundred-MB download that
 * can't run. Re-enable (flip to `true`) once WebLLM/Dawn/Qualcomm resolve this
 * upstream and inference is re-verified on-device. See TEST_STATUS.md.
 */
const WEBLLM_ANDROID_ENABLED: boolean = false;

/**
 * Kill-switch for the LiteRT-LM (Android) on-device AI surface.
 *
 * ENABLED 2026-06-21 to A/B test whether LiteRT-LM's WebGPU kernels survive
 * the same Qualcomm Adreno devices that crash WebLLM with VK_ERROR_DEVICE_LOST
 * (see TEST_STATUS.md). LiteRT-LM's web target shares the WebGPU/Dawn stack
 * implicated in that failure, so survival is unverified, not assumed — this
 * flag exists to find out on real hardware, independent of WebLLM's flag.
 */
const LITERT_ANDROID_ENABLED: boolean = true;

export function isWebllmEnabled(): boolean { return WEBLLM_ANDROID_ENABLED; }
export function isLitertEnabled(): boolean { return LITERT_ANDROID_ENABLED; }

/**
 * Feature flag: the on-device AI download UI / provider fallback is surfaced
 * only on Android, and only while at least one mobile engine's kill-switch
 * above is enabled. Capability detection (hasWebGpu) stays platform-honest;
 * this only gates the UI + provider selection.
 */
export function isMobileAiSurfaceEnabled(): boolean {
  return (WEBLLM_ANDROID_ENABLED || LITERT_ANDROID_ENABLED) && isAndroid();
}
```

- [ ] **Step 5: Run capabilities tests to verify they pass**

Run: `npx vitest run src/core/ai/__tests__/providers/capabilities.test.ts`
Expected: PASS (all tests, including the new ones)

- [ ] **Step 6: Write the failing registry test**

In `src/core/ai/__tests__/providers/registry.test.ts`, add after the existing `webllm` test, and update the mock at the top of the file to also expose the new flags:

```ts
vi.mock('@/core/ai/providers/capabilities', async (orig) => {
  const actual = await orig<typeof import('@/core/ai/providers/capabilities')>();
  return {
    ...actual,
    isMobileAiSurfaceEnabled: vi.fn(actual.isMobileAiSurfaceEnabled),
    isLitertEnabled: vi.fn(actual.isLitertEnabled),
    isWebllmEnabled: vi.fn(actual.isWebllmEnabled),
  };
});
```

(Replaces the existing narrower mock at the top of the file — same file, same `vi.mock` call, just widened.)

Add new tests:

```ts
  it('selects litert-lm by default when chrome unavailable, WebGPU present, surface enabled, and LiteRT is the engine choice', async () => {
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);
    vi.mocked(isLitertEnabled).mockReturnValue(true);
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('unavailable');
    Object.defineProperty(globalThis.navigator, 'gpu', { value: { requestAdapter: vi.fn().mockResolvedValue({}) }, configurable: true });
    vi.doMock('@/core/ai/aiSettings', () => ({ loadAiSettings: () => ({ mobileInferenceEngine: 'litert-lm' }) }));
    const { getActiveProvider: getActiveProviderFresh } = await import('@/core/ai/providers/registry');
    const p = await getActiveProviderFresh();
    expect(p?.id).toBe('litert-lm');
  });

  it('falls back to webllm when litert-lm is chosen but disabled, and webllm is enabled', async () => {
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);
    vi.mocked(isLitertEnabled).mockReturnValue(false);
    vi.mocked(isWebllmEnabled).mockReturnValue(true);
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('unavailable');
    Object.defineProperty(globalThis.navigator, 'gpu', { value: { requestAdapter: vi.fn().mockResolvedValue({}) }, configurable: true });
    vi.doMock('@/core/ai/aiSettings', () => ({ loadAiSettings: () => ({ mobileInferenceEngine: 'litert-lm' }) }));
    const { getActiveProvider: getActiveProviderFresh } = await import('@/core/ai/providers/registry');
    const p = await getActiveProviderFresh();
    expect(p?.id).toBe('webllm');
  });
```

Update the import line at the top:

```ts
import { isMobileAiSurfaceEnabled } from '@/core/ai/providers/capabilities';
```

to:

```ts
import { isMobileAiSurfaceEnabled, isLitertEnabled, isWebllmEnabled } from '@/core/ai/providers/capabilities';
```

> Note: the two new tests use `vi.doMock` + dynamic re-`import` of the registry module because `getActiveProvider()` reads `loadAiSettings()` fresh inside the function (no caching of settings), and the existing module-level `vi.mock('@/core/ai/providers/capabilities', ...)` at the top of the file already applies — `vi.doMock` only needs to add the settings mock per-test without disturbing the capabilities mock. This mirrors how `litertProvider.test.ts` mocks `aiSettings` at module scope; here it's scoped per-test because different tests need different `mobileInferenceEngine` values.

- [ ] **Step 7: Run registry tests to verify the new ones fail**

Run: `npx vitest run src/core/ai/__tests__/providers/registry.test.ts`
Expected: the two new tests FAIL (registry doesn't yet know about `litert-lm`/`mobileInferenceEngine`); the four pre-existing tests still PASS.

- [ ] **Step 8: Update `registry.ts`**

Replace the full contents of `src/core/ai/providers/registry.ts` with:

```ts
/**
 * Active-provider selection. Prefers Chrome built-in when available; otherwise
 * on Android with WebGPU and the mobile surface enabled, picks the engine
 * named by aiSettings.mobileInferenceEngine, falling back to whichever other
 * mobile engine is enabled if the chosen one isn't.
 */
import type { AiProvider } from '@/core/ai/providers/types';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';
import { webllmProvider } from '@/core/ai/providers/webllmProvider';
import { litertProvider } from '@/core/ai/providers/litertProvider';
import { hasWebGpu, isMobileAiSurfaceEnabled, isLitertEnabled, isWebllmEnabled } from '@/core/ai/providers/capabilities';
import { loadAiSettings } from '@/core/ai/aiSettings';

let cached: AiProvider | null | undefined;
let override: AiProvider | null | undefined;

export function __setActiveProviderForTesting(p: AiProvider | null): void { override = p; }
export function __resetRegistryForTesting(): void { cached = undefined; override = undefined; }

function selectMobileProvider(): AiProvider | null {
  const preferred = loadAiSettings().mobileInferenceEngine;
  if (preferred === 'litert-lm' && isLitertEnabled()) return litertProvider;
  if (preferred === 'webllm' && isWebllmEnabled()) return webllmProvider;
  // Chosen engine disabled — fall back to whichever other engine is enabled.
  if (isLitertEnabled()) return litertProvider;
  if (isWebllmEnabled()) return webllmProvider;
  return null;
}

export async function getActiveProvider(): Promise<AiProvider | null> {
  if (override !== undefined) return override;
  if (cached !== undefined) return cached;

  const chromeAvail = await chromeBuiltinProvider.getAvailability();
  if (chromeAvail === 'available') { cached = chromeBuiltinProvider; return cached; }

  if (isMobileAiSurfaceEnabled() && (await hasWebGpu())) {
    cached = selectMobileProvider();
    return cached;
  }
  cached = null;
  return cached;
}
```

- [ ] **Step 9: Run registry tests to verify they pass**

Run: `npx vitest run src/core/ai/__tests__/providers/registry.test.ts`
Expected: PASS (all 6 tests). Note: this will not fully type-check (`mobileInferenceEngine` doesn't exist on `AiSettings` yet) until Task 6 lands — that's expected; Vitest's module-mocking bypasses TS at runtime. Re-run `npm run type-check` after Task 6.

- [ ] **Step 10: Commit**

```bash
git add src/core/ai/providers/types.ts src/core/ai/providers/capabilities.ts src/core/ai/providers/registry.ts src/core/ai/__tests__/providers/capabilities.test.ts src/core/ai/__tests__/providers/registry.test.ts
git commit -m "feat(ai): wire LiteRT-LM into provider registry with per-engine kill-switches"
```

---

### Task 6: Settings fields for engine selection and per-engine readiness

**Files:**
- Modify: `src/core/ai/aiSettings.ts`
- Test: `src/core/ai/__tests__/aiSettings.test.ts` (extend)

**Interfaces:**
- Produces: `AiSettings.mobileInferenceEngine: 'litert-lm' | 'webllm'`, `AiSettings.litertModelReady: boolean`, `AiSettings.litertModelId: string`. Consumed by Task 4's provider (already written against these names), Task 5's registry (already written against `mobileInferenceEngine`), and Task 7's UI.

- [ ] **Step 1: Write the failing test**

In `src/core/ai/__tests__/aiSettings.test.ts`, replace the entire file (every existing object literal needs the 3 new fields added, so a full rewrite is clearer than a patch):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_AI_SETTINGS,
  loadAiSettings,
  saveAiSettings,
  type AiSettings,
} from '@/core/ai/aiSettings';

const STORAGE_KEY = 'trustvault_ai_settings';

describe('aiSettings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('defaults both toggles to true, and prefers litert-lm as the mobile engine', () => {
    expect(DEFAULT_AI_SETTINGS).toEqual({
      enableOnDeviceAI: true,
      allowStrengthExplanation: true,
      allowBreachImpactAnalysis: true,
      webLlmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      mobileAiModelReady: false,
      mobileInferenceEngine: 'litert-lm',
      litertModelId: 'gemma-3n-E2B-it',
      litertModelReady: false,
    });
  });

  it('returns defaults when storage empty', () => {
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('merges stored partial over defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enableOnDeviceAI: false }));
    expect(loadAiSettings()).toEqual({
      enableOnDeviceAI: false,
      allowStrengthExplanation: true,
      allowBreachImpactAnalysis: true,
      webLlmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      mobileAiModelReady: false,
      mobileInferenceEngine: 'litert-lm',
      litertModelId: 'gemma-3n-E2B-it',
      litertModelReady: false,
    });
  });

  it('round-trips saved settings, including the chosen mobile engine', () => {
    const s: AiSettings = {
      enableOnDeviceAI: true,
      allowStrengthExplanation: false,
      allowBreachImpactAnalysis: false,
      webLlmModelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
      mobileAiModelReady: true,
      mobileInferenceEngine: 'webllm',
      litertModelId: 'gemma-3n-E4B-it',
      litertModelReady: true,
    };
    saveAiSettings(s);
    expect(loadAiSettings()).toEqual(s);
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ai/__tests__/aiSettings.test.ts`
Expected: FAIL — `expect(received).toEqual(expected)` mismatches (missing `mobileInferenceEngine`/`litertModelId`/`litertModelReady` keys)

- [ ] **Step 3: Update `aiSettings.ts`**

Replace the full contents of `src/core/ai/aiSettings.ts`:

```ts
/**
 * On-device AI settings (enabled by default).
 * localStorage module — mirrors autofillSettings.ts. No Zustand.
 */
import { DEFAULT_WEBLLM_MODEL_ID } from '@/core/ai/webllmModels';
import { DEFAULT_LITERT_MODEL_ID } from '@/core/ai/litertModels';

export interface AiSettings {
  /** Master toggle for Chrome built-in AI. */
  enableOnDeviceAI: boolean;
  /** Feature toggle for the strength-explanation feature. */
  allowStrengthExplanation: boolean;
  /** Feature toggle for breach impact analysis feature. */
  allowBreachImpactAnalysis: boolean;
  /** Selected WebLLM model id (Android on-device backend). */
  webLlmModelId: string;
  /** Cached flag: WebLLM weights downloaded & usable. Verified against cache on load. */
  mobileAiModelReady: boolean;
  /** Which Android on-device engine to prefer (A/B vs. WebLLM's Adreno failure). */
  mobileInferenceEngine: 'litert-lm' | 'webllm';
  /** Selected LiteRT-LM model id (Android on-device backend). */
  litertModelId: string;
  /** Cached flag: LiteRT-LM weights downloaded & usable. Verified against cache on load. */
  litertModelReady: boolean;
}

const STORAGE_KEY = 'trustvault_ai_settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enableOnDeviceAI: true,
  allowStrengthExplanation: true,
  allowBreachImpactAnalysis: true,
  webLlmModelId: DEFAULT_WEBLLM_MODEL_ID,
  mobileAiModelReady: false,
  mobileInferenceEngine: 'litert-lm',
  litertModelId: DEFAULT_LITERT_MODEL_ID,
  litertModelReady: false,
};

export function loadAiSettings(): AiSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AiSettings>;
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load AI settings:', error);
  }
  return DEFAULT_AI_SETTINGS;
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save AI settings:', error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/ai/__tests__/aiSettings.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full AI test suite and type-check now that all the AiSettings/AiProviderId pieces exist**

Run: `npx vitest run src/core/ai/ && npm run type-check`
Expected: all tests across `src/core/ai/__tests__/**` PASS; `tsc --noEmit` reports 0 errors. If `litertProvider.ts` or `registry.ts` show type errors here (deferred from Tasks 4/5), fix them now — this is the first point all three modules' types are mutually consistent.

- [ ] **Step 6: Commit**

```bash
git add src/core/ai/aiSettings.ts src/core/ai/__tests__/aiSettings.test.ts
git commit -m "feat(ai): add mobile inference engine selection + per-engine readiness to AiSettings"
```

---

### Task 7: Settings UI — backend picker + per-engine download controls

**Files:**
- Modify: `src/presentation/components/AiAssistanceSettings.tsx`
- Test: `src/presentation/components/__tests__/AiAssistanceSettings.test.tsx` (create if no test file currently exists for this component — check first)

**Interfaces:**
- Consumes: `litertProvider`, `removeLitertModel` (Task 4); `isLitertEnabled`, `isWebllmEnabled` (Task 5); `LITERT_MODELS`, `getLitertModelById` (Task 2); `AiSettings.mobileInferenceEngine` (Task 6).

- [ ] **Step 1: Check for an existing component test**

Run: `find src/presentation/components -iname "*AiAssistanceSettings*"`
If a test file exists, read it fully before proceeding (its mocks/patterns must be matched). If none exists, proceed to Step 2 with manual verification only (matches the current state — this component has no test file today).

- [ ] **Step 2: Update the component**

Replace the full contents of `src/presentation/components/AiAssistanceSettings.tsx`:

```tsx
/**
 * AI Assistance (Experimental) settings section.
 * Chrome built-in on-device AI (desktop) plus an Android on-device A/B
 * between LiteRT-LM and WebLLM. Master toggle is disabled (and stays off)
 * when availability === 'unavailable'.
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Typography, FormControlLabel, Switch, Paper, TextField, Button, LinearProgress } from '@mui/material';
import { loadAiSettings, saveAiSettings, type AiSettings } from '@/core/ai/aiSettings';
import { getAiAvailability } from '@/core/ai/aiAvailability';
import type { AiAvailability } from '@/core/ai/aiTypes';
import { getActiveProvider } from '@/core/ai/providers/registry';
import { webllmProvider, removeWebllmModel } from '@/core/ai/providers/webllmProvider';
import { litertProvider, removeLitertModel } from '@/core/ai/providers/litertProvider';
import { isMobileAiSurfaceEnabled, isLitertEnabled, isWebllmEnabled } from '@/core/ai/providers/capabilities';
import { WEBLLM_MODELS, getModelById } from '@/core/ai/webllmModels';
import { LITERT_MODELS, getLitertModelById } from '@/core/ai/litertModels';

const AVAILABILITY_TEXT: Record<AiAvailability, string> = {
  available: 'On-device AI: available',
  downloadable: 'On-device AI: enable it in your browser first',
  downloading: 'On-device AI: downloading in your browser…',
  unavailable: 'On-device AI: not available in this browser',
};

export default function AiAssistanceSettings() {
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [availability, setAvailability] = useState<AiAvailability>('unavailable');
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    let mounted = true;
    getAiAvailability()
      .then((a) => { if (mounted) setAvailability(a); })
      .catch(() => { if (mounted) setAvailability('unavailable'); });
    getActiveProvider()
      .then((p) => { if (mounted) setActiveProviderId(p?.id ?? null); })
      .catch(() => { if (mounted) setActiveProviderId(null); });
    return () => { mounted = false; mountedRef.current = false; };
  }, []);

  const update = (patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  };

  const handleDownload = () => {
    setDownloading(true);
    setDownloadProgress(0);
    const onProgress = (p: { progress: number }) => { if (mountedRef.current) setDownloadProgress(p.progress); };
    const ready = settings.mobileInferenceEngine === 'litert-lm'
      ? litertProvider.ensureReady(onProgress).then(() => { update({ litertModelReady: true }); })
      : webllmProvider.ensureReady(onProgress).then(() => { update({ mobileAiModelReady: true }); });
    ready
      .catch(() => { /* leave the ready flag false; user can retry */ })
      .finally(() => { if (mountedRef.current) setDownloading(false); });
  };

  const handleRemove = () => {
    const removed = settings.mobileInferenceEngine === 'litert-lm'
      ? removeLitertModel().then(() => { update({ litertModelReady: false }); })
      : removeWebllmModel().then(() => { update({ mobileAiModelReady: false }); });
    removed.catch(() => { /* best-effort */ });
  };

  const bothEnginesEnabled = isLitertEnabled() && isWebllmEnabled();
  const showMobileBlock = isMobileAiSurfaceEnabled() && (activeProviderId === 'webllm' || activeProviderId === 'litert-lm');
  const isLitertEngine = settings.mobileInferenceEngine === 'litert-lm';
  const selectedWebllmModel = getModelById(settings.webLlmModelId);
  const selectedLitertModel = getLitertModelById(settings.litertModelId);
  const modelReady = isLitertEngine ? settings.litertModelReady : settings.mobileAiModelReady;
  const approxMB = isLitertEngine ? selectedLitertModel?.approxMB : selectedWebllmModel?.approxMB;

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>AI Assistance (Experimental)</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {AVAILABILITY_TEXT[availability]}
      </Typography>

      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={settings.enableOnDeviceAI}
              disabled={availability === 'unavailable'}
              onChange={(e) => {
                update(
                  e.target.checked
                    ? { enableOnDeviceAI: true }
                    : { enableOnDeviceAI: false, allowStrengthExplanation: false, allowBreachImpactAnalysis: false },
                );
              }}
            />
          }
          label="Enable on-device AI (Requires Chrome built-in, currently supported only on a Desktop and not mobile devices)"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: 1 }}>
          Uses your browser's on-device model. TrustVault never sends your passwords or secrets, and never downloads a model for you.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.allowStrengthExplanation}
              disabled={!settings.enableOnDeviceAI || availability === 'unavailable'}
              onChange={(e) => { update({ allowStrengthExplanation: e.target.checked }); }}
            />
          }
          label="Allow AI to explain password strength"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: 1 }}>
          AI receives only the strength rating and entropy estimate — never your password.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.allowBreachImpactAnalysis}
              disabled={!settings.enableOnDeviceAI || availability === 'unavailable'}
              onChange={(e) => { update({ allowBreachImpactAnalysis: e.target.checked }); }}
            />
          }
          label="Allow AI to explain breach impact and remediation"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
          AI receives only public breach data and credential metadata (like username and category) — never your password or notes.
        </Typography>
      </Box>

      {showMobileBlock && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>On-device AI model (Android)</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Downloads once from a third-party AI CDN. After that, all analysis runs locally on your device — your data never leaves it.
          </Typography>

          {bothEnginesEnabled && (
            <TextField
              select
              slotProps={{ select: { native: true } }}
              label="Inference engine"
              value={settings.mobileInferenceEngine}
              onChange={(e) => { update({ mobileInferenceEngine: e.target.value as AiSettings['mobileInferenceEngine'] }); }}
              size="small"
              sx={{ mb: 1, minWidth: 240, display: 'block' }}
            >
              <option value="litert-lm">LiteRT-LM (recommended)</option>
              <option value="webllm">WebLLM</option>
            </TextField>
          )}

          {isLitertEngine ? (
            <TextField
              select
              slotProps={{ select: { native: true } }}
              label="On-device model"
              value={settings.litertModelId}
              onChange={(e) => { update({ litertModelId: e.target.value }); }}
              size="small"
              sx={{ mb: 1, minWidth: 240, display: 'block' }}
            >
              {LITERT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </TextField>
          ) : (
            <TextField
              select
              slotProps={{ select: { native: true } }}
              label="On-device model"
              value={settings.webLlmModelId}
              onChange={(e) => { update({ webLlmModelId: e.target.value }); }}
              size="small"
              sx={{ mb: 1, minWidth: 240, display: 'block' }}
            >
              {WEBLLM_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </TextField>
          )}

          {downloading && (
            <LinearProgress
              variant="determinate"
              value={downloadProgress * 100}
              sx={{ mb: 1 }}
            />
          )}

          {!modelReady && (
            <Button variant="outlined" size="small" disabled={downloading} onClick={handleDownload}>
              Download model (~{approxMB ?? 0} MB)
            </Button>
          )}
          {modelReady && (
            <Button variant="outlined" size="small" color="error" onClick={handleRemove}>
              Remove model
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
}
```

- [ ] **Step 3: Manual verification (no automated test exists for this component today)**

Run: `npm run dev`

In a Chromium browser, open DevTools → toggle device emulation to an Android device (or temporarily set `LITERT_ANDROID_ENABLED`/`WEBLLM_ANDROID_ENABLED` both `true` in `capabilities.ts` locally to exercise the picker — revert before committing if you do this only for manual testing). Navigate to Settings → AI Assistance. Confirm:
- With only `LITERT_ANDROID_ENABLED = true` (the shipped default), the engine picker `<TextField>` does **not** render (since `bothEnginesEnabled` is false), but the model picker and download button do, labeled with LiteRT models.
- Toggling `mobileInferenceEngine` (if you temporarily enable both flags) switches the visible model dropdown and the download size between LiteRT and WebLLM catalogs.

- [ ] **Step 4: Run lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/presentation/components/AiAssistanceSettings.tsx
git commit -m "feat(ai): add LiteRT-LM/WebLLM backend picker to AI Assistance settings"
```

---

### Task 8: Documentation — security boundary, CSP comment, test status, project docs

**Files:**
- Modify: `src/config/securityHeaders.ts:19-38` (doc comment only — no origin change)
- Modify: `SECURITY.md` (§🤖 On-Device AI Boundary, line 250 area)
- Modify: `TEST_STATUS.md` (new section, mirrors the existing WebLLM Task 11 section style)
- Modify: `CLAUDE.md` (On-device AI paragraph, end of file)

**Interfaces:** None — documentation only, no code interfaces produced or consumed.

- [ ] **Step 1: Update the CSP origins doc comment**

In `src/config/securityHeaders.ts`, the comment above `WEBLLM_MODEL_ORIGINS` (lines 19-32) currently says these origins are for WebLLM only. Update it:

```ts
/**
 * Origins on-device AI fetches model weights/config from (Android: WebLLM and
 * LiteRT-LM both use these — see capabilities.ts for the per-engine
 * kill-switches). Weight download ONLY — no user data leaves the device.
 *
 * Confirmed via on-device Network-tab capture (2026-06-21, Llama-3.2-1B):
 *   - huggingface.co .............. mlc-chat-config.json, tokenizer, resolve URLs
 *   - *.xethub.hf.co / *.aws.cdn.hf.co ... weight shards (params_shard_*.bin)
 *       via HF's Xet storage backend. Shards are load-balanced across regional
 *       CDN hosts (observed: cas-bridge.xethub.hf.co, us.aws.cdn.hf.co), so we
 *       allow the two HF-controlled Xet CDN domains by wildcard rather than
 *       pinning region-specific hosts that would break downloads elsewhere.
 *       These replaced the legacy cdn-lfs*.huggingface.co LFS hosts (never hit).
 *   - raw.githubusercontent.com ... model_lib .wasm (mlc-ai/binary-mlc-llm-libs)
 *
 * LiteRT-LM's .litertlm weights resolve from the same huggingface.co/Xet hosts
 * (litert-community / google orgs on HF) — no additional origin was needed.
 * LiteRT-LM's own WASM *runtime* (as opposed to model weights) is NOT fetched
 * from any of these — it is self-hosted same-origin under public/litert/ (see
 * scripts/copy-litert-assets.js) specifically to avoid adding the package's
 * default https://cdn.jsdelivr.net dependency to this allowlist.
 */
export const WEBLLM_MODEL_ORIGINS = [
```

(Leave the constant name and the array itself unchanged — renaming it is optional per the design spec and not required for correctness; this plan keeps the rename out of scope to avoid touching every import site for no functional benefit.)

- [ ] **Step 2: Run the CSP parity test to confirm no drift**

Run: `npx vitest run src/config/__tests__/securityHeaders.test.ts`
Expected: PASS (comment-only change; the exported array values are unchanged, so `vercel.json` parity holds)

- [ ] **Step 3: Update `SECURITY.md`**

Open `SECURITY.md` at the `## 🤖 On-Device AI Boundary` section (line 250). Add a new paragraph immediately after the existing WebLLM/Chrome-builtin description (read the surrounding 20 lines first to match heading level and tone), stating:

```markdown
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
```

- [ ] **Step 4: Add a `TEST_STATUS.md` section**

Add a new section near the top of `TEST_STATUS.md`, above the existing `## WebLLM Android — DISABLED...` section (so the most recent work is most visible), matching that section's heading style:

```markdown
## LiteRT-LM Android — A/B added against the WebLLM Adreno failure — June 21, 2026

**Decision: `LITERT_ANDROID_ENABLED = true`** (new kill-switch, `capabilities.ts`) — a third
`AiProvider`, `litert-lm`, was added to test whether Google's LiteRT-LM runtime (the
actively-supported successor to MediaPipe LLM Inference) survives the same Qualcomm Adreno
`VK_ERROR_DEVICE_LOST` failure that forced WebLLM's Android surface off (see the section below).
LiteRT-LM's web target shares the WebGPU/Dawn stack implicated in that failure, so this is
explicitly an open question, not a presumed fix.

**Still required — on-device verification (not yet run):**
- [ ] Device 1 (Adreno 6xx / Android 10): download a LiteRT-LM model, trigger "Explain with AI",
  record whether `Engine.create()` / first generation survives or reproduces device-loss.
- [ ] Device 2 (Adreno 810 / SD 7s Gen 3 / Android 16): same test.
- [ ] Direct comparison: flip `mobileInferenceEngine` to `'webllm'` on the same device/model tier
  and confirm the existing WebLLM failure still reproduces (control for the A/B).
- [ ] Record outcome here and update `LITERT_ANDROID_ENABLED` / `WEBLLM_ANDROID_ENABLED` based on
  the result.

**Implementation notes:**
- WASM runtime self-hosted under `public/litert/` (`scripts/copy-litert-assets.js`) — the
  `@litert-lm/core` package defaults to fetching ~37MB from `cdn.jsdelivr.net`, which this
  project does not allowlist (CSP/no-CDN-egress convention, same as Tesseract OCR).
- Model weights resolve from the same HuggingFace origins already allowlisted for WebLLM — no
  new CSP `connect-src` exception.
- Settings → AI Assistance gains a LiteRT-LM/WebLLM picker, shown only when both engines' flags
  are enabled (currently only LiteRT-LM is on, so the picker is hidden in the shipped state).
```

- [ ] **Step 5: Update `CLAUDE.md`**

In `CLAUDE.md`, in the long On-device AI bullet near the end of the Security Notes section, append a sentence after the existing "Android WebLLM surface is currently DISABLED..." sentence (find it via the text `WEBLLM_ANDROID_ENABLED = false` in `capabilities.ts`):

```markdown
A third provider, **LiteRT-LM** (`litert-lm`, `@litert-lm/core`), was added 2026-06-21 behind its own `LITERT_ANDROID_ENABLED` kill-switch (on by default) to A/B test whether Google's actively-supported runtime survives the same Adreno failure — it shares the WebGPU/Dawn stack implicated in WebLLM's crash, so this is an open question pending on-device verification (see `TEST_STATUS.md`). Its WASM runtime is self-hosted under `public/litert/` (`scripts/copy-litert-assets.js`) rather than the package's default `cdn.jsdelivr.net` fetch, to avoid a new CDN-egress CSP exception. Settings gains a LiteRT-LM/WebLLM picker, hidden unless both engines are enabled.
```

Update the **Last Updated** line at the bottom of `CLAUDE.md` to prepend this work, following the file's existing changelog-in-one-line convention.

- [ ] **Step 6: Run the full test suite, lint, and type-check one final time**

Run: `npm run type-check && npm run lint && npm run test:run`
Expected: 0 type errors, 0 lint errors, all tests pass (existing suite count + the new tests added across Tasks 2–6).

- [ ] **Step 7: Commit**

```bash
git add src/config/securityHeaders.ts SECURITY.md TEST_STATUS.md CLAUDE.md
git commit -m "docs: document LiteRT-LM A/B provider, self-hosted WASM runtime, and pending on-device verification"
```

---

## Manual on-device verification (outside this plan's automated scope)

This plan delivers working, type-checked, tested code on desktop CI. It does **not** and cannot resolve the actual research question — whether LiteRT-LM survives the Adreno `VK_ERROR_DEVICE_LOST` failure — because that requires the two physical devices referenced throughout. After all 8 tasks are merged:

1. Deploy/preview the build on the two known Adreno devices.
2. Follow the checklist added to `TEST_STATUS.md` in Task 8, Step 4.
3. Record the outcome in `TEST_STATUS.md` and decide whether `LITERT_ANDROID_ENABLED` stays `true`.
