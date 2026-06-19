# On-Device AI "Explain Password Strength" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, off-by-default "Explain with AI" button to the Password Generator that uses Chrome's on-device `LanguageModel` to explain a password's strength, sending only the strength label and entropy estimate — never a secret.

**Architecture:** Four focused `src/core/ai/` modules (settings, availability, prompt-API wrapper, prompt builder) consumed by one React hook that gates a button wired into the existing inline strength UI on `PasswordGeneratorPage`. Single provider (Chrome built-in) → no provider-selection layer. Settings use the localStorage-module pattern (`autofillSettings.ts`), not Zustand.

**Tech Stack:** TypeScript 5.7 (strict), React 19, Vite 6.4, Vitest + @testing-library/react, MUI, Chrome Prompt API (global `LanguageModel`).

**Spec:** `docs/superpowers/specs/2026-06-19-ondevice-ai-strength-explain-design.md`

## Global Constraints

- Provider: **Chrome built-in only**. No Window AI, no remote providers, no bundled/WebLLM models.
- **Never trigger a model download.** `LanguageModel.create()` is called ONLY when `availability() === 'available'`.
- **Never** send to AI: password chars, master key, TOTP/recovery codes, notes, username, site origin, title. Only `strength` enum + rounded `entropy` integer.
- Both settings toggles default `false`. Feature degrades silently to hidden/null on any error — never blocks the generator.
- No remote logging; no prompt/response persisted. Dev logs gated; prod strips via `drop_console: true`.
- TS strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`. Use `@/` path aliases.
- DoD gate before done: `npm run type-check` (0), `npm run lint` (0 warnings), targeted `npm run test` green.
- All `LanguageModel` global access confined to `src/core/ai/promptApi.ts` so API drift stays in one file.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/core/ai/aiSettings.ts` | Create. localStorage settings module (load/save/defaults). |
| `src/core/ai/aiTypes.ts` | Create. Shared types (`AiAvailability`, `StrengthExplainInput`). |
| `src/core/ai/aiAvailability.ts` | Create. Detect global `LanguageModel`; map `availability()` → feature decision. No `create()`. |
| `src/core/ai/promptApi.ts` | Create. Only place touching `LanguageModel.create()`/`promptStreaming()`. |
| `src/core/ai/strengthExplain.ts` | Create. Build safe prompt from strength metadata; call promptApi; assert no secrets. |
| `src/presentation/hooks/useAiStrengthExplain.ts` | Create. React hook gating on settings + availability. |
| `src/presentation/components/AiAssistanceSettings.tsx` | Create. Settings section component. |
| `src/presentation/pages/SettingsPage.tsx` | Modify. Render `<AiAssistanceSettings />`. |
| `src/presentation/pages/PasswordGeneratorPage.tsx` | Modify. Add gated "Explain with AI" button + explanation panel. |
| `src/core/ai/__tests__/*.test.ts` | Tests for the four core modules. |
| `src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts` | Hook tests. |

---

## Task 1: Shared types + settings module

**Files:**
- Create: `src/core/ai/aiTypes.ts`
- Create: `src/core/ai/aiSettings.ts`
- Test: `src/core/ai/__tests__/aiSettings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable'`
  - `interface StrengthExplainInput { strength: 'weak'|'medium'|'strong'|'very-strong'; entropyBits: number }`
  - `interface AiSettings { enableOnDeviceAI: boolean; allowStrengthExplanation: boolean }`
  - `const DEFAULT_AI_SETTINGS: AiSettings`
  - `function loadAiSettings(): AiSettings`
  - `function saveAiSettings(settings: AiSettings): void`

- [ ] **Step 1: Write the failing test**

Create `src/core/ai/__tests__/aiSettings.test.ts`:

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
  beforeEach(() => localStorage.clear());

  it('defaults both toggles to false', () => {
    expect(DEFAULT_AI_SETTINGS).toEqual({
      enableOnDeviceAI: false,
      allowStrengthExplanation: false,
    });
  });

  it('returns defaults when storage empty', () => {
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('merges stored partial over defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enableOnDeviceAI: true }));
    expect(loadAiSettings()).toEqual({
      enableOnDeviceAI: true,
      allowStrengthExplanation: false,
    });
  });

  it('round-trips saved settings', () => {
    const s: AiSettings = { enableOnDeviceAI: true, allowStrengthExplanation: true };
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

Run: `npm run test -- src/core/ai/__tests__/aiSettings.test.ts`
Expected: FAIL — cannot resolve `@/core/ai/aiSettings`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/ai/aiTypes.ts`:

```ts
/** On-device AI shared types. */
export type AiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export type StrengthLabel = 'weak' | 'medium' | 'strong' | 'very-strong';

export interface StrengthExplainInput {
  strength: StrengthLabel;
  /** Rounded entropy estimate in bits. The only number sent to AI. */
  entropyBits: number;
}
```

Create `src/core/ai/aiSettings.ts` (mirrors `src/core/autofill/autofillSettings.ts`):

```ts
/**
 * On-device AI settings (opt-in, off by default).
 * localStorage module — mirrors autofillSettings.ts. No Zustand.
 */

export interface AiSettings {
  /** Master toggle for Chrome built-in AI. */
  enableOnDeviceAI: boolean;
  /** Feature toggle for the strength-explanation feature. */
  allowStrengthExplanation: boolean;
}

const STORAGE_KEY = 'trustvault_ai_settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enableOnDeviceAI: false,
  allowStrengthExplanation: false,
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

Run: `npm run test -- src/core/ai/__tests__/aiSettings.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/aiTypes.ts src/core/ai/aiSettings.ts src/core/ai/__tests__/aiSettings.test.ts
git commit -m "feat(ai): add on-device AI settings module + shared types"
```

---

## Task 2: Availability detection (never-download gate)

**Files:**
- Create: `src/core/ai/aiAvailability.ts`
- Test: `src/core/ai/__tests__/aiAvailability.test.ts`

**Interfaces:**
- Consumes: `AiAvailability` from `aiTypes.ts`.
- Produces:
  - `async function getAiAvailability(): Promise<AiAvailability>` — returns `'unavailable'` if the global `LanguageModel` is absent or throws.
  - `function isFeatureUsable(a: AiAvailability): boolean` — `true` only for `'available'`.

Note: Chrome exposes a global `LanguageModel` with a static `availability(): Promise<AiAvailability>`. We reference it via `globalThis` to avoid a hard compile-time dependency.

- [ ] **Step 1: Write the failing test**

Create `src/core/ai/__tests__/aiAvailability.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { getAiAvailability, isFeatureUsable } from '@/core/ai/aiAvailability';

function setLanguageModel(value: unknown) {
  (globalThis as Record<string, unknown>).LanguageModel = value;
}

describe('aiAvailability', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    vi.restoreAllMocks();
  });

  it('reports unavailable when LanguageModel is absent', async () => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    expect(await getAiAvailability()).toBe('unavailable');
  });

  it('passes through each availability state', async () => {
    for (const state of ['available', 'downloadable', 'downloading', 'unavailable'] as const) {
      setLanguageModel({ availability: vi.fn().mockResolvedValue(state) });
      expect(await getAiAvailability()).toBe(state);
    }
  });

  it('reports unavailable when availability() throws', async () => {
    setLanguageModel({ availability: vi.fn().mockRejectedValue(new Error('boom')) });
    expect(await getAiAvailability()).toBe('unavailable');
  });

  it('isFeatureUsable is true only for available', () => {
    expect(isFeatureUsable('available')).toBe(true);
    expect(isFeatureUsable('downloadable')).toBe(false);
    expect(isFeatureUsable('downloading')).toBe(false);
    expect(isFeatureUsable('unavailable')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/aiAvailability.test.ts`
Expected: FAIL — cannot resolve `@/core/ai/aiAvailability`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/ai/aiAvailability.ts`:

```ts
/**
 * Chrome built-in AI availability detection.
 * NEVER calls create(); only reads the static availability() state.
 */
import type { AiAvailability } from './aiTypes';

interface LanguageModelStatic {
  availability(): Promise<AiAvailability>;
}

function getLanguageModel(): LanguageModelStatic | undefined {
  const lm = (globalThis as Record<string, unknown>).LanguageModel;
  if (lm && typeof (lm as LanguageModelStatic).availability === 'function') {
    return lm as LanguageModelStatic;
  }
  return undefined;
}

export async function getAiAvailability(): Promise<AiAvailability> {
  const lm = getLanguageModel();
  if (!lm) return 'unavailable';
  try {
    return await lm.availability();
  } catch {
    return 'unavailable';
  }
}

/** Feature may run only when the model is already present — never triggers a download. */
export function isFeatureUsable(availability: AiAvailability): boolean {
  return availability === 'available';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/aiAvailability.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/aiAvailability.ts src/core/ai/__tests__/aiAvailability.test.ts
git commit -m "feat(ai): add availability detection with never-download gate"
```

---

## Task 3: Prompt API wrapper

**Files:**
- Create: `src/core/ai/promptApi.ts`
- Test: `src/core/ai/__tests__/promptApi.test.ts`

**Interfaces:**
- Consumes: nothing from prior tasks (self-contained wrapper).
- Produces:
  - `async function runPrompt(args: { systemPrompt: string; userPrompt: string; signal?: AbortSignal }): Promise<string>` — creates a session, streams the response to a concatenated string, destroys the session. Throws if `LanguageModel` is absent (caller guards via availability first).

Note: API shape (June 2026): `LanguageModel.create({ initialPrompts: [{ role:'system', content }] })` → `session.promptStreaming(userPrompt, { signal })` returns an async-iterable of string chunks; `session.destroy()` frees it.

- [ ] **Step 1: Write the failing test**

Create `src/core/ai/__tests__/promptApi.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { runPrompt } from '@/core/ai/promptApi';

function setLanguageModel(value: unknown) {
  (globalThis as Record<string, unknown>).LanguageModel = value;
}

function streamOf(chunks: string[]) {
  return (async function* () {
    for (const c of chunks) yield c;
  })();
}

describe('promptApi.runPrompt', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    vi.restoreAllMocks();
  });

  it('concatenates streamed chunks and destroys the session', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn().mockReturnValue(streamOf(['Hello ', 'world']));
    const create = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    setLanguageModel({ create });

    const text = await runPrompt({ systemPrompt: 'sys', userPrompt: 'user' });

    expect(text).toBe('Hello world');
    expect(create).toHaveBeenCalledWith({ initialPrompts: [{ role: 'system', content: 'sys' }] });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('destroys the session even if streaming throws', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn(() => { throw new Error('stream fail'); });
    const create = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    setLanguageModel({ create });

    await expect(runPrompt({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow('stream fail');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('throws when LanguageModel is absent', async () => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    await expect(runPrompt({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/promptApi.test.ts`
Expected: FAIL — cannot resolve `@/core/ai/promptApi`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/ai/promptApi.ts`:

```ts
/**
 * Thin wrapper over the Chrome built-in AI global `LanguageModel`.
 * THE ONLY module that calls create()/promptStreaming(). Isolates API drift.
 * Callers MUST confirm availability === 'available' first (never-download policy).
 */

interface AiSession {
  promptStreaming(input: string, opts?: { signal?: AbortSignal }): AsyncIterable<string>;
  destroy(): void;
}

interface LanguageModelStatic {
  create(opts: { initialPrompts: Array<{ role: 'system'; content: string }> }): Promise<AiSession>;
}

function getLanguageModel(): LanguageModelStatic {
  const lm = (globalThis as Record<string, unknown>).LanguageModel as LanguageModelStatic | undefined;
  if (!lm || typeof lm.create !== 'function') {
    throw new Error('Chrome built-in AI (LanguageModel) is not available');
  }
  return lm;
}

export async function runPrompt(args: {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const lm = getLanguageModel();
  const session = await lm.create({
    initialPrompts: [{ role: 'system', content: args.systemPrompt }],
  });
  try {
    let text = '';
    const opts = args.signal ? { signal: args.signal } : undefined;
    for await (const chunk of session.promptStreaming(args.userPrompt, opts)) {
      text += chunk;
    }
    return text;
  } finally {
    session.destroy();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/promptApi.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/promptApi.ts src/core/ai/__tests__/promptApi.test.ts
git commit -m "feat(ai): add isolated LanguageModel prompt wrapper"
```

---

## Task 4: Strength explanation prompt builder

**Files:**
- Create: `src/core/ai/strengthExplain.ts`
- Test: `src/core/ai/__tests__/strengthExplain.test.ts`

**Interfaces:**
- Consumes: `StrengthExplainInput` from `aiTypes.ts`; `runPrompt` from `promptApi.ts`.
- Produces:
  - `const STRENGTH_SYSTEM_PROMPT: string`
  - `function buildStrengthPrompt(input: StrengthExplainInput): string` — pure; contains only the strength label + entropy integer.
  - `async function explainStrength(input: StrengthExplainInput, signal?: AbortSignal): Promise<string>` — builds prompt, delegates to `runPrompt`.

- [ ] **Step 1: Write the failing test**

Create `src/core/ai/__tests__/strengthExplain.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPrompt = vi.fn();
vi.mock('@/core/ai/promptApi', () => ({ runPrompt: (...a: unknown[]) => runPrompt(...a) }));

import {
  buildStrengthPrompt,
  explainStrength,
  STRENGTH_SYSTEM_PROMPT,
} from '@/core/ai/strengthExplain';

describe('strengthExplain', () => {
  beforeEach(() => runPrompt.mockReset());

  it('prompt contains the strength label and entropy', () => {
    const p = buildStrengthPrompt({ strength: 'strong', entropyBits: 82 });
    expect(p).toContain('strong');
    expect(p).toContain('82');
  });

  it('prompt and system prompt leak no secret-shaped data', () => {
    // Build with values that must NOT appear: a fake password/username/origin.
    const p = buildStrengthPrompt({ strength: 'weak', entropyBits: 12 });
    const combined = `${STRENGTH_SYSTEM_PROMPT}\n${p}`.toLowerCase();
    for (const forbidden of ['password:', 'username', 'http', '://', 'secret', 'token']) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it('rounds entropy to an integer in the prompt', () => {
    const p = buildStrengthPrompt({ strength: 'medium', entropyBits: 47.8 });
    expect(p).toContain('48');
    expect(p).not.toContain('47.8');
  });

  it('explainStrength delegates to runPrompt and returns its text', async () => {
    runPrompt.mockResolvedValue('Because it is long.');
    const result = await explainStrength({ strength: 'very-strong', entropyBits: 120 });
    expect(result).toBe('Because it is long.');
    expect(runPrompt).toHaveBeenCalledOnce();
    const arg = runPrompt.mock.calls[0][0] as { systemPrompt: string; userPrompt: string };
    expect(arg.systemPrompt).toBe(STRENGTH_SYSTEM_PROMPT);
    expect(arg.userPrompt).toContain('very-strong');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/strengthExplain.test.ts`
Expected: FAIL — cannot resolve `@/core/ai/strengthExplain`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/ai/strengthExplain.ts`:

```ts
/**
 * Builds the password-strength explanation prompt and runs it.
 * SECURITY: the prompt is constructed ONLY from the strength label and a
 * rounded entropy integer — never a password, username, origin, or any secret.
 */
import type { StrengthExplainInput } from './aiTypes';
import { runPrompt } from './promptApi';

export const STRENGTH_SYSTEM_PROMPT =
  'You are a security assistant. Explain password strength in 2-3 simple sentences. ' +
  'Never ask for or guess the actual password.';

export function buildStrengthPrompt(input: StrengthExplainInput): string {
  const entropy = Math.round(input.entropyBits);
  return (
    `The password strength is "${input.strength}" with an estimated entropy of ${entropy} bits. ` +
    'Explain why this rating is appropriate and give one tip, ' +
    'without guessing or revealing any password.'
  );
}

export async function explainStrength(
  input: StrengthExplainInput,
  signal?: AbortSignal,
): Promise<string> {
  return runPrompt({
    systemPrompt: STRENGTH_SYSTEM_PROMPT,
    userPrompt: buildStrengthPrompt(input),
    ...(signal ? { signal } : {}),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/strengthExplain.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/strengthExplain.ts src/core/ai/__tests__/strengthExplain.test.ts
git commit -m "feat(ai): add strength-explanation prompt builder (secret-free)"
```

---

## Task 5: React hook `useAiStrengthExplain`

**Files:**
- Create: `src/presentation/hooks/useAiStrengthExplain.ts`
- Test: `src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts`

**Interfaces:**
- Consumes: `loadAiSettings` (`aiSettings.ts`), `getAiAvailability`/`isFeatureUsable` (`aiAvailability.ts`), `explainStrength` (`strengthExplain.ts`), `StrengthExplainInput` (`aiTypes.ts`).
- Produces:
  - `function useAiStrengthExplain(): { enabled: boolean; loading: boolean; explanation: string | null; error: boolean; explain(input: StrengthExplainInput): Promise<void>; reset(): void }`
  - `enabled` is `true` only when both settings toggles are on AND availability is usable. Computed once on mount (StrictMode-safe with a `mounted` flag).

- [ ] **Step 1: Write the failing test**

Create `src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const loadAiSettings = vi.fn();
const getAiAvailability = vi.fn();
const explainStrength = vi.fn();

vi.mock('@/core/ai/aiSettings', () => ({ loadAiSettings: () => loadAiSettings() }));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: () => getAiAvailability(),
  isFeatureUsable: (a: string) => a === 'available',
}));
vi.mock('@/core/ai/strengthExplain', () => ({
  explainStrength: (...a: unknown[]) => explainStrength(...a),
}));

import { useAiStrengthExplain } from '@/presentation/hooks/useAiStrengthExplain';

function bothOn() {
  loadAiSettings.mockReturnValue({ enableOnDeviceAI: true, allowStrengthExplanation: true });
}

describe('useAiStrengthExplain', () => {
  beforeEach(() => {
    loadAiSettings.mockReset();
    getAiAvailability.mockReset();
    explainStrength.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('enabled=false when settings are off', async () => {
    loadAiSettings.mockReturnValue({ enableOnDeviceAI: false, allowStrengthExplanation: false });
    getAiAvailability.mockResolvedValue('available');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(result.current.enabled).toBe(false));
  });

  it('enabled=false when availability not usable even if settings on', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('downloadable');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(getAiAvailability).toHaveBeenCalled());
    expect(result.current.enabled).toBe(false);
  });

  it('enabled=true when settings on and available', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(result.current.enabled).toBe(true));
  });

  it('explain sets explanation on success', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainStrength.mockResolvedValue('Strong because long.');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => {
      await result.current.explain({ strength: 'strong', entropyBits: 80 });
    });
    expect(result.current.explanation).toBe('Strong because long.');
    expect(result.current.error).toBe(false);
  });

  it('explain degrades to error=true, explanation=null on failure', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainStrength.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => {
      await result.current.explain({ strength: 'weak', entropyBits: 10 });
    });
    expect(result.current.explanation).toBeNull();
    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts`
Expected: FAIL — cannot resolve the hook module.

- [ ] **Step 3: Write minimal implementation**

Create `src/presentation/hooks/useAiStrengthExplain.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { loadAiSettings } from '@/core/ai/aiSettings';
import { getAiAvailability, isFeatureUsable } from '@/core/ai/aiAvailability';
import { explainStrength } from '@/core/ai/strengthExplain';
import type { StrengthExplainInput } from '@/core/ai/aiTypes';

interface UseAiStrengthExplain {
  enabled: boolean;
  loading: boolean;
  explanation: string | null;
  error: boolean;
  explain: (input: StrengthExplainInput) => Promise<void>;
  reset: () => void;
}

export function useAiStrengthExplain(): UseAiStrengthExplain {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const settings = loadAiSettings();
    if (!settings.enableOnDeviceAI || !settings.allowStrengthExplanation) {
      setEnabled(false);
      return () => { mounted = false; };
    }
    getAiAvailability()
      .then((a) => { if (mounted) setEnabled(isFeatureUsable(a)); })
      .catch(() => { if (mounted) setEnabled(false); });
    return () => { mounted = false; };
  }, []);

  const explain = useCallback(async (input: StrengthExplainInput) => {
    setLoading(true);
    setError(false);
    setExplanation(null);
    try {
      const text = await explainStrength(input);
      setExplanation(text);
    } catch {
      setError(true);
      setExplanation(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setExplanation(null);
    setError(false);
    setLoading(false);
  }, []);

  return { enabled, loading, explanation, error, explain, reset };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/presentation/hooks/useAiStrengthExplain.ts src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts
git commit -m "feat(ai): add useAiStrengthExplain hook with settings+availability gating"
```

---

## Task 6: Settings UI section

**Files:**
- Create: `src/presentation/components/AiAssistanceSettings.tsx`
- Modify: `src/presentation/pages/SettingsPage.tsx` (import + render near other settings components, e.g. after `<ClipboardSettings ... />` around line 200-205)

**Interfaces:**
- Consumes: `loadAiSettings`/`saveAiSettings`/`AiSettings` (`aiSettings.ts`); `getAiAvailability` (`aiAvailability.ts`); `AiAvailability` (`aiTypes.ts`).
- Produces: default-exported `AiAssistanceSettings` React component. No props.

Behavior: two MUI toggles bound to `AiSettings`, persisted via `saveAiSettings` on change. Shows detected availability text. `allowStrengthExplanation` toggle disabled unless `enableOnDeviceAI` is on. Both off by default.

- [ ] **Step 1: Write the failing test**

Create `src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const saveAiSettings = vi.fn();
let current = { enableOnDeviceAI: false, allowStrengthExplanation: false };
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: () => current,
  saveAiSettings: (s: typeof current) => { current = s; saveAiSettings(s); },
  DEFAULT_AI_SETTINGS: { enableOnDeviceAI: false, allowStrengthExplanation: false },
}));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: vi.fn().mockResolvedValue('unavailable'),
}));

import AiAssistanceSettings from '@/presentation/components/AiAssistanceSettings';

describe('AiAssistanceSettings', () => {
  beforeEach(() => {
    current = { enableOnDeviceAI: false, allowStrengthExplanation: false };
    saveAiSettings.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the experimental section heading', () => {
    render(<AiAssistanceSettings />);
    expect(screen.getByText(/AI Assistance/i)).toBeInTheDocument();
  });

  it('master toggle persists via saveAiSettings', async () => {
    render(<AiAssistanceSettings />);
    const master = screen.getByLabelText(/Enable on-device AI/i);
    fireEvent.click(master);
    await waitFor(() =>
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ enableOnDeviceAI: true }),
      ),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`
Expected: FAIL — cannot resolve the component module.

- [ ] **Step 3: Write minimal implementation**

Create `src/presentation/components/AiAssistanceSettings.tsx`:

```tsx
/**
 * AI Assistance (Experimental) settings section.
 * Chrome built-in on-device AI only. Both toggles off by default.
 */
import { useEffect, useState } from 'react';
import { Box, Typography, FormControlLabel, Switch, Paper } from '@mui/material';
import { loadAiSettings, saveAiSettings, type AiSettings } from '@/core/ai/aiSettings';
import { getAiAvailability } from '@/core/ai/aiAvailability';
import type { AiAvailability } from '@/core/ai/aiTypes';

const AVAILABILITY_TEXT: Record<AiAvailability, string> = {
  available: 'On-device AI: available',
  downloadable: 'On-device AI: enable it in your browser first',
  downloading: 'On-device AI: downloading in your browser…',
  unavailable: 'On-device AI: not available in this browser',
};

export default function AiAssistanceSettings() {
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [availability, setAvailability] = useState<AiAvailability>('unavailable');

  useEffect(() => {
    let mounted = true;
    getAiAvailability()
      .then((a) => { if (mounted) setAvailability(a); })
      .catch(() => { if (mounted) setAvailability('unavailable'); });
    return () => { mounted = false; };
  }, []);

  const update = (patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  };

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
              onChange={(e) =>
                update(
                  e.target.checked
                    ? { enableOnDeviceAI: true }
                    : { enableOnDeviceAI: false, allowStrengthExplanation: false },
                )
              }
            />
          }
          label="Enable on-device AI (Chrome built-in, where available)"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: 1 }}>
          Uses your browser's on-device model. TrustVault never sends your passwords or secrets, and never downloads a model for you.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.allowStrengthExplanation}
              disabled={!settings.enableOnDeviceAI}
              onChange={(e) => update({ allowStrengthExplanation: e.target.checked })}
            />
          }
          label="Allow AI to explain password strength"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
          AI receives only the strength rating and entropy estimate — never your password.
        </Typography>
      </Box>
    </Paper>
  );
}
```

Modify `src/presentation/pages/SettingsPage.tsx`:
- Add import near the other component imports (after line 32 `import ProfilesSettings ...`):
  ```tsx
  import AiAssistanceSettings from '../components/AiAssistanceSettings';
  ```
- Render it after `<ProfilesSettings />` (around line 205):
  ```tsx
  <ProfilesSettings />
  <AiAssistanceSettings />
  ```

- [ ] **Step 4: Run tests + type-check**

Run: `npm run test -- src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`
Expected: PASS (2 tests).
Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/components/AiAssistanceSettings.tsx src/presentation/components/__tests__/AiAssistanceSettings.test.tsx src/presentation/pages/SettingsPage.tsx
git commit -m "feat(ai): add AI Assistance settings section to Settings page"
```

---

## Task 7: Wire "Explain with AI" into the generator

**Files:**
- Modify: `src/presentation/pages/PasswordGeneratorPage.tsx` (add button + panel after the Entropy Display `Typography`, around line 270; this page already holds `strength` and `entropy` state)

**Interfaces:**
- Consumes: `useAiStrengthExplain` (`useAiStrengthExplain.ts`); existing page state `strength` (`'weak'|'medium'|'strong'|'very-strong'`) and `entropy` (`number`).
- Produces: no new exports.

Behavior: when `enabled`, render an "Explain with AI" button below the entropy line. On click call `explain({ strength, entropyBits: entropy })`. Show loading label; render returned text + "Generated by Chrome built-in AI." When disabled, render nothing (feature hidden).

- [ ] **Step 1: Add hook + imports**

In `src/presentation/pages/PasswordGeneratorPage.tsx`:
- Add to the MUI import list (it already imports from `@mui/material`): ensure `Button` and `Typography` are imported (Typography already is; add `Button` if absent).
- Add near the top of the component body (after the existing `useState` declarations around line 77):

```tsx
import { useAiStrengthExplain } from '@/presentation/hooks/useAiStrengthExplain';
```

```tsx
const ai = useAiStrengthExplain();
```

- [ ] **Step 2: Add the UI after the Entropy Display block**

Immediately after the `Entropy: {entropy.toFixed(1)} bits` `<Typography>` (around line 270), insert:

```tsx
{ai.enabled && (
  <Box sx={{ mt: 1 }}>
    <Button
      size="small"
      variant="outlined"
      disabled={ai.loading}
      onClick={() => ai.explain({ strength, entropyBits: entropy })}
    >
      {ai.loading ? 'AI is thinking…' : 'Explain with AI'}
    </Button>
    {ai.error && (
      <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
        Could not generate an explanation.
      </Typography>
    )}
    {ai.explanation && (
      <Box sx={{ mt: 1 }}>
        <Typography variant="body2" color="text.secondary">{ai.explanation}</Typography>
        <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
          Generated by Chrome built-in AI.
        </Typography>
      </Box>
    )}
  </Box>
)}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check`
Expected: 0 errors.
Run: `npm run lint`
Expected: 0 warnings (fix any unused import — e.g. ensure `Button`/`Box` are imported and used).

- [ ] **Step 4: Manual smoke (record in TEST_STATUS.md)**

Run: `npm run dev`, open the Password Generator page.
- Default (both settings off): no "Explain with AI" button. ✔
- Enable both toggles in Settings on a Chrome with built-in AI `available`: button appears; clicking streams an explanation; origin note shows.
- Browser without `LanguageModel`: button never appears.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/pages/PasswordGeneratorPage.tsx
git commit -m "feat(ai): add Explain with AI button to password generator"
```

---

## Task 8: Security docs + final gate

**Files:**
- Modify: `SECURITY.md` (add "On-device AI boundary" subsection)
- Modify: `CLAUDE.md` (security notes — one line referencing the AI boundary, if appropriate)

**Interfaces:** none (docs only).

- [ ] **Step 1: Add SECURITY.md subsection**

Add an "On-device AI boundary" subsection documenting:
- Provider: Chrome built-in `LanguageModel` only; no remote/extension providers.
- Data sent: strength label + rounded entropy only; explicit list of what is NEVER sent (password, master key, TOTP, notes, username, origin, title).
- Never-download policy (feature only when `availability === 'available'`).
- AI treated as outside the zero-knowledge boundary even on-device; no prompt/response logged or persisted.
- Off by default (two opt-in toggles).

- [ ] **Step 2: Run the full DoD gate**

Run: `npm run type-check`
Expected: 0 errors.
Run: `npm run lint`
Expected: 0 warnings.
Run: `npm run test -- src/core/ai src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add SECURITY.md CLAUDE.md
git commit -m "docs(ai): document on-device AI security boundary"
```

---

## Self-Review

**Spec coverage:**
- §4 module layout → Tasks 1-5 create exactly the files listed (dropped layers stay dropped). ✔
- §5 settings → Task 1 (module) + Task 6 (UI). ✔
- §6 never-download gate → Task 2 (`isFeatureUsable` = available only) + Task 3 (caller-guards). ✔
- §7 data flow / ZK boundary → Task 4 (secret-free prompt + leak test) + Task 7 (wiring). ✔
- §8 error handling/no logging → Task 5 (degrade path) + Task 3 (`finally destroy`). ✔
- §9 testing/DoD → tests in every task + Task 8 final gate. ✔
- §10 corrections (global `LanguageModel`, localStorage settings, streaming) → Tasks 2/3/1. ✔

**Placeholder scan:** No TBD/TODO; every code step has full code. ✔

**Type consistency:** `AiAvailability`, `StrengthExplainInput`, `AiSettings`, `runPrompt`, `explainStrength`, `getAiAvailability`/`isFeatureUsable`, `useAiStrengthExplain` return shape — names match across producing/consuming tasks. ✔

**Note for implementer:** The generator page (`PasswordGeneratorPage.tsx`) uses its own inline strength UI, not the `PasswordStrengthIndicator` component — the button is wired there (it already holds `strength` + `entropy` state). The spec's mention of `PasswordStrengthIndicator` is superseded by this plan.
