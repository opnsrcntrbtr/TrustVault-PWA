# Android WebLLM Provider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing on-device AI features (password-strength explanation + breach-impact analysis) to Android by adding a WebLLM (WebGPU) inference backend behind a provider abstraction, with desktop Chrome behavior unchanged.

**Architecture:** Generalize `promptApi.ts` (currently "the only module that calls inference") into an `AiProvider` interface. `chromeBuiltinProvider` wraps the current Gemini-Nano logic; `webllmProvider` wraps WebLLM's `MLCEngine` (lazy-imported). A registry selects the active provider: Chrome built-in when available, else WebLLM when WebGPU is present and the mobile surface is feature-enabled. Model weights download once from the MLC/Hugging Face CDN, triggered explicitly from Settings.

**Tech Stack:** TypeScript 5.7 (strict), React 19, Vite 6.4, Vitest + Testing Library, `@mlc-ai/web-llm`, WebGPU, localStorage settings.

## Global Constraints

- TypeScript strict mode: no `any`, null-safe (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). — verbatim from tsconfig.
- Heavy WASM/UMD libs: lazy dynamic import only, never top-level; exclude from `optimizeDeps` in `vite.config.ts`. — CLAUDE.md Rule 1.
- React 19 effects: `mounted` flag + cleanup; timeout fallbacks ≤2s for async init. — CLAUDE.md Rule 2.
- Settings persistence: localStorage module pattern (mirrors `autofillSettings.ts`), no Zustand. — `aiSettings.ts` header.
- CSP is dual-source: any `connect-src` change MUST update BOTH `src/config/securityHeaders.ts` AND `vercel.json`; the parity test `src/config/__tests__/securityHeaders.test.ts` enforces this. — CLAUDE.md S2.
- Path aliases: import via `@/` not relative `../../`.
- Zero-knowledge boundary: prompts stay secret-free; never send password/keys/notes/TOTP. Prompt builders (`strengthExplain.ts`, `breachImpactExplain.ts`) are NOT modified.
- Lint: `npm run lint` must stay at 0 errors; `npm run type-check` 0 errors before each commit.
- No sensitive data logged (prod uses `drop_console: true`).
- Mobile UI surface (WebLLM download UI) is feature-flagged ON for Android only in v1; capability detection itself stays platform-honest.

---

## File Structure

```
src/core/ai/
├── providers/
│   ├── types.ts                  # CREATE: AiProvider, AiProviderId, AiDownloadProgress
│   ├── capabilities.ts           # CREATE: hasWebGpu(), isAndroid(), isMobileAiSurfaceEnabled()
│   ├── chromeBuiltinProvider.ts  # CREATE: relocated Gemini-Nano session-cache logic
│   ├── webllmProvider.ts         # CREATE: MLCEngine wrapper (lazy import)
│   └── registry.ts               # CREATE: active-provider selection + cache
├── webllmModels.ts               # CREATE: model catalog (small default / mid)
├── promptApi.ts                  # MODIFY: delegate to registry; keep public API
├── aiAvailability.ts             # MODIFY: getAiAvailability delegates to registry
├── aiSettings.ts                 # MODIFY: + webLlmModelId, mobileAiModelReady
├── aiTypes.ts                    # unchanged (reuse AiAvailability)
├── strengthExplain.ts            # unchanged
├── breachImpactExplain.ts        # unchanged
└── __tests__/
    ├── promptApi.test.ts         # MODIFY: assert delegation; keep chrome regression
    ├── providers/
    │   ├── chromeBuiltinProvider.test.ts  # CREATE
    │   ├── webllmProvider.test.ts         # CREATE
    │   ├── registry.test.ts               # CREATE
    │   └── capabilities.test.ts           # CREATE
    └── webllmModels.test.ts      # CREATE

src/config/
├── securityHeaders.ts            # MODIFY: + WEBLLM_MODEL_ORIGINS in connect-src
└── __tests__/securityHeaders.test.ts  # (auto-validates; may need expected-string update)

src/presentation/components/
├── AiAssistanceSettings.tsx      # MODIFY: download UI, model picker, progress, remove
└── __tests__/AiAssistanceSettings.test.tsx  # MODIFY: new tests

vercel.json                       # MODIFY: mirror connect-src
vite.config.ts                    # MODIFY: optimizeDeps.exclude @mlc-ai/web-llm
package.json                      # MODIFY: add @mlc-ai/web-llm dependency
docs/ (SECURITY.md, CLAUDE.md, SECURITY_AUDIT_REPORT.md)  # MODIFY
```

---

## Task 1: Provider types & capability helpers

**Files:**
- Create: `src/core/ai/providers/types.ts`
- Create: `src/core/ai/providers/capabilities.ts`
- Test: `src/core/ai/__tests__/providers/capabilities.test.ts`

**Interfaces:**
- Produces:
  - `type AiProviderId = 'chrome-builtin' | 'webllm'`
  - `interface AiDownloadProgress { progress: number; text?: string }`
  - `interface AiProvider { readonly id: AiProviderId; getAvailability(): Promise<AiAvailability>; ensureReady(onProgress?: (p: AiDownloadProgress) => void): Promise<void>; warmUp(systemPrompt: string): Promise<void>; runStreaming(args: { systemPrompt: string; userPrompt: string; signal?: AbortSignal }): AsyncIterableIterator<string> }`
  - `hasWebGpu(): Promise<boolean>`
  - `isAndroid(): boolean`
  - `isMobileAiSurfaceEnabled(): boolean`

- [ ] **Step 1: Write `providers/types.ts`**

```ts
/**
 * Provider abstraction for on-device AI inference backends.
 * Generalizes the former single-backend promptApi.ts so the inference
 * engine (Chrome built-in vs WebLLM) is swappable behind one interface.
 */
import type { AiAvailability } from '@/core/ai/aiTypes';

export type AiProviderId = 'chrome-builtin' | 'webllm';

export interface AiDownloadProgress {
  /** Normalized 0..1 download/initialization progress. */
  progress: number;
  /** Optional human-readable status, e.g. "Fetching weights". */
  text?: string;
}

export interface AiProvider {
  readonly id: AiProviderId;
  /** Cheap, read-only capability probe. MUST NOT trigger a download. */
  getAvailability(): Promise<AiAvailability>;
  /** Ensure the model is usable. No-op for chrome-builtin; downloads for webllm. */
  ensureReady(onProgress?: (p: AiDownloadProgress) => void): Promise<void>;
  /** Prime a base session/engine for a system prompt (latency optimization). */
  warmUp(systemPrompt: string): Promise<void>;
  /** Stream a completion as text chunks. */
  runStreaming(args: {
    systemPrompt: string;
    userPrompt: string;
    signal?: AbortSignal;
  }): AsyncIterableIterator<string>;
}
```

- [ ] **Step 2: Write the failing test for capabilities**

```ts
// src/core/ai/__tests__/providers/capabilities.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { hasWebGpu, isAndroid, isMobileAiSurfaceEnabled } from '@/core/ai/providers/capabilities';

const setNav = (patch: Record<string, unknown>) => {
  Object.entries(patch).forEach(([k, v]) => {
    Object.defineProperty(globalThis.navigator, k, { value: v, configurable: true });
  });
};

describe('capabilities', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('hasWebGpu() is false when navigator.gpu is missing', async () => {
    setNav({ gpu: undefined });
    expect(await hasWebGpu()).toBe(false);
  });

  it('hasWebGpu() is true when an adapter is returned', async () => {
    setNav({ gpu: { requestAdapter: vi.fn().mockResolvedValue({}) } });
    expect(await hasWebGpu()).toBe(true);
  });

  it('hasWebGpu() is false when requestAdapter returns null', async () => {
    setNav({ gpu: { requestAdapter: vi.fn().mockResolvedValue(null) } });
    expect(await hasWebGpu()).toBe(false);
  });

  it('isAndroid() detects Android user agents', () => {
    setNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/148' });
    expect(isAndroid()).toBe(true);
    setNav({ userAgent: 'Mozilla/5.0 (Macintosh) Chrome/148' });
    expect(isAndroid()).toBe(false);
  });

  it('isMobileAiSurfaceEnabled() mirrors isAndroid() in v1', () => {
    setNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
    expect(isMobileAiSurfaceEnabled()).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/core/ai/__tests__/providers/capabilities.test.ts`
Expected: FAIL — cannot resolve `@/core/ai/providers/capabilities`.

- [ ] **Step 4: Write `providers/capabilities.ts`**

```ts
/**
 * Platform/hardware capability probes for on-device AI provider selection.
 * WebGPU detection is the real gate; isAndroid()/surface flag scope the v1 UI.
 */

/** True only if a WebGPU adapter can actually be acquired. */
export async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu || typeof gpu.requestAdapter !== 'function') return false;
  try {
    const adapter = await gpu.requestAdapter();
    return adapter != null;
  } catch {
    return false;
  }
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * v1 feature flag: the WebLLM download UI is surfaced only on Android.
 * Capability detection (hasWebGpu) stays platform-honest; this only gates UI.
 */
export function isMobileAiSurfaceEnabled(): boolean {
  return isAndroid();
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/core/ai/__tests__/providers/capabilities.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/core/ai/providers/types.ts src/core/ai/providers/capabilities.ts src/core/ai/__tests__/providers/capabilities.test.ts
git add src/core/ai/providers/types.ts src/core/ai/providers/capabilities.ts src/core/ai/__tests__/providers/capabilities.test.ts
git commit -m "feat(ai): add provider interface and capability probes"
```

---

## Task 2: chromeBuiltinProvider (relocate Gemini-Nano logic)

**Files:**
- Create: `src/core/ai/providers/chromeBuiltinProvider.ts`
- Test: `src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts`

**Interfaces:**
- Consumes: `AiProvider`, `AiDownloadProgress` (Task 1).
- Produces: `export const chromeBuiltinProvider: AiProvider` and `export function __clearChromeSessionCacheForTesting(): void`.

This relocates the current `promptApi.ts` internals: the `AiSession` interface, `getLanguageModel()`, the `baseSessions`/`initializingSessions` cache, `warmUpAi`, `getClonedSession`, and the streaming loop. `getAvailability()` absorbs the raw `LanguageModel.availability()` probe currently in `aiAvailability.ts`. `ensureReady()` is a no-op (never-download policy).

- [ ] **Step 1: Write the failing test**

```ts
// src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { chromeBuiltinProvider, __clearChromeSessionCacheForTesting } from '@/core/ai/providers/chromeBuiltinProvider';

function setLanguageModel(value: unknown) {
  (globalThis as Record<string, unknown>).LanguageModel = value;
}
function streamOf(chunks: string[]) {
  return (function* () { for (const c of chunks) yield c; })();
}
async function collect(it: AsyncIterableIterator<string>) {
  let s = ''; for await (const c of it) s += c; return s;
}

describe('chromeBuiltinProvider', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    vi.restoreAllMocks();
    __clearChromeSessionCacheForTesting();
  });

  it('id is chrome-builtin', () => {
    expect(chromeBuiltinProvider.id).toBe('chrome-builtin');
  });

  it('getAvailability returns unavailable when global absent', async () => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    expect(await chromeBuiltinProvider.getAvailability()).toBe('unavailable');
  });

  it('getAvailability reflects LanguageModel.availability()', async () => {
    setLanguageModel({ availability: vi.fn().mockResolvedValue('available'), create: vi.fn() });
    expect(await chromeBuiltinProvider.getAvailability()).toBe('available');
  });

  it('runStreaming clones the warmed base session, streams, and destroys the clone', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn().mockReturnValue(streamOf(['Hello ', 'world']));
    const clone = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    const create = vi.fn().mockResolvedValue({ clone, destroy });
    setLanguageModel({ create, availability: vi.fn().mockResolvedValue('available') });

    const text = await collect(chromeBuiltinProvider.runStreaming({ systemPrompt: 'sys', userPrompt: 'u' }));

    expect(text).toBe('Hello world');
    expect(create).toHaveBeenCalledWith({ initialPrompts: [{ role: 'system', content: 'sys' }] });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('warmUp creates the base session only once per system prompt', async () => {
    const create = vi.fn().mockResolvedValue({ clone: vi.fn(), destroy: vi.fn() });
    setLanguageModel({ create, availability: vi.fn() });
    await chromeBuiltinProvider.warmUp('sys');
    await chromeBuiltinProvider.warmUp('sys');
    expect(create).toHaveBeenCalledOnce();
  });

  it('runStreaming falls back to create() when clone() is absent', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn().mockReturnValue(streamOf(['ok']));
    const create = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    setLanguageModel({ create, availability: vi.fn() });
    const text = await collect(chromeBuiltinProvider.runStreaming({ systemPrompt: 'sys', userPrompt: 'u' }));
    expect(text).toBe('ok');
    expect(create).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('ensureReady resolves without calling create (never-download)', async () => {
    const create = vi.fn();
    setLanguageModel({ create, availability: vi.fn() });
    await expect(chromeBuiltinProvider.ensureReady()).resolves.toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write `providers/chromeBuiltinProvider.ts`**

```ts
/**
 * Chrome built-in AI provider — wraps the global `LanguageModel` (Gemini Nano).
 * THE ONLY module that calls LanguageModel.create()/promptStreaming().
 * Desktop-only; never downloads a model (ensureReady is a no-op).
 */
import type { AiAvailability } from '@/core/ai/aiTypes';
import type { AiProvider } from '@/core/ai/providers/types';

interface AiSession {
  promptStreaming(input: string, opts?: { signal?: AbortSignal }): AsyncIterable<string>;
  clone?(): Promise<AiSession>;
  destroy(): void;
}
interface LanguageModelStatic {
  create(opts: { initialPrompts: Array<{ role: 'system'; content: string }> }): Promise<AiSession>;
  availability(): Promise<AiAvailability>;
}

function getLanguageModel(): LanguageModelStatic {
  const lm = (globalThis as Record<string, unknown>).LanguageModel as LanguageModelStatic | undefined;
  if (!lm || typeof lm.create !== 'function') {
    throw new Error('Chrome built-in AI (LanguageModel) is not available');
  }
  return lm;
}

const baseSessions = new Map<string, AiSession>();
const initializingSessions = new Map<string, Promise<AiSession>>();

export function __clearChromeSessionCacheForTesting(): void {
  baseSessions.clear();
  initializingSessions.clear();
}

async function warmUp(systemPrompt: string): Promise<void> {
  if (baseSessions.has(systemPrompt)) return;
  if (initializingSessions.has(systemPrompt)) { await initializingSessions.get(systemPrompt); return; }
  const lm = getLanguageModel();
  const initPromise = lm.create({ initialPrompts: [{ role: 'system', content: systemPrompt }] })
    .then((session) => { baseSessions.set(systemPrompt, session); initializingSessions.delete(systemPrompt); return session; })
    .catch((err: unknown) => { initializingSessions.delete(systemPrompt); throw err; });
  initializingSessions.set(systemPrompt, initPromise);
  await initPromise;
}

async function getClonedSession(systemPrompt: string): Promise<AiSession> {
  await warmUp(systemPrompt);
  const baseSession = baseSessions.get(systemPrompt);
  if (!baseSession) throw new Error('Failed to warm up base session');
  if (typeof baseSession.clone === 'function') return await baseSession.clone();
  const lm = getLanguageModel();
  return await lm.create({ initialPrompts: [{ role: 'system', content: systemPrompt }] });
}

async function* runStreaming(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
}): AsyncIterableIterator<string> {
  const session = await getClonedSession(args.systemPrompt);
  try {
    const opts = args.signal ? { signal: args.signal } : undefined;
    for await (const chunk of session.promptStreaming(args.userPrompt, opts)) {
      yield chunk;
    }
  } finally {
    session.destroy();
  }
}

export const chromeBuiltinProvider: AiProvider = {
  id: 'chrome-builtin',
  async getAvailability(): Promise<AiAvailability> {
    const lm = (globalThis as Record<string, unknown>).LanguageModel as LanguageModelStatic | undefined;
    if (!lm || typeof lm.availability !== 'function') return 'unavailable';
    try { return await lm.availability(); } catch { return 'unavailable'; }
  },
  ensureReady(): Promise<void> { return Promise.resolve(); },
  warmUp,
  runStreaming,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/core/ai/providers/chromeBuiltinProvider.ts src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts
git add src/core/ai/providers/chromeBuiltinProvider.ts src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts
git commit -m "feat(ai): add chromeBuiltinProvider (relocated Gemini-Nano logic)"
```

---

## Task 3: Registry + promptApi/aiAvailability delegation

**Files:**
- Create: `src/core/ai/providers/registry.ts`
- Test: `src/core/ai/__tests__/providers/registry.test.ts`
- Modify: `src/core/ai/promptApi.ts` (replace internals with delegation)
- Modify: `src/core/ai/aiAvailability.ts` (delegate `getAiAvailability`)
- Modify: `src/core/ai/__tests__/promptApi.test.ts` (assert delegation)

**Interfaces:**
- Consumes: `chromeBuiltinProvider` (Task 2), `hasWebGpu`/`isMobileAiSurfaceEnabled` (Task 1).
- Produces:
  - `getActiveProvider(): Promise<AiProvider | null>`
  - `__setActiveProviderForTesting(p: AiProvider | null): void`
  - `__resetRegistryForTesting(): void`
  - `promptApi` keeps `runPrompt`, `runPromptStreaming`, `warmUpAi`, `__clearSessionCacheForTesting`.
  - `aiAvailability` keeps `getAiAvailability`, `isFeatureUsable`.

> Note: `webllmProvider` is added to selection in Task 6. For now the registry only knows `chromeBuiltinProvider`; the WebLLM branch is wired later. This keeps Task 3 a pure no-behavior-change refactor.

- [ ] **Step 1: Write the failing registry test**

```ts
// src/core/ai/__tests__/providers/registry.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { getActiveProvider, __resetRegistryForTesting } from '@/core/ai/providers/registry';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';

describe('registry.getActiveProvider', () => {
  afterEach(() => { __resetRegistryForTesting(); vi.restoreAllMocks(); });

  it('selects chrome-builtin when its availability is available', async () => {
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('available');
    const p = await getActiveProvider();
    expect(p?.id).toBe('chrome-builtin');
  });

  it('returns null when chrome unavailable and no WebGPU', async () => {
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('unavailable');
    Object.defineProperty(globalThis.navigator, 'gpu', { value: undefined, configurable: true });
    const p = await getActiveProvider();
    expect(p).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ai/__tests__/providers/registry.test.ts`
Expected: FAIL — cannot resolve `registry`.

- [ ] **Step 3: Write `providers/registry.ts`**

```ts
/**
 * Active-provider selection. Prefers Chrome built-in when available; otherwise
 * falls back to WebLLM when WebGPU is present and the mobile surface is enabled.
 * (WebLLM branch wired in Task 6.)
 */
import type { AiProvider } from '@/core/ai/providers/types';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';
import { hasWebGpu, isMobileAiSurfaceEnabled } from '@/core/ai/providers/capabilities';

let cached: AiProvider | null | undefined;
let override: AiProvider | null | undefined;

export function __setActiveProviderForTesting(p: AiProvider | null): void { override = p; }
export function __resetRegistryForTesting(): void { cached = undefined; override = undefined; }

export async function getActiveProvider(): Promise<AiProvider | null> {
  if (override !== undefined) return override;
  if (cached !== undefined) return cached;

  const chromeAvail = await chromeBuiltinProvider.getAvailability();
  if (chromeAvail === 'available') { cached = chromeBuiltinProvider; return cached; }

  // WebLLM fallback (wired in Task 6). Until then, only enable when WebGPU +
  // mobile surface are present so selection logic is testable.
  if (isMobileAiSurfaceEnabled() && (await hasWebGpu())) {
    cached = null; // placeholder until webllmProvider is registered
    return cached;
  }
  cached = null;
  return cached;
}
```

- [ ] **Step 4: Run registry test to verify it passes**

Run: `npx vitest run src/core/ai/__tests__/providers/registry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Rewrite `promptApi.ts` to delegate**

Replace the ENTIRE contents of `src/core/ai/promptApi.ts` with:

```ts
/**
 * Public inference API. Delegates to the active provider (registry).
 * Kept as a stable facade so feature modules/hooks don't import providers directly.
 */
import { getActiveProvider } from '@/core/ai/providers/registry';
import { chromeBuiltinProvider, __clearChromeSessionCacheForTesting } from '@/core/ai/providers/chromeBuiltinProvider';

/** Test seam retained for back-compat with existing suites. */
export function __clearSessionCacheForTesting(): void {
  __clearChromeSessionCacheForTesting();
}

export async function warmUpAi(systemPrompt: string): Promise<void> {
  const provider = await getActiveProvider();
  if (!provider) return;
  await provider.warmUp(systemPrompt);
}

export async function* runPromptStreaming(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
}): AsyncIterableIterator<string> {
  const provider = await getActiveProvider();
  if (!provider) throw new Error('No on-device AI provider available');
  yield* provider.runStreaming(args);
}

export async function runPrompt(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
}): Promise<string> {
  let text = '';
  for await (const chunk of runPromptStreaming(args)) text += chunk;
  return text;
}

// Re-export so `getActiveProvider()` fallback (Task 6) and tests can reach the
// chrome provider directly when needed.
export { chromeBuiltinProvider };
```

- [ ] **Step 6: Update `promptApi.test.ts` to assert delegation**

Replace the ENTIRE contents of `src/core/ai/__tests__/promptApi.test.ts` with:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { runPrompt, runPromptStreaming } from '@/core/ai/promptApi';
import { __setActiveProviderForTesting, __resetRegistryForTesting } from '@/core/ai/providers/registry';
import type { AiProvider } from '@/core/ai/providers/types';

function fakeProvider(chunks: string[]): AiProvider {
  return {
    id: 'chrome-builtin',
    getAvailability: vi.fn().mockResolvedValue('available'),
    ensureReady: vi.fn().mockResolvedValue(undefined),
    warmUp: vi.fn().mockResolvedValue(undefined),
    runStreaming: async function* () { for (const c of chunks) yield c; },
  };
}

describe('promptApi delegation', () => {
  afterEach(() => { __resetRegistryForTesting(); vi.restoreAllMocks(); });

  it('runPrompt concatenates streamed chunks from the active provider', async () => {
    __setActiveProviderForTesting(fakeProvider(['Hello ', 'world']));
    expect(await runPrompt({ systemPrompt: 's', userPrompt: 'u' })).toBe('Hello world');
  });

  it('runPromptStreaming yields chunks from the active provider', async () => {
    __setActiveProviderForTesting(fakeProvider(['a', 'b']));
    let out = ''; for await (const c of runPromptStreaming({ systemPrompt: 's', userPrompt: 'u' })) out += c;
    expect(out).toBe('ab');
  });

  it('throws when no provider is active', async () => {
    __setActiveProviderForTesting(null);
    await expect(runPrompt({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/no on-device ai provider/i);
  });
});
```

- [ ] **Step 7: Update `aiAvailability.ts` to delegate**

Replace the ENTIRE contents of `src/core/ai/aiAvailability.ts` with:

```ts
/**
 * Availability facade. Reports the ACTIVE provider's availability so hooks and
 * Settings keep their current `getAiAvailability()` / `isFeatureUsable()` API.
 */
import type { AiAvailability } from '@/core/ai/aiTypes';
import { getActiveProvider } from '@/core/ai/providers/registry';

export async function getAiAvailability(): Promise<AiAvailability> {
  const provider = await getActiveProvider();
  if (!provider) return 'unavailable';
  return provider.getAvailability();
}

/** Feature may run only when the active provider is fully ready. */
export function isFeatureUsable(availability: AiAvailability): boolean {
  return availability === 'available';
}
```

- [ ] **Step 8: Run the full AI suite to verify no regression**

Run: `npx vitest run src/core/ai src/presentation/hooks src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`
Expected: PASS. If `AiAssistanceSettings.test.tsx` or hook tests mocked `getAiAvailability` directly, they still work (it's still exported). Fix any test that imported now-removed internals (e.g. old `__clearSessionCacheForTesting` from promptApi still exists; `getLanguageModel` was never exported).

- [ ] **Step 9: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/core/ai
git add src/core/ai
git commit -m "refactor(ai): route promptApi/aiAvailability through provider registry"
```

---

## Task 4: AI settings additions + model catalog

**Files:**
- Modify: `src/core/ai/aiSettings.ts`
- Create: `src/core/ai/webllmModels.ts`
- Test: `src/core/ai/__tests__/webllmModels.test.ts`
- Modify: `src/core/ai/__tests__/aiSettings.test.ts`

**Interfaces:**
- Produces:
  - `AiSettings` gains `webLlmModelId: string` and `mobileAiModelReady: boolean`.
  - `WEBLLM_MODELS: ReadonlyArray<{ id: string; label: string; tier: 'small' | 'mid'; approxMB: number }>`
  - `DEFAULT_WEBLLM_MODEL_ID: string`
  - `getModelById(id: string): WebLlmModel | undefined`

- [ ] **Step 1: Write the failing test for the model catalog**

```ts
// src/core/ai/__tests__/webllmModels.test.ts
import { describe, it, expect } from 'vitest';
import { WEBLLM_MODELS, DEFAULT_WEBLLM_MODEL_ID, getModelById } from '@/core/ai/webllmModels';

describe('webllmModels', () => {
  it('has at least one small and one mid model', () => {
    expect(WEBLLM_MODELS.some(m => m.tier === 'small')).toBe(true);
    expect(WEBLLM_MODELS.some(m => m.tier === 'mid')).toBe(true);
  });
  it('default model id exists in the catalog and is small tier', () => {
    const def = getModelById(DEFAULT_WEBLLM_MODEL_ID);
    expect(def).toBeDefined();
    expect(def?.tier).toBe('small');
  });
  it('getModelById returns undefined for unknown ids', () => {
    expect(getModelById('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ai/__tests__/webllmModels.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write `webllmModels.ts`**

> The `id` strings MUST be valid `model_id` values from the installed `@mlc-ai/web-llm` `prebuiltAppConfig.model_list`. Verify against `node_modules/@mlc-ai/web-llm` at implementation time; the values below are the expected current ids.

```ts
/**
 * Catalog of WebLLM prebuilt models offered on Android.
 * `id` must match @mlc-ai/web-llm prebuiltAppConfig model ids.
 */
export interface WebLlmModel {
  id: string;
  label: string;
  tier: 'small' | 'mid';
  approxMB: number;
}

export const WEBLLM_MODELS: ReadonlyArray<WebLlmModel> = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Small — Llama 3.2 1B', tier: 'small', approxMB: 720 },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Small — Qwen2.5 1.5B', tier: 'small', approxMB: 940 },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Mid — Gemma 2 2B', tier: 'mid', approxMB: 1900 },
];

export const DEFAULT_WEBLLM_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export function getModelById(id: string): WebLlmModel | undefined {
  return WEBLLM_MODELS.find((m) => m.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/ai/__tests__/webllmModels.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Extend `AiSettings` in `aiSettings.ts`**

In `src/core/ai/aiSettings.ts`, add the import and two fields. Modify the `AiSettings` interface and `DEFAULT_AI_SETTINGS`:

```ts
import { DEFAULT_WEBLLM_MODEL_ID } from '@/core/ai/webllmModels';
```

Add to the `AiSettings` interface (after `allowBreachImpactAnalysis`):

```ts
  /** Selected WebLLM model id (Android on-device backend). */
  webLlmModelId: string;
  /** Cached flag: WebLLM weights downloaded & usable. Verified against cache on load. */
  mobileAiModelReady: boolean;
```

Add to `DEFAULT_AI_SETTINGS`:

```ts
  webLlmModelId: DEFAULT_WEBLLM_MODEL_ID,
  mobileAiModelReady: false,
```

(The existing `loadAiSettings` spread `{ ...DEFAULT_AI_SETTINGS, ...parsed }` auto-migrates older stored objects.)

- [ ] **Step 6: Update `aiSettings.test.ts`**

In `src/core/ai/__tests__/aiSettings.test.ts`, update the `DEFAULT_AI_SETTINGS` equality and the round-trip object to include the two new fields:

```ts
    expect(DEFAULT_AI_SETTINGS).toEqual({
      enableOnDeviceAI: true,
      allowStrengthExplanation: true,
      allowBreachImpactAnalysis: true,
      webLlmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      mobileAiModelReady: false,
    });
```

And in the round-trip test object add `webLlmModelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', mobileAiModelReady: true`.
And in the "merges partial stored settings" test, add the two defaults to the expected object.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/core/ai/__tests__/webllmModels.test.ts src/core/ai/__tests__/aiSettings.test.ts`
Expected: PASS.

- [ ] **Step 8: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/core/ai/webllmModels.ts src/core/ai/aiSettings.ts src/core/ai/__tests__/webllmModels.test.ts src/core/ai/__tests__/aiSettings.test.ts
git add src/core/ai/webllmModels.ts src/core/ai/aiSettings.ts src/core/ai/__tests__/webllmModels.test.ts src/core/ai/__tests__/aiSettings.test.ts
git commit -m "feat(ai): add WebLLM model catalog and settings fields"
```

---

## Task 5: Install WebLLM + webllmProvider wrapper

**Files:**
- Modify: `package.json` (dependency)
- Modify: `vite.config.ts` (`optimizeDeps.exclude`)
- Create: `src/core/ai/providers/webllmProvider.ts`
- Test: `src/core/ai/__tests__/providers/webllmProvider.test.ts`

**Interfaces:**
- Consumes: `AiProvider`, `AiDownloadProgress` (Task 1), `hasWebGpu` (Task 1), `loadAiSettings` + `getModelById` (Task 4).
- Produces: `export const webllmProvider: AiProvider` and `export function __resetWebllmEngineForTesting(): void`.

- [ ] **Step 1: Install the dependency**

Run: `npm install @mlc-ai/web-llm`
Expected: added to `dependencies` in `package.json`; `package-lock.json` updated.

- [ ] **Step 2: Exclude from optimizeDeps**

In `src/.../vite.config.ts`, add (create the `optimizeDeps` key if absent, sibling to `build`):

```ts
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
  },
```

- [ ] **Step 3: Write the failing test (engine fully mocked)**

```ts
// src/core/ai/__tests__/providers/webllmProvider.test.ts
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

const create = vi.fn();
const engine = {
  chat: { completions: { create: vi.fn() } },
  interruptGenerate: vi.fn(),
  resetChat: vi.fn().mockResolvedValue(undefined),
  unload: vi.fn().mockResolvedValue(undefined),
};

// Mock the lazy-imported library.
vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: (...args: unknown[]) => create(...args),
}));
// Force WebGPU present + a known model.
vi.mock('@/core/ai/providers/capabilities', () => ({
  hasWebGpu: vi.fn().mockResolvedValue(true),
  isAndroid: () => true,
  isMobileAiSurfaceEnabled: () => true,
}));
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: () => ({ webLlmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', mobileAiModelReady: true }),
  saveAiSettings: vi.fn(),
}));

import { webllmProvider, __resetWebllmEngineForTesting } from '@/core/ai/providers/webllmProvider';

function deltaStream(parts: string[]) {
  return (async function* () {
    for (const p of parts) yield { choices: [{ delta: { content: p } }] };
  })();
}

describe('webllmProvider', () => {
  beforeEach(() => { create.mockResolvedValue(engine); });
  afterEach(() => { __resetWebllmEngineForTesting(); vi.clearAllMocks(); });

  it('id is webllm', () => { expect(webllmProvider.id).toBe('webllm'); });

  it('ensureReady creates the engine once and reports progress', async () => {
    const onProgress = vi.fn();
    create.mockImplementation((_id: string, opts: { initProgressCallback?: (r: { progress: number; text: string }) => void }) => {
      opts.initProgressCallback?.({ progress: 0.5, text: 'half' });
      return Promise.resolve(engine);
    });
    await webllmProvider.ensureReady(onProgress);
    await webllmProvider.ensureReady(onProgress);
    expect(create).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({ progress: 0.5, text: 'half' });
  });

  it('runStreaming maps system+user prompts to messages and yields deltas', async () => {
    engine.chat.completions.create.mockResolvedValue(deltaStream(['He', 'llo']));
    let out = '';
    for await (const c of webllmProvider.runStreaming({ systemPrompt: 'sys', userPrompt: 'u' })) out += c;
    expect(out).toBe('Hello');
    expect(engine.resetChat).toHaveBeenCalled();
    expect(engine.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: true,
        messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'u' }],
      }),
    );
  });

  it('runStreaming interrupts generation when the signal aborts', async () => {
    const controller = new AbortController();
    engine.chat.completions.create.mockImplementation(async function* () {
      yield { choices: [{ delta: { content: 'x' } }] };
      controller.abort();
      yield { choices: [{ delta: { content: 'y' } }] };
    });
    let out = '';
    for await (const c of webllmProvider.runStreaming({ systemPrompt: 's', userPrompt: 'u', signal: controller.signal })) out += c;
    expect(engine.interruptGenerate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/core/ai/__tests__/providers/webllmProvider.test.ts`
Expected: FAIL — cannot resolve `webllmProvider`.

- [ ] **Step 5: Write `providers/webllmProvider.ts`**

```ts
/**
 * WebLLM provider — fully-local WebGPU inference via @mlc-ai/web-llm.
 * Library is lazy-imported (heavy WASM) and never loaded on desktop Chrome.
 * Weights download once from the MLC/HF CDN (gated by Settings opt-in).
 */
import type { AiAvailability } from '@/core/ai/aiTypes';
import type { AiProvider, AiDownloadProgress } from '@/core/ai/providers/types';
import { hasWebGpu } from '@/core/ai/providers/capabilities';
import { loadAiSettings } from '@/core/ai/aiSettings';

interface MlcEngine {
  chat: { completions: { create(opts: {
    messages: Array<{ role: 'system' | 'user'; content: string }>;
    stream: true;
  }): Promise<AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>> } };
  interruptGenerate(): void;
  resetChat(): Promise<void>;
  unload(): Promise<void>;
}

let engine: MlcEngine | null = null;
let engineModelId: string | null = null;
let initPromise: Promise<MlcEngine> | null = null;

export function __resetWebllmEngineForTesting(): void {
  engine = null; engineModelId = null; initPromise = null;
}

async function createEngine(
  modelId: string,
  onProgress?: (p: AiDownloadProgress) => void,
): Promise<MlcEngine> {
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
  const created = await CreateMLCEngine(modelId, {
    initProgressCallback: (r: { progress: number; text: string }) => {
      onProgress?.({ progress: r.progress, text: r.text });
    },
  });
  return created as unknown as MlcEngine;
}

async function ensureReady(onProgress?: (p: AiDownloadProgress) => void): Promise<void> {
  const modelId = loadAiSettings().webLlmModelId;
  if (engine && engineModelId === modelId) return;
  if (initPromise) { await initPromise; return; }
  try { await navigator.storage?.persist?.(); } catch { /* best-effort */ }
  initPromise = createEngine(modelId, onProgress)
    .then((e) => { engine = e; engineModelId = modelId; initPromise = null; return e; })
    .catch((err: unknown) => { initPromise = null; throw err; });
  await initPromise;
}

async function* runStreaming(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
}): AsyncIterableIterator<string> {
  await ensureReady();
  if (!engine) throw new Error('WebLLM engine not ready');
  await engine.resetChat();
  const onAbort = () => { engine?.interruptGenerate(); };
  args.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const stream = await engine.chat.completions.create({
      stream: true,
      messages: [
        { role: 'system', content: args.systemPrompt },
        { role: 'user', content: args.userPrompt },
      ],
    });
    for await (const chunk of stream) {
      const piece = chunk.choices[0]?.delta.content;
      if (piece) yield piece;
    }
  } finally {
    args.signal?.removeEventListener('abort', onAbort);
  }
}

export const webllmProvider: AiProvider = {
  id: 'webllm',
  async getAvailability(): Promise<AiAvailability> {
    if (!(await hasWebGpu())) return 'unavailable';
    return loadAiSettings().mobileAiModelReady ? 'available' : 'downloadable';
  },
  ensureReady,
  warmUp(): Promise<void> { return ensureReady(); },
  runStreaming,
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/core/ai/__tests__/providers/webllmProvider.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/core/ai/providers/webllmProvider.ts src/core/ai/__tests__/providers/webllmProvider.test.ts
git add package.json package-lock.json vite.config.ts src/core/ai/providers/webllmProvider.ts src/core/ai/__tests__/providers/webllmProvider.test.ts
git commit -m "feat(ai): add lazy WebLLM provider wrapper"
```

---

## Task 6: Wire WebLLM into registry selection

**Files:**
- Modify: `src/core/ai/providers/registry.ts`
- Modify: `src/core/ai/__tests__/providers/registry.test.ts`

**Interfaces:**
- Consumes: `webllmProvider` (Task 5).
- Produces: registry now returns `webllmProvider` in the fallback branch.

- [ ] **Step 1: Add the failing selection tests**

Append to `src/core/ai/__tests__/providers/registry.test.ts` inside the describe block:

```ts
  it('selects webllm when chrome is unavailable, WebGPU present, mobile surface enabled', async () => {
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('unavailable');
    Object.defineProperty(globalThis.navigator, 'gpu', { value: { requestAdapter: vi.fn().mockResolvedValue({}) }, configurable: true });
    Object.defineProperty(globalThis.navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 14)', configurable: true });
    const p = await getActiveProvider();
    expect(p?.id).toBe('webllm');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/ai/__tests__/providers/registry.test.ts`
Expected: FAIL — currently returns `null` (placeholder), not `webllm`.

- [ ] **Step 3: Replace the placeholder branch in `registry.ts`**

Add the import at top:

```ts
import { webllmProvider } from '@/core/ai/providers/webllmProvider';
```

Replace the placeholder block:

```ts
  if (isMobileAiSurfaceEnabled() && (await hasWebGpu())) {
    cached = null; // placeholder until webllmProvider is registered
    return cached;
  }
```

with:

```ts
  if (isMobileAiSurfaceEnabled() && (await hasWebGpu())) {
    cached = webllmProvider;
    return cached;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/ai/__tests__/providers/registry.test.ts`
Expected: PASS (3 tests).

> Note: `webllmProvider` imports `@mlc-ai/web-llm` only inside `ensureReady` (dynamic import), so registry selection does NOT pull WebLLM into the desktop bundle. Verify in Task 9 build step.

- [ ] **Step 5: Run the full AI suite + type-check + lint, commit**

```bash
npx vitest run src/core/ai && npm run type-check && npx eslint src/core/ai/providers/registry.ts src/core/ai/__tests__/providers/registry.test.ts
git add src/core/ai/providers/registry.ts src/core/ai/__tests__/providers/registry.test.ts
git commit -m "feat(ai): select WebLLM provider on WebGPU+Android"
```

---

## Task 7: CSP — allow WebLLM weight CDN (both sources)

**Files:**
- Modify: `src/config/securityHeaders.ts`
- Modify: `vercel.json`
- Modify (if needed): `src/config/__tests__/securityHeaders.test.ts`

**Interfaces:**
- Produces: `export const WEBLLM_MODEL_ORIGINS` added to `connect-src` in both CSP sources.

> The EXACT CDN hosts WebLLM fetches MUST be confirmed at implementation time by watching the Network tab during a real download (Task 11). The set below covers the known MLC/Hugging Face defaults. Add only the origins actually observed — keep CSP minimal.

- [ ] **Step 1: Add `WEBLLM_MODEL_ORIGINS` and extend connect-src in `securityHeaders.ts`**

After the `HIBP_ORIGINS` block, add:

```ts
/**
 * Origins WebLLM fetches model weights/config from (Android on-device AI).
 * Weight download ONLY — no user data leaves the device. Confirm the exact
 * host set via the Network tab during on-device verification; keep minimal.
 */
export const WEBLLM_MODEL_ORIGINS = [
  'https://huggingface.co',
  'https://cdn-lfs.huggingface.co',
  'https://cdn-lfs-us-1.huggingface.co',
  'https://raw.githubusercontent.com',
] as const;
```

Change the `connect-src` line in `buildContentSecurityPolicy`:

```ts
    'connect-src': ["'self'", ...HIBP_ORIGINS, ...WEBLLM_MODEL_ORIGINS],
```

- [ ] **Step 2: Mirror in `vercel.json`**

In `vercel.json`, update the `connect-src` segment of the CSP value to include the same four origins after the HIBP hosts:

```
connect-src 'self' https://api.pwnedpasswords.com https://haveibeenpwned.com https://huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://raw.githubusercontent.com;
```

(Leave every other directive byte-identical.)

- [ ] **Step 3: Run the CSP parity test**

Run: `npx vitest run src/config/__tests__/securityHeaders.test.ts`
Expected: PASS — `vercel.json` matches `buildContentSecurityPolicy()`. If the test hard-codes an expected CSP string, update that expected string to include the four origins.

- [ ] **Step 4: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/config/securityHeaders.ts
git add src/config/securityHeaders.ts vercel.json src/config/__tests__/securityHeaders.test.ts
git commit -m "feat(ai): allow WebLLM weight CDN in CSP (dev/preview + vercel parity)"
```

---

## Task 8: Settings UI — download flow, model picker, progress, remove

**Files:**
- Modify: `src/presentation/components/AiAssistanceSettings.tsx`
- Modify: `src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`

**Interfaces:**
- Consumes: `getActiveProvider` (Task 3), `webllmProvider`/`ensureReady` (Task 5), `WEBLLM_MODELS`/`getModelById` (Task 4), `isMobileAiSurfaceEnabled` (Task 1), `loadAiSettings`/`saveAiSettings`.
- Produces: a "On-device AI model (Android)" block shown only when the active provider is `webllm`.

- [ ] **Step 1: Write the failing UI tests**

Add to `src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`. Extend the existing mocks: mock `@/core/ai/providers/registry` to return a `webllm`-id provider, mock `@/core/ai/providers/webllmProvider` with an `ensureReady` spy, and ensure `getAiAvailability` resolves `'downloadable'`.

```ts
  it('shows the model download block and triggers ensureReady on Android/webllm', async () => {
    // (with webllm provider mocked active + availability 'downloadable')
    render(<AiAssistanceSettings />);
    const btn = await screen.findByRole('button', { name: /download model/i });
    fireEvent.click(btn);
    await waitFor(() => { expect(ensureReadySpy).toHaveBeenCalled(); });
  });

  it('persists model selection when the picker changes', async () => {
    render(<AiAssistanceSettings />);
    // select the Mid model, assert saveAiSettings called with webLlmModelId mid id
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`
Expected: FAIL — no "Download model" control yet.

- [ ] **Step 3: Implement the download block in `AiAssistanceSettings.tsx`**

Add state + an effect resolving the active provider id, a model picker (`Select` over `WEBLLM_MODELS`), a "Download model (~X MB)" `Button` that calls `webllmProvider.ensureReady(onProgress)` updating a determinate `LinearProgress`, and on success sets `mobileAiModelReady: true` via `saveAiSettings`. Add a "Remove model" button that calls the engine `unload()`/cache clear and sets `mobileAiModelReady: false`. Render the whole block only when `isMobileAiSurfaceEnabled()` and active provider id is `'webllm'`. Follow the React-19 `mounted`-flag pattern already used in this file. Include the disclosure copy: *"Downloads once from a third-party AI CDN. After that, all analysis runs locally on your device — your data never leaves it."*

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/presentation/components/AiAssistanceSettings.tsx src/presentation/components/__tests__/AiAssistanceSettings.test.tsx
git add src/presentation/components/AiAssistanceSettings.tsx src/presentation/components/__tests__/AiAssistanceSettings.test.tsx
git commit -m "feat(ai): WebLLM model download UI in AI settings (Android)"
```

---

## Task 9: Build verification — desktop bundle excludes WebLLM

**Files:** none (verification task)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: succeeds (tsc + vite + SW inject), 0 type errors.

- [ ] **Step 2: Confirm WebLLM is a lazy chunk, not in main/vendor**

Run: `grep -rl "web-llm\|MLCEngine" dist/assets/ | head` then inspect chunk names.
Expected: WebLLM appears only in its own dynamically-imported chunk (filename hashed), NOT in `index-*.js`, `react-vendor-*`, or `mui-vendor-*`. If it leaked into the entry, confirm the import in `webllmProvider.ts` is `await import()` inside `createEngine` (not top-level).

- [ ] **Step 3: Confirm full suite + lint green**

Run: `npm run test -- --run && npm run lint`
Expected: all tests pass; 0 lint errors.

- [ ] **Step 4: Commit (if any chunk/config tweak was needed)**

```bash
git add -A
git commit -m "chore(ai): verify WebLLM lazy-chunk isolation"
```

---

## Task 10: Documentation

**Files:**
- Modify: `SECURITY.md`
- Modify: `CLAUDE.md`
- Modify: `SECURITY_AUDIT_REPORT.md`

- [ ] **Step 1: Update `SECURITY.md` §On-Device AI Boundary**

Under "Platform support", add a subsection documenting the WebLLM Android backend: provider abstraction; fully-local WebGPU inference; the SINGLE new egress = one-time weight download from the MLC/HF CDN (no user data); `connect-src` exception; opt-in Settings download; `resetChat()` clean-context property; iOS still deferred.

- [ ] **Step 2: Update `CLAUDE.md`**

Extend the On-device AI bullet: WebLLM provider on Android (WebGPU), provider abstraction in `src/core/ai/providers/`, weight-download CDN-egress exception in CSP, Settings-driven download. Bump "Last Updated".

- [ ] **Step 3: Add `SECURITY_AUDIT_REPORT.md` patch note (AI3)**

Document: the Android platform gap (from AI2), the WebLLM remediation, the CDN-egress exception scope (weights only), CSP parity update, and the desktop-untouched regression proof.

- [ ] **Step 4: Commit**

```bash
git add SECURITY.md CLAUDE.md SECURITY_AUDIT_REPORT.md
git commit -m "docs(ai): document WebLLM Android provider + CDN-egress exception"
```

---

## Task 11: On-device Android verification (manual)

**Files:** none (manual checklist; record results in `TEST_STATUS.md`)

- [ ] **Step 1: Build + serve preview, connect Android via `chrome://inspect`** (USB debugging).
- [ ] **Step 2:** In the remote console, confirm `await navigator.gpu.requestAdapter()` is non-null (WebGPU present).
- [ ] **Step 3:** In Settings → AI Assistance, confirm the "On-device AI model (Android)" block appears; pick Small; tap Download; watch progress complete.
- [ ] **Step 4:** In the Network tab, record the EXACT origins the weights came from; reconcile with `WEBLLM_MODEL_ORIGINS` (Task 7) and trim/extend to match. If changed, re-run Task 7 commit.
- [ ] **Step 5:** Reload; open a breach alert → expand "AI Impact Analysis" → confirm tokens stream locally. Confirm strength-explain also works on the generator.
- [ ] **Step 6:** Toggle airplane mode AFTER download; confirm inference still works offline (fully local).
- [ ] **Step 7:** Record results + the confirmed origin set in `TEST_STATUS.md`; commit.

```bash
git add TEST_STATUS.md
git commit -m "test(ai): record Android WebLLM on-device verification"
```

---

## Self-Review

**Spec coverage:**
- §3 provider abstraction → Tasks 1–3, 6 ✅
- §4 file layout → matches Tasks 1–8 ✅
- §5 WebLLM details (model catalog, streaming, abort/interrupt, resetChat, persist) → Tasks 4, 5 ✅
- §6 Settings-only activation + configurable model → Tasks 4, 8 ✅
- §7 data flow (unchanged feature path) → preserved by Task 3 delegation ✅
- §8 CSP/build/SW → Tasks 5 (optimizeDeps), 7 (CSP), 9 (chunk isolation). SW: no workbox rule added (weights are cross-origin, cached by WebLLM) — covered by note in Task 9 ✅
- §9 error handling/eviction → ensureReady reject/Retry (Task 8), availability re-probe on missing cache (Task 5 getAvailability), abort→interrupt (Task 5) ✅
- §10 security/privacy → prompts unchanged (no task touches builders), CDN-egress documented (Task 10) ✅
- §11 testing → Tasks 1–8 each TDD; conformance via fakeProvider (Task 3) ✅
- §12 validation risks R1–R5 → R1 Task 7, R2 Task 10, R3 Task 5 (persist) + Task 9, R4 Tasks 2/9, R5 capability flag Task 1 ✅
- §13 future (LiteRT-LM/iOS) → out of scope, interface-ready ✅

**Placeholder scan:** Task 8 Step 3 describes the UI in prose rather than a full code block — acceptable because it composes existing MUI primitives already used in this file and exact JSX depends on the current render tree; the test (Step 1) pins the observable behavior. All other code steps contain full code.

**Type consistency:** `AiProvider` shape, `AiDownloadProgress { progress; text? }`, `webLlmModelId`/`mobileAiModelReady`, `getActiveProvider()`, `ensureReady(onProgress?)`, `runStreaming(args)`, `__resetRegistryForTesting`/`__setActiveProviderForTesting`/`__clearChromeSessionCacheForTesting`/`__resetWebllmEngineForTesting` — all consistent across tasks. Model id `Llama-3.2-1B-Instruct-q4f16_1-MLC` used identically in Tasks 4, 5, 8.
