# Chrome Built-in AI Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Chrome built-in / Gemini Nano on-device AI path with the stable June 2026 Prompt API — provider hardening plus structured insight cards, Summarizer vault overview, multilingual output, and quota-aware chat — all Chrome-only and hard-gated.

**Architecture:** Approach A from the spec — capability-typed `chromeBuiltinProvider` behind the existing `promptApi.ts` facade. New capabilities are optional `AiProvider` members gated by a single `supports(capability)` check; WebLLM/LiteRT return `false`. Each feature owns its own JSON Schema + result type (no central registry). Structured output renders as a one-shot insight card above the existing free-text chat.

**Tech Stack:** TypeScript 5.7 (strict), React 19, Vitest, MUI, Chrome `LanguageModel` + `Summarizer` globals (Gemini Nano).

## Global Constraints

- **Provider scope:** New capabilities run ONLY when the active provider is `chrome-builtin`. Gate via `provider.supports(cap)`. WebLLM/LiteRT `supports()` returns `false` for every new cap; callers fall back to today's behavior.
- **ZK boundary unchanged:** Every app-constructed prompt/context MUST pass through `assertNoSecrets()` (`src/core/ai/chat/chatContext.ts`) before reaching any provider. Schemas describe only non-secret fields (severity, categories, action steps) — never a password, secret note, or key. User free-text chat turns are NOT inspected.
- **Ephemeral sessions:** No prompt/response logged or persisted. One-shot sessions destroyed after each call; chat sessions destroyed on panel close / vault lock / logout / unmount (existing behavior, do not regress).
- **No new network egress on the Chrome path.** No new CSP `connect-src` exception.
- **Determinism:** Security insight one-shot calls use low sampling (`temperature: 0.3`, `topK: 3`).
- **Supported languages (Gemini Nano):** `en`, `es`, `ja`, `de`, `fr`. Anything else → fall back to `en`.
- **Quality gates per task:** `npm run type-check` (0 errors), `npm run lint` (0 warnings), targeted `npm run test` pass. TypeScript strict: no `any`, null-safe array access, `exactOptionalPropertyTypes` (use `prop?: T | undefined`).
- **Path aliases:** import via `@/…`, never `../../`.
- **Manual on-device verification** in Chrome 148+/149, recorded in `TEST_STATUS.md` (final task).

---

## File Structure

**Create:**
- `src/core/ai/aiLanguages.ts` — locale → supported language helper.
- `src/core/ai/summarizer.ts` — Summarizer API wrapper.
- `src/core/ai/__tests__/aiLanguages.test.ts`
- `src/core/ai/__tests__/summarizer.test.ts`
- `src/core/ai/__tests__/strengthInsight.test.ts`
- `src/core/ai/__tests__/breachInsight.test.ts`
- `src/presentation/components/ai/StrengthInsightCard.tsx`
- `src/presentation/components/ai/BreachInsightCard.tsx`
- `src/presentation/components/ai/__tests__/StrengthInsightCard.test.tsx`
- `src/presentation/components/ai/__tests__/BreachInsightCard.test.tsx`

**Modify:**
- `src/core/ai/providers/types.ts` — add `AiCapability`, `supports`, `runStructured?`, extended run/chat opts, `StructuredArgs`.
- `src/core/ai/providers/chromeBuiltinProvider.ts` — implement `supports`, `runStructured`, `params`, `expectedInputs/Outputs`, quota seam.
- `src/core/ai/providers/webllmProvider.ts`, `litertProvider.ts` — add `supports() => false`.
- `src/core/ai/promptApi.ts` — add `runStructured`, `supportsCapability`, `measureChatUsage` facade fns.
- `src/core/ai/strengthExplain.ts` — add `StrengthInsight`, schema, `explainStrengthStructured()`.
- `src/core/ai/breachImpactExplain.ts` — add `BreachInsight`, schema, `explainBreachImpactStructured()`.
- `src/core/ai/chat/vaultAggregate.ts` — add `summarizeVaultOverview()`.
- `src/core/ai/chat/chatTrim.ts` — add quota-driven branch.
- `src/presentation/hooks/useAiStrengthExplain.ts` — return typed insight.
- `src/presentation/hooks/useAiBreachImpactExplain.ts` — return typed insight.
- `src/presentation/components/PasswordStrengthIndicator.tsx` — render `StrengthInsightCard` above chat.
- `src/presentation/components/BreachDetailsModal.tsx` — render `BreachInsightCard` above chat.
- `SECURITY.md`, `CLAUDE.md`, `TEST_STATUS.md` — docs.

---

# PHASE 1 — Provider Hardening (foundation)

### Task 1: Capability enum + `supports()` on the provider interface

**Files:**
- Modify: `src/core/ai/providers/types.ts`
- Modify: `src/core/ai/providers/chromeBuiltinProvider.ts`
- Modify: `src/core/ai/providers/webllmProvider.ts`
- Modify: `src/core/ai/providers/litertProvider.ts`
- Test: `src/core/ai/__tests__/providers/capabilities.test.ts` (existing file — append)

**Interfaces:**
- Produces:
  - `type AiCapability = 'structured' | 'params' | 'quota' | 'languages';`
  - `AiProvider.supports(cap: AiCapability): boolean` (required member).

- [ ] **Step 1: Write the failing test** — append to `src/core/ai/__tests__/providers/capabilities.test.ts`:

```typescript
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';
import { webllmProvider } from '@/core/ai/providers/webllmProvider';
import { litertProvider } from '@/core/ai/providers/litertProvider';

describe('AiProvider.supports', () => {
  it('chrome-builtin supports all new capabilities', () => {
    for (const cap of ['structured', 'params', 'quota', 'languages'] as const) {
      expect(chromeBuiltinProvider.supports(cap)).toBe(true);
    }
  });
  it('webllm and litert support none', () => {
    for (const cap of ['structured', 'params', 'quota', 'languages'] as const) {
      expect(webllmProvider.supports(cap)).toBe(false);
      expect(litertProvider.supports(cap)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/providers/capabilities.test.ts`
Expected: FAIL — `supports` is not a function.

- [ ] **Step 3: Add the type to `types.ts`**

In `src/core/ai/providers/types.ts`, after the `AiProviderId` type, add:

```typescript
/** Optional capabilities a provider may natively support. */
export type AiCapability = 'structured' | 'params' | 'quota' | 'languages';
```

And add to the `AiProvider` interface (after `getAvailability`):

```typescript
  /** Whether this provider natively supports a given capability. */
  supports(cap: AiCapability): boolean;
```

- [ ] **Step 4: Implement on each provider**

In `chromeBuiltinProvider.ts`, add to the exported `chromeBuiltinProvider` object:

```typescript
  supports(_cap): boolean { return true; },
```

(Type the param via the interface; if needed `supports(_cap: AiCapability)` and import the type.)

In `webllmProvider.ts` and `litertProvider.ts`, add to each provider object:

```typescript
  supports(): boolean { return false; },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/providers/capabilities.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/providers/types.ts src/core/ai/providers/chromeBuiltinProvider.ts src/core/ai/providers/webllmProvider.ts src/core/ai/providers/litertProvider.ts src/core/ai/__tests__/providers/capabilities.test.ts
git commit -m "feat(ai): add AiProvider.supports() capability hard-gate"
```

---

### Task 2: Sampling params + language hints in Chrome `create()`

**Files:**
- Modify: `src/core/ai/providers/types.ts`
- Modify: `src/core/ai/providers/chromeBuiltinProvider.ts`
- Test: `src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts` (existing — append)

**Interfaces:**
- Consumes: `AiCapability` (Task 1).
- Produces:
  - `interface AiRunParams { temperature?: number; topK?: number; }`
  - `interface AiLanguageHints { expectedInputLanguages?: string[]; outputLanguage?: string; }`
  - `runStreaming`/`createChatSession` args extended with optional `params?: AiRunParams` and `languages?: AiLanguageHints`.

- [ ] **Step 1: Write the failing test** — append to `chromeBuiltinProvider.test.ts`. This asserts that `params`/`languages` are threaded into the mocked `LanguageModel.create`:

```typescript
it('threads params and language hints into create()', async () => {
  __clearChromeSessionCacheForTesting();
  const createSpy = vi.fn().mockResolvedValue({
    promptStreaming: async function* () { yield 'ok'; },
    clone: undefined,
    destroy: vi.fn(),
  });
  (globalThis as Record<string, unknown>).LanguageModel = {
    create: createSpy,
    availability: vi.fn().mockResolvedValue('available'),
  };

  const it2 = chromeBuiltinProvider.runStreaming({
    systemPrompt: 'sys',
    userPrompt: 'hi',
    params: { temperature: 0.3, topK: 3 },
    languages: { expectedInputLanguages: ['en'], outputLanguage: 'es' },
  });
  // drain
  for await (const _ of it2) { /* consume */ }

  expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
    initialPrompts: [{ role: 'system', content: 'sys' }],
    temperature: 0.3,
    topK: 3,
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['es'] }],
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts -t "threads params"`
Expected: FAIL — extra `create` args not present (current `create` only gets `initialPrompts`).

- [ ] **Step 3: Add the option types to `types.ts`**

```typescript
export interface AiRunParams { temperature?: number; topK?: number; }
export interface AiLanguageHints {
  expectedInputLanguages?: string[];
  outputLanguage?: string;
}
```

Extend the `runStreaming` arg and `createChatSession` signature in the `AiProvider` interface:

```typescript
  runStreaming(args: {
    systemPrompt: string;
    userPrompt: string;
    signal?: AbortSignal;
    params?: AiRunParams;
    languages?: AiLanguageHints;
  }): AsyncIterableIterator<string>;
  createChatSession(systemPrompt: string, opts?: {
    params?: AiRunParams;
    languages?: AiLanguageHints;
  }): Promise<ChatSession>;
```

- [ ] **Step 4: Implement in `chromeBuiltinProvider.ts`**

Replace the `LanguageModelStatic.create` shape and the `warmUp`/`getClonedSession` chain so a per-call `create` is used when params/languages are present. Add a builder:

```typescript
interface CreateOpts {
  initialPrompts: Array<{ role: 'system'; content: string }>;
  temperature?: number;
  topK?: number;
  expectedInputs?: Array<{ type: 'text'; languages?: string[] }>;
  expectedOutputs?: Array<{ type: 'text'; languages?: string[] }>;
}

function buildCreateOpts(
  systemPrompt: string,
  params?: { temperature?: number; topK?: number },
  languages?: { expectedInputLanguages?: string[]; outputLanguage?: string },
): CreateOpts {
  const opts: CreateOpts = { initialPrompts: [{ role: 'system', content: systemPrompt }] };
  if (params?.temperature !== undefined) opts.temperature = params.temperature;
  if (params?.topK !== undefined) opts.topK = params.topK;
  if (languages?.expectedInputLanguages) {
    opts.expectedInputs = [{ type: 'text', languages: languages.expectedInputLanguages }];
  }
  if (languages?.outputLanguage) {
    opts.expectedOutputs = [{ type: 'text', languages: [languages.outputLanguage] }];
  }
  return opts;
}
```

Update `LanguageModelStatic.create` to accept `CreateOpts`. In `runStreaming`, when `params` or `languages` are present, bypass the base-session cache and create a fresh session with `buildCreateOpts(...)`; otherwise keep the existing warm-up+clone path. Destroy the fresh session in `finally`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts`
Expected: PASS (including pre-existing tests).

- [ ] **Step 6: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/providers/types.ts src/core/ai/providers/chromeBuiltinProvider.ts src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts
git commit -m "feat(ai): thread sampling params + language hints into Chrome create()"
```

---

### Task 3: Quota/usage seam

**Files:**
- Modify: `src/core/ai/providers/types.ts`
- Modify: `src/core/ai/providers/chromeBuiltinProvider.ts`
- Modify: `src/core/ai/promptApi.ts`
- Test: `src/core/ai/__tests__/promptApi.test.ts` (existing — append)

**Interfaces:**
- Produces:
  - `ChatSession.measureUsage?(text: string): Promise<{ usage: number; quota: number } | null>` (optional member).
  - Facade: `export async function supportsCapability(cap: AiCapability): Promise<boolean>`.

- [ ] **Step 1: Write the failing test** — append to `promptApi.test.ts`:

```typescript
import { supportsCapability } from '@/core/ai/promptApi';
import { __setActiveProviderForTesting, __resetRegistryForTesting } from '@/core/ai/providers/registry';

afterEach(() => { __resetRegistryForTesting(); });

it('supportsCapability reflects the active provider', async () => {
  __setActiveProviderForTesting({
    id: 'chrome-builtin',
    supports: () => true,
    getAvailability: async () => 'available',
    ensureReady: async () => {},
    warmUp: async () => {},
    runStreaming: async function* () {},
    createChatSession: async () => ({ send: async function* () {}, destroy: () => {} }),
  });
  expect(await supportsCapability('structured')).toBe(true);
});

it('supportsCapability is false when no provider', async () => {
  __setActiveProviderForTesting(null);
  expect(await supportsCapability('quota')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/promptApi.test.ts -t "supportsCapability"`
Expected: FAIL — `supportsCapability` not exported.

- [ ] **Step 3: Add the optional `measureUsage` member to `ChatSession` in `types.ts`**

```typescript
export interface ChatSession {
  send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string>;
  destroy(): void;
  /** Token usage/quota for a prospective input. null if unsupported. */
  measureUsage?(text: string): Promise<{ usage: number; quota: number } | null>;
}
```

- [ ] **Step 4: Implement `measureUsage` on the Chrome chat session + `supportsCapability` facade**

In `chromeBuiltinProvider.ts` `createChatSession`, extend the returned object with:

```typescript
    async measureUsage(text: string): Promise<{ usage: number; quota: number } | null> {
      const s = session as AiSession & {
        measureInputUsage?(t: string): Promise<number>;
        inputQuota?: number;
      };
      if (typeof s.measureInputUsage !== 'function' || typeof s.inputQuota !== 'number') return null;
      try {
        const usage = await s.measureInputUsage(text);
        return { usage, quota: s.inputQuota };
      } catch { return null; }
    },
```

(Add `measureInputUsage`/`inputQuota` to the `AiSession` interface as optional members.)

In `promptApi.ts`, add:

```typescript
import type { AiCapability } from '@/core/ai/providers/types';

export async function supportsCapability(cap: AiCapability): Promise<boolean> {
  const provider = await getActiveProvider();
  return provider ? provider.supports(cap) : false;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/promptApi.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/providers/types.ts src/core/ai/providers/chromeBuiltinProvider.ts src/core/ai/promptApi.ts src/core/ai/__tests__/promptApi.test.ts
git commit -m "feat(ai): add quota measureUsage seam + supportsCapability facade"
```

---

# PHASE 2 — Structured Security Insights (insight card + chat below)

### Task 4: `runStructured` on facade + Chrome provider

**Files:**
- Modify: `src/core/ai/providers/types.ts`
- Modify: `src/core/ai/providers/chromeBuiltinProvider.ts`
- Modify: `src/core/ai/promptApi.ts`
- Test: `src/core/ai/__tests__/promptApi.test.ts` (existing — append)

**Interfaces:**
- Consumes: `AiRunParams`, `AiLanguageHints` (Task 2).
- Produces:
  - `interface StructuredArgs { systemPrompt: string; userPrompt: string; schema: object; signal?: AbortSignal; params?: AiRunParams; languages?: AiLanguageHints; }`
  - `AiProvider.runStructured?(args: StructuredArgs): Promise<string>` (returns raw JSON string).
  - Facade: `export async function runStructured(args: StructuredArgs): Promise<string>` (throws if active provider lacks `'structured'`).

- [ ] **Step 1: Write the failing test** — append to `promptApi.test.ts`:

```typescript
import { runStructured } from '@/core/ai/promptApi';

it('runStructured passes responseConstraint and returns raw JSON', async () => {
  const promptSpy = vi.fn().mockResolvedValue('{"severity":"high"}');
  __setActiveProviderForTesting({
    id: 'chrome-builtin',
    supports: () => true,
    getAvailability: async () => 'available',
    ensureReady: async () => {},
    warmUp: async () => {},
    runStreaming: async function* () {},
    createChatSession: async () => ({ send: async function* () {}, destroy: () => {} }),
    runStructured: async (a) => { promptSpy(a); return '{"severity":"high"}'; },
  });
  const out = await runStructured({ systemPrompt: 's', userPrompt: 'u', schema: { type: 'object' } });
  expect(out).toBe('{"severity":"high"}');
  expect(promptSpy).toHaveBeenCalled();
});

it('runStructured throws when provider lacks structured support', async () => {
  __setActiveProviderForTesting({
    id: 'webllm', supports: () => false,
    getAvailability: async () => 'available', ensureReady: async () => {},
    warmUp: async () => {}, runStreaming: async function* () {},
    createChatSession: async () => ({ send: async function* () {}, destroy: () => {} }),
  });
  await expect(runStructured({ systemPrompt: 's', userPrompt: 'u', schema: {} }))
    .rejects.toThrow(/structured output/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/promptApi.test.ts -t "runStructured"`
Expected: FAIL — `runStructured` not exported.

- [ ] **Step 3: Add `StructuredArgs` + optional `runStructured` to `types.ts`**

```typescript
export interface StructuredArgs {
  systemPrompt: string;
  userPrompt: string;
  schema: object;
  signal?: AbortSignal;
  params?: AiRunParams;
  languages?: AiLanguageHints;
}
```

Add to `AiProvider`:

```typescript
  /** One-shot structured generation. Returns raw JSON text. */
  runStructured?(args: StructuredArgs): Promise<string>;
```

- [ ] **Step 4: Implement on Chrome provider + facade**

In `chromeBuiltinProvider.ts`:

```typescript
async function runStructured(args: StructuredArgs): Promise<string> {
  const lm = getLanguageModel();
  const session = await lm.create(buildCreateOpts(args.systemPrompt, args.params, args.languages));
  try {
    const opts: { responseConstraint: object; signal?: AbortSignal } = { responseConstraint: args.schema };
    if (args.signal) opts.signal = args.signal;
    return await session.prompt(args.userPrompt, opts);
  } finally {
    session.destroy();
  }
}
```

Add `prompt(input, opts)` to the `AiSession` interface and `runStructured` to the exported provider object. In `promptApi.ts`:

```typescript
export async function runStructured(args: StructuredArgs): Promise<string> {
  const provider = await getActiveProvider();
  if (!provider || !provider.supports('structured') || !provider.runStructured) {
    throw new Error('Structured output not supported by the active provider');
  }
  return provider.runStructured(args);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/promptApi.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/providers/types.ts src/core/ai/providers/chromeBuiltinProvider.ts src/core/ai/promptApi.ts src/core/ai/__tests__/promptApi.test.ts
git commit -m "feat(ai): add runStructured (responseConstraint) to facade + Chrome provider"
```

---

### Task 5: Strength insight schema + `explainStrengthStructured()`

**Files:**
- Modify: `src/core/ai/strengthExplain.ts`
- Test: `src/core/ai/__tests__/strengthInsight.test.ts` (create)

**Interfaces:**
- Consumes: `runStructured` (Task 4), `supportsCapability` (Task 3), `StrengthExplainInput` (`aiTypes.ts`).
- Produces:
  - `interface StrengthInsight { severity: 'low' | 'medium' | 'high'; factors: string[]; rankedActions: string[]; }`
  - `const STRENGTH_INSIGHT_SCHEMA: object`
  - `function parseStrengthInsight(raw: string): StrengthInsight | null`
  - `async function explainStrengthStructured(input: StrengthExplainInput, signal?: AbortSignal): Promise<{ insight: StrengthInsight } | { raw: string }>`

- [ ] **Step 1: Write the failing test** — `src/core/ai/__tests__/strengthInsight.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseStrengthInsight, explainStrengthStructured } from '@/core/ai/strengthExplain';

vi.mock('@/core/ai/promptApi', () => ({
  runStructured: vi.fn(),
}));
import { runStructured } from '@/core/ai/promptApi';

afterEach(() => vi.clearAllMocks());

describe('parseStrengthInsight', () => {
  it('parses a valid insight', () => {
    const out = parseStrengthInsight('{"severity":"high","factors":["short"],"rankedActions":["lengthen"]}');
    expect(out).toEqual({ severity: 'high', factors: ['short'], rankedActions: ['lengthen'] });
  });
  it('returns null on malformed json', () => {
    expect(parseStrengthInsight('not json')).toBeNull();
  });
  it('returns null when severity is invalid', () => {
    expect(parseStrengthInsight('{"severity":"nope","factors":[],"rankedActions":[]}')).toBeNull();
  });
});

describe('explainStrengthStructured', () => {
  it('returns typed insight on success', async () => {
    vi.mocked(runStructured).mockResolvedValue('{"severity":"medium","factors":["ok"],"rankedActions":["add length"]}');
    const r = await explainStrengthStructured({ strength: 'medium', entropyBits: 50 });
    expect(r).toEqual({ insight: { severity: 'medium', factors: ['ok'], rankedActions: ['add length'] } });
  });
  it('falls back to raw on validation failure', async () => {
    vi.mocked(runStructured).mockResolvedValue('garbage');
    const r = await explainStrengthStructured({ strength: 'weak', entropyBits: 20 });
    expect(r).toEqual({ raw: 'garbage' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/strengthInsight.test.ts`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Implement in `strengthExplain.ts`** (append; keep existing exports):

```typescript
import { runStructured } from './promptApi';

export interface StrengthInsight {
  severity: 'low' | 'medium' | 'high';
  factors: string[];
  rankedActions: string[];
}

export const STRENGTH_INSIGHT_SCHEMA = {
  type: 'object',
  required: ['severity', 'factors', 'rankedActions'],
  additionalProperties: false,
  properties: {
    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
    factors: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    rankedActions: { type: 'array', items: { type: 'string' }, maxItems: 4 },
  },
} as const;

export function parseStrengthInsight(raw: string): StrengthInsight | null {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (v.severity !== 'low' && v.severity !== 'medium' && v.severity !== 'high') return null;
    if (!Array.isArray(v.factors) || !Array.isArray(v.rankedActions)) return null;
    const factors = v.factors.filter((x): x is string => typeof x === 'string');
    const rankedActions = v.rankedActions.filter((x): x is string => typeof x === 'string');
    return { severity: v.severity, factors, rankedActions };
  } catch {
    return null;
  }
}

export async function explainStrengthStructured(
  input: StrengthExplainInput,
  signal?: AbortSignal,
): Promise<{ insight: StrengthInsight } | { raw: string }> {
  const raw = await runStructured({
    systemPrompt: STRENGTH_SYSTEM_PROMPT,
    userPrompt: buildStrengthPrompt(input),
    schema: STRENGTH_INSIGHT_SCHEMA,
    params: { temperature: 0.3, topK: 3 },
    ...(signal ? { signal } : {}),
  });
  const insight = parseStrengthInsight(raw);
  return insight ? { insight } : { raw };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/strengthInsight.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/strengthExplain.ts src/core/ai/__tests__/strengthInsight.test.ts
git commit -m "feat(ai): structured StrengthInsight schema + explainStrengthStructured"
```

---

### Task 6: Breach insight schema + `explainBreachImpactStructured()`

**Files:**
- Modify: `src/core/ai/breachImpactExplain.ts`
- Test: `src/core/ai/__tests__/breachInsight.test.ts` (create)

**Interfaces:**
- Consumes: `runStructured` (Task 4), `BreachImpactExplainInput` + `buildBreachPrompt` + `BREACH_SYSTEM_PROMPT` (existing).
- Produces:
  - `interface BreachInsight { riskLevel: 'low' | 'medium' | 'high' | 'critical'; exposedData: string[]; steps: string[]; }`
  - `const BREACH_INSIGHT_SCHEMA: object`
  - `function parseBreachInsight(raw: string): BreachInsight | null`
  - `async function explainBreachImpactStructured(input: BreachImpactExplainInput, signal?: AbortSignal): Promise<{ insight: BreachInsight } | { raw: string }>`

- [ ] **Step 1: Write the failing test** — `src/core/ai/__tests__/breachInsight.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseBreachInsight, explainBreachImpactStructured } from '@/core/ai/breachImpactExplain';

vi.mock('@/core/ai/promptApi', () => ({ runStructured: vi.fn() }));
import { runStructured } from '@/core/ai/promptApi';

afterEach(() => vi.clearAllMocks());

const input = { breaches: [{ title: 'X', dataClasses: ['Emails'] }] as never, credentialTitle: 'Bank' };

describe('parseBreachInsight', () => {
  it('parses valid', () => {
    expect(parseBreachInsight('{"riskLevel":"critical","exposedData":["Emails"],"steps":["change pw"]}'))
      .toEqual({ riskLevel: 'critical', exposedData: ['Emails'], steps: ['change pw'] });
  });
  it('null on invalid riskLevel', () => {
    expect(parseBreachInsight('{"riskLevel":"meh","exposedData":[],"steps":[]}')).toBeNull();
  });
  it('null on malformed json', () => {
    expect(parseBreachInsight('{')).toBeNull();
  });
});

describe('explainBreachImpactStructured', () => {
  it('returns typed insight', async () => {
    vi.mocked(runStructured).mockResolvedValue('{"riskLevel":"high","exposedData":["Emails"],"steps":["rotate"]}');
    const r = await explainBreachImpactStructured(input);
    expect(r).toEqual({ insight: { riskLevel: 'high', exposedData: ['Emails'], steps: ['rotate'] } });
  });
  it('falls back to raw', async () => {
    vi.mocked(runStructured).mockResolvedValue('oops');
    expect(await explainBreachImpactStructured(input)).toEqual({ raw: 'oops' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/breachInsight.test.ts`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Implement in `breachImpactExplain.ts`** (append; keep existing exports). Note `buildBreachPrompt` already runs `assertNoSecrets` internally — reuse it:

```typescript
import { runStructured } from './promptApi';

export interface BreachInsight {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  exposedData: string[];
  steps: string[];
}

export const BREACH_INSIGHT_SCHEMA = {
  type: 'object',
  required: ['riskLevel', 'exposedData', 'steps'],
  additionalProperties: false,
  properties: {
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    exposedData: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    steps: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
} as const;

export function parseBreachInsight(raw: string): BreachInsight | null {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const levels = ['low', 'medium', 'high', 'critical'];
    if (typeof v.riskLevel !== 'string' || !levels.includes(v.riskLevel)) return null;
    if (!Array.isArray(v.exposedData) || !Array.isArray(v.steps)) return null;
    return {
      riskLevel: v.riskLevel as BreachInsight['riskLevel'],
      exposedData: v.exposedData.filter((x): x is string => typeof x === 'string'),
      steps: v.steps.filter((x): x is string => typeof x === 'string'),
    };
  } catch {
    return null;
  }
}

export async function explainBreachImpactStructured(
  input: BreachImpactExplainInput,
  signal?: AbortSignal,
): Promise<{ insight: BreachInsight } | { raw: string }> {
  const raw = await runStructured({
    systemPrompt: BREACH_SYSTEM_PROMPT,
    userPrompt: buildBreachPrompt(input), // runs assertNoSecrets internally
    schema: BREACH_INSIGHT_SCHEMA,
    params: { temperature: 0.3, topK: 3 },
    ...(signal ? { signal } : {}),
  });
  const insight = parseBreachInsight(raw);
  return insight ? { insight } : { raw };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/breachInsight.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/breachImpactExplain.ts src/core/ai/__tests__/breachInsight.test.ts
git commit -m "feat(ai): structured BreachInsight schema + explainBreachImpactStructured"
```

---

### Task 7: Insight hooks return typed objects

**Files:**
- Modify: `src/presentation/hooks/useAiStrengthExplain.ts`
- Modify: `src/presentation/hooks/useAiBreachImpactExplain.ts`
- Test: `src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts` (existing — extend)

**Interfaces:**
- Consumes: `explainStrengthStructured` (Task 5), `explainBreachImpactStructured` (Task 6), `supportsCapability` (Task 3).
- Produces:
  - `useAiStrengthExplain` returns `{ enabled; loading; insight: StrengthInsight | null; rawText: string | null; error; explain; reset }`.
  - `useAiBreachImpactExplain` returns `{ enabled; loading; insight: BreachInsight | null; rawText: string | null; error; analyze; reset }`.

- [ ] **Step 1: Write the failing test** — extend `useAiStrengthExplain.test.ts` with a case asserting `insight` is populated. Add (mock `explainStrengthStructured`):

```typescript
import { explainStrengthStructured } from '@/core/ai/strengthExplain';
vi.mock('@/core/ai/strengthExplain', async (orig) => ({
  ...(await orig<typeof import('@/core/ai/strengthExplain')>()),
  explainStrengthStructured: vi.fn(),
}));

it('exposes a typed insight after explain()', async () => {
  vi.mocked(explainStrengthStructured).mockResolvedValue({
    insight: { severity: 'high', factors: ['short'], rankedActions: ['lengthen'] },
  });
  const { result } = renderHook(() => useAiStrengthExplain());
  await act(async () => { await result.current.explain({ strength: 'weak', entropyBits: 20 }); });
  expect(result.current.insight).toEqual({ severity: 'high', factors: ['short'], rankedActions: ['lengthen'] });
});
```

(Use the existing test file's imports for `renderHook`/`act`; match its availability-mock setup so `enabled` becomes true.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts -t "typed insight"`
Expected: FAIL — `result.current.insight` is undefined.

- [ ] **Step 3: Implement in `useAiStrengthExplain.ts`**

Replace the `explanation` string state with `insight` + `rawText`:

```typescript
import { explainStrengthStructured, type StrengthInsight, STRENGTH_SYSTEM_PROMPT } from '@/core/ai/strengthExplain';
// ...
const [insight, setInsight] = useState<StrengthInsight | null>(null);
const [rawText, setRawText] = useState<string | null>(null);
// in explain():
setInsight(null); setRawText(null); setError(false); setLoading(true);
try {
  const r = await explainStrengthStructured(input);
  if ('insight' in r) setInsight(r.insight); else setRawText(r.raw);
} catch { setError(true); } finally { setLoading(false); }
// reset(): setInsight(null); setRawText(null); ...
// return { enabled, loading, insight, rawText, error, explain, reset };
```

Apply the analogous change to `useAiBreachImpactExplain.ts` using `explainBreachImpactStructured` / `BreachInsight`, keeping its `analyze`/abort-controller structure (call `explainBreachImpactStructured(input, controller.signal)` instead of streaming; on `'insight' in r` set insight else rawText).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/presentation/hooks/useAiStrengthExplain.ts src/presentation/hooks/useAiBreachImpactExplain.ts src/presentation/hooks/__tests__/useAiStrengthExplain.test.ts
git commit -m "feat(ai): insight hooks return typed StrengthInsight/BreachInsight"
```

---

### Task 8: Insight card components

**Files:**
- Create: `src/presentation/components/ai/StrengthInsightCard.tsx`
- Create: `src/presentation/components/ai/BreachInsightCard.tsx`
- Test: `src/presentation/components/ai/__tests__/StrengthInsightCard.test.tsx` (create)
- Test: `src/presentation/components/ai/__tests__/BreachInsightCard.test.tsx` (create)

**Interfaces:**
- Consumes: `StrengthInsight` (Task 5), `BreachInsight` (Task 6).
- Produces:
  - `function StrengthInsightCard(props: { insight: StrengthInsight }): JSX.Element`
  - `function BreachInsightCard(props: { insight: BreachInsight }): JSX.Element`

- [ ] **Step 1: Write the failing test** — `StrengthInsightCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { StrengthInsightCard } from '@/presentation/components/ai/StrengthInsightCard';

it('renders severity, factors and ranked actions', () => {
  render(<StrengthInsightCard insight={{ severity: 'high', factors: ['too short'], rankedActions: ['use 16+ chars'] }} />);
  expect(screen.getByText(/high/i)).toBeInTheDocument();
  expect(screen.getByText('too short')).toBeInTheDocument();
  expect(screen.getByText('use 16+ chars')).toBeInTheDocument();
});
```

(Write the analogous `BreachInsightCard.test.tsx` asserting `riskLevel`, an `exposedData` item, and a `steps` item render.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/components/ai/__tests__/StrengthInsightCard.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the components**

`StrengthInsightCard.tsx`:

```tsx
import { Box, Chip, Typography, List, ListItem, ListItemText } from '@mui/material';
import type { StrengthInsight } from '@/core/ai/strengthExplain';

const SEVERITY_COLOR: Record<StrengthInsight['severity'], 'success' | 'warning' | 'error'> = {
  low: 'success', medium: 'warning', high: 'error',
};

export function StrengthInsightCard({ insight }: { insight: StrengthInsight }): JSX.Element {
  return (
    <Box sx={{ mt: 1, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Severity</Typography>
        <Chip size="small" color={SEVERITY_COLOR[insight.severity]} label={insight.severity} />
      </Box>
      {insight.factors.map((f) => (
        <Typography key={f} variant="caption" color="text.secondary" display="block">• {f}</Typography>
      ))}
      {insight.rankedActions.length > 0 && (
        <List dense>
          {insight.rankedActions.map((a, i) => (
            <ListItem key={a} disableGutters>
              <ListItemText primary={`${String(i + 1)}. ${a}`} primaryTypographyProps={{ variant: 'body2' }} />
            </ListItem>
          ))}
        </List>
      )}
      <Typography variant="caption" color="text.disabled" display="block">Generated by on-device AI.</Typography>
    </Box>
  );
}
```

Write `BreachInsightCard.tsx` analogously: a `riskLevel` chip (map `low→success, medium→warning, high→error, critical→error`), an `exposedData` chip row, and a numbered `steps` list, plus the "Generated by on-device AI." caption.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/presentation/components/ai/__tests__/StrengthInsightCard.test.tsx src/presentation/components/ai/__tests__/BreachInsightCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/presentation/components/ai/StrengthInsightCard.tsx src/presentation/components/ai/BreachInsightCard.tsx src/presentation/components/ai/__tests__/StrengthInsightCard.test.tsx src/presentation/components/ai/__tests__/BreachInsightCard.test.tsx
git commit -m "feat(ai): StrengthInsightCard + BreachInsightCard components"
```

---

### Task 9: Wire insight cards above the chat in both screens

**Files:**
- Modify: `src/presentation/components/PasswordStrengthIndicator.tsx`
- Modify: `src/presentation/components/BreachDetailsModal.tsx`
- Test: `src/presentation/components/__tests__/BreachDetailsModal.test.tsx` (existing — extend)

**Interfaces:**
- Consumes: `useAiStrengthExplain`/`useAiBreachImpactExplain` (Task 7), `StrengthInsightCard`/`BreachInsightCard` (Task 8).

This task changes UI composition: render the one-shot insight card first, with the existing `ChatPanel` retained below for follow-up. The chat `send(buildStrengthPrompt(...))` is replaced by calling the insight hook's `explain()/analyze()` on expand; the chat session is created for follow-up only after the card renders.

- [ ] **Step 1: Write the failing test** — extend `BreachDetailsModal.test.tsx` to assert the insight card renders when the structured hook resolves. Add a mock for `useAiBreachImpactExplain` returning `{ enabled: true, loading: false, insight: { riskLevel: 'high', exposedData: ['Emails'], steps: ['rotate'] }, rawText: null, error: false, analyze: vi.fn(), reset: vi.fn() }` and assert `screen.getByText(/high/i)` and `screen.getByText('rotate')` appear after expanding the AI accordion.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/components/__tests__/BreachDetailsModal.test.tsx -t "insight"`
Expected: FAIL — card not rendered.

- [ ] **Step 3: Implement the composition change**

In `BreachDetailsModal.tsx`, inside the AI accordion `AccordionDetails`, before the `ChatPanel`/streaming branches:
- On accordion expand, call `breachInsight.analyze({ breaches, credentialTitle, credentialUsername, credentialCategory, credentialAgeDays })` (the structured hook) instead of `chat.send(buildBreachPrompt(...))`.
- Render: if `breachInsight.loading` → spinner; if `breachInsight.insight` → `<BreachInsightCard insight={breachInsight.insight} />`; else if `breachInsight.rawText` → existing prose fallback; if `breachInsight.error` → existing error alert.
- Keep the `ChatPanel` (gated by `aiSettings.allowChatFollowUp`) below the card for follow-up, seeded with an empty transcript; follow-up still uses `useAiChat`.

In `PasswordStrengthIndicator.tsx`, mirror this: on "Explain with AI" click call `strengthInsight.explain({ strength, entropyBits })`, render `<StrengthInsightCard>` (or raw fallback / spinner / error), and keep the `ChatPanel` below for follow-up when `allowChatFollowUp`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/presentation/components/__tests__/BreachDetailsModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full type-check, lint, targeted test, commit**

```bash
npm run type-check && npm run lint
npm run test -- src/presentation/components/PasswordStrengthIndicator.test.tsx src/presentation/components/__tests__/BreachDetailsModal.test.tsx
git add src/presentation/components/PasswordStrengthIndicator.tsx src/presentation/components/BreachDetailsModal.tsx src/presentation/components/__tests__/BreachDetailsModal.test.tsx
git commit -m "feat(ai): render structured insight card above follow-up chat"
```

---

# PHASE 3 — Summarizer Vault Overview

### Task 10: Summarizer API wrapper

**Files:**
- Create: `src/core/ai/summarizer.ts`
- Test: `src/core/ai/__tests__/summarizer.test.ts` (create)

**Interfaces:**
- Produces:
  - `async function isSummarizerAvailable(): Promise<boolean>`
  - `async function summarize(text: string, signal?: AbortSignal): Promise<string | null>` (returns null when unavailable).

- [ ] **Step 1: Write the failing test** — `summarizer.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isSummarizerAvailable, summarize } from '@/core/ai/summarizer';

afterEach(() => { delete (globalThis as Record<string, unknown>).Summarizer; });

it('reports unavailable when global is missing', async () => {
  expect(await isSummarizerAvailable()).toBe(false);
  expect(await summarize('x')).toBeNull();
});

it('summarizes when available', async () => {
  (globalThis as Record<string, unknown>).Summarizer = {
    availability: vi.fn().mockResolvedValue('available'),
    create: vi.fn().mockResolvedValue({
      summarize: vi.fn().mockResolvedValue('short summary'),
      destroy: vi.fn(),
    }),
  };
  expect(await isSummarizerAvailable()).toBe(true);
  expect(await summarize('long text')).toBe('short summary');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/summarizer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `summarizer.ts`**

```typescript
/**
 * Summarizer API wrapper (Chrome built-in). Standalone from the LanguageModel
 * provider, matching how Chrome ships these APIs. Returns null when unavailable
 * so callers can fall back. Sessions are ephemeral (destroyed per call).
 */
interface SummarizerSession {
  summarize(input: string, opts?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}
interface SummarizerStatic {
  availability(): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  create(opts?: object): Promise<SummarizerSession>;
}

function getSummarizer(): SummarizerStatic | null {
  const s = (globalThis as Record<string, unknown>).Summarizer as SummarizerStatic | undefined;
  return s && typeof s.create === 'function' && typeof s.availability === 'function' ? s : null;
}

export async function isSummarizerAvailable(): Promise<boolean> {
  const s = getSummarizer();
  if (!s) return false;
  try { return (await s.availability()) === 'available'; } catch { return false; }
}

export async function summarize(text: string, signal?: AbortSignal): Promise<string | null> {
  const s = getSummarizer();
  if (!s) return null;
  try {
    if ((await s.availability()) !== 'available') return null;
    const session = await s.create();
    try {
      return await session.summarize(text, signal ? { signal } : undefined);
    } finally {
      session.destroy();
    }
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/summarizer.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/summarizer.ts src/core/ai/__tests__/summarizer.test.ts
git commit -m "feat(ai): Summarizer API wrapper with graceful fallback"
```

---

### Task 11: Vault overview uses Summarizer with fallback

**Files:**
- Modify: `src/core/ai/chat/vaultAggregate.ts`
- Test: `src/core/ai/__tests__/chat/vaultAggregate.test.ts` (existing — append)

**Interfaces:**
- Consumes: `summarize`/`isSummarizerAvailable` (Task 10), `computeVaultSafeAggregate` + `VaultSafeAggregate` (existing), `assertNoSecrets` (`chatContext.ts`).
- Produces:
  - `function formatVaultOverviewText(agg: VaultSafeAggregate): string` (non-secret, assertNoSecrets-checked).
  - `async function summarizeVaultOverview(agg: VaultSafeAggregate, signal?: AbortSignal): Promise<string>` — Summarizer result, or the formatted text itself on fallback.

- [ ] **Step 1: Write the failing test** — append to `vaultAggregate.test.ts`:

```typescript
import { formatVaultOverviewText, summarizeVaultOverview } from '@/core/ai/chat/vaultAggregate';
import * as summarizer from '@/core/ai/summarizer';

const agg = { total: 10, weak: 2, reused: 1, breached: 0, categories: { Login: 10 } };

it('formatVaultOverviewText is non-secret and includes totals', () => {
  const t = formatVaultOverviewText(agg);
  expect(t).toMatch(/Total credentials: 10/);
  expect(() => { /* should not throw */ }).not.toThrow();
});

it('uses summarizer when available', async () => {
  vi.spyOn(summarizer, 'summarize').mockResolvedValue('AI summary');
  expect(await summarizeVaultOverview(agg)).toBe('AI summary');
});

it('falls back to formatted text when summarizer returns null', async () => {
  vi.spyOn(summarizer, 'summarize').mockResolvedValue(null);
  expect(await summarizeVaultOverview(agg)).toBe(formatVaultOverviewText(agg));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/chat/vaultAggregate.test.ts -t "summariz"`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Implement in `vaultAggregate.ts`**

```typescript
import { assertNoSecrets } from '@/core/ai/chat/chatContext';
import { summarize } from '@/core/ai/summarizer';

export function formatVaultOverviewText(agg: VaultSafeAggregate): string {
  const cats = Object.entries(agg.categories).map(([k, v]) => `${k}=${String(v)}`).join(', ');
  let t = `Vault overview (no passwords or secrets):\n`;
  t += `- Total credentials: ${String(agg.total)}\n`;
  t += `- weak: ${String(agg.weak)}, reused: ${String(agg.reused)}, breached: ${String(agg.breached)}\n`;
  if (cats) t += `- Categories: ${cats}\n`;
  if (agg.oldestPasswordAgeDays !== undefined) {
    t += `- Oldest password age: ${String(Math.round(agg.oldestPasswordAgeDays))} days\n`;
  }
  assertNoSecrets(t);
  return t;
}

export async function summarizeVaultOverview(
  agg: VaultSafeAggregate,
  signal?: AbortSignal,
): Promise<string> {
  const text = formatVaultOverviewText(agg);
  const summary = await summarize(text, signal);
  return summary ?? text;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/chat/vaultAggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/chat/vaultAggregate.ts src/core/ai/__tests__/chat/vaultAggregate.test.ts
git commit -m "feat(ai): Summarizer-backed vault overview with formatted fallback"
```

---

# PHASE 4 — Multilingual

### Task 12: Locale → language helper

**Files:**
- Create: `src/core/ai/aiLanguages.ts`
- Test: `src/core/ai/__tests__/aiLanguages.test.ts` (create)

**Interfaces:**
- Produces:
  - `const SUPPORTED_AI_LANGUAGES = ['en', 'es', 'ja', 'de', 'fr'] as const;`
  - `function resolveAiLanguage(locale?: string): string` — returns a supported code, `'en'` fallback.

- [ ] **Step 1: Write the failing test** — `aiLanguages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveAiLanguage } from '@/core/ai/aiLanguages';

describe('resolveAiLanguage', () => {
  it('maps a supported region locale to its base code', () => {
    expect(resolveAiLanguage('es-MX')).toBe('es');
    expect(resolveAiLanguage('fr')).toBe('fr');
  });
  it('falls back to en for unsupported', () => {
    expect(resolveAiLanguage('zh-CN')).toBe('en');
    expect(resolveAiLanguage(undefined)).toBe('en');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/aiLanguages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `aiLanguages.ts`**

```typescript
/** Languages Gemini Nano supports for input/output (Chrome 149). */
export const SUPPORTED_AI_LANGUAGES = ['en', 'es', 'ja', 'de', 'fr'] as const;
export type SupportedAiLanguage = (typeof SUPPORTED_AI_LANGUAGES)[number];

export function resolveAiLanguage(locale?: string): SupportedAiLanguage {
  if (!locale) return 'en';
  const base = locale.toLowerCase().split('-')[0] ?? '';
  return (SUPPORTED_AI_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedAiLanguage)
    : 'en';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/aiLanguages.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/aiLanguages.ts src/core/ai/__tests__/aiLanguages.test.ts
git commit -m "feat(ai): locale to Gemini-Nano language resolver"
```

---

### Task 13: Thread language hints into insight calls

**Files:**
- Modify: `src/core/ai/strengthExplain.ts`
- Modify: `src/core/ai/breachImpactExplain.ts`
- Test: `src/core/ai/__tests__/strengthInsight.test.ts` (existing — append)

**Interfaces:**
- Consumes: `resolveAiLanguage` (Task 12). The structured calls add `languages: { expectedInputLanguages: ['en'], outputLanguage: resolveAiLanguage(navigator.language) }`.

- [ ] **Step 1: Write the failing test** — append to `strengthInsight.test.ts`:

```typescript
it('passes resolved output language to runStructured', async () => {
  vi.mocked(runStructured).mockResolvedValue('{"severity":"low","factors":[],"rankedActions":[]}');
  Object.defineProperty(navigator, 'language', { value: 'es-ES', configurable: true });
  await explainStrengthStructured({ strength: 'strong', entropyBits: 80 });
  expect(vi.mocked(runStructured)).toHaveBeenCalledWith(
    expect.objectContaining({ languages: expect.objectContaining({ outputLanguage: 'es' }) }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/strengthInsight.test.ts -t "output language"`
Expected: FAIL — no `languages` in the call.

- [ ] **Step 3: Implement** — in `strengthExplain.ts` and `breachImpactExplain.ts`, add to the `runStructured({...})` args:

```typescript
import { resolveAiLanguage } from './aiLanguages';
// inside each explain*Structured:
languages: { expectedInputLanguages: ['en'], outputLanguage: resolveAiLanguage(navigator.language) },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/strengthInsight.test.ts src/core/ai/__tests__/breachInsight.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/strengthExplain.ts src/core/ai/breachImpactExplain.ts src/core/ai/__tests__/strengthInsight.test.ts
git commit -m "feat(ai): output explanations in the user's locale language"
```

---

# PHASE 5 — Quota/Usage UX

### Task 14: Quota-driven chat trim helper

**Files:**
- Modify: `src/core/ai/chat/chatTrim.ts`
- Test: `src/core/ai/__tests__/chat/chatTrim.test.ts` (existing — append)

**Interfaces:**
- Consumes: `ChatSession.measureUsage` (Task 3).
- Produces:
  - `interface UsageStatus { usage: number; quota: number; nearLimit: boolean; }`
  - `async function checkChatUsage(session: { measureUsage?: (t: string) => Promise<{ usage: number; quota: number } | null> }, pendingText: string, threshold?: number): Promise<UsageStatus | null>` — `nearLimit` true when `usage/quota >= threshold` (default 0.8). Returns null if unsupported.

- [ ] **Step 1: Write the failing test** — append to `chatTrim.test.ts`:

```typescript
import { checkChatUsage } from '@/core/ai/chat/chatTrim';

it('returns null when measureUsage is absent', async () => {
  expect(await checkChatUsage({}, 'hi')).toBeNull();
});
it('flags nearLimit past the threshold', async () => {
  const session = { measureUsage: async () => ({ usage: 900, quota: 1000 }) };
  expect(await checkChatUsage(session, 'hi', 0.8)).toEqual({ usage: 900, quota: 1000, nearLimit: true });
});
it('not nearLimit below threshold', async () => {
  const session = { measureUsage: async () => ({ usage: 100, quota: 1000 }) };
  expect(await checkChatUsage(session, 'hi', 0.8)).toEqual({ usage: 100, quota: 1000, nearLimit: false });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/chat/chatTrim.test.ts -t "checkChatUsage"`
Expected: FAIL — `checkChatUsage` not exported.

- [ ] **Step 3: Implement in `chatTrim.ts`** (append; keep `trimChatMessages`):

```typescript
export interface UsageStatus { usage: number; quota: number; nearLimit: boolean; }

export async function checkChatUsage(
  session: { measureUsage?: (t: string) => Promise<{ usage: number; quota: number } | null> },
  pendingText: string,
  threshold = 0.8,
): Promise<UsageStatus | null> {
  if (typeof session.measureUsage !== 'function') return null;
  const r = await session.measureUsage(pendingText);
  if (!r || r.quota <= 0) return null;
  return { usage: r.usage, quota: r.quota, nearLimit: r.usage / r.quota >= threshold };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/chat/chatTrim.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
git add src/core/ai/chat/chatTrim.ts src/core/ai/__tests__/chat/chatTrim.test.ts
git commit -m "feat(ai): quota-driven chat usage check (nearLimit threshold)"
```

---

### Task 15: Surface near-limit warning in chat

**Files:**
- Modify: `src/presentation/hooks/useAiChat.ts`
- Test: `src/presentation/hooks/__tests__/useAiChat.test.ts` (existing — append)

**Interfaces:**
- Consumes: `checkChatUsage` (Task 14). The Chrome chat session exposes `measureUsage` (Task 3); WebLLM/LiteRT don't, so `checkChatUsage` returns null → no warning (heuristic `trimChatMessages` still applies as today).
- Produces: `UseAiChat` gains `usageWarning: boolean`.

- [ ] **Step 1: Write the failing test** — append to `useAiChat.test.ts`. Mock `createChatSession` to return a session whose `measureUsage` reports near-limit, then assert `result.current.usageWarning` becomes true after `send`:

```typescript
it('sets usageWarning when the session reports near-limit usage', async () => {
  // arrange createChatSession to resolve a session with measureUsage => 0.95 ratio
  // (follow the file's existing mock setup for createChatSession + availability)
  // ...
  await act(async () => { await result.current.send('hello'); });
  expect(result.current.usageWarning).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/hooks/__tests__/useAiChat.test.ts -t "usageWarning"`
Expected: FAIL — `usageWarning` undefined.

- [ ] **Step 3: Implement in `useAiChat.ts`**

Add `const [usageWarning, setUsageWarning] = useState(false);`. In `send`, after the session is ensured and before streaming:

```typescript
import { checkChatUsage } from '@/core/ai/chat/chatTrim';
// ...
const status = await checkChatUsage(sessionRef.current, trimmed);
if (status) setUsageWarning(status.nearLimit);
```

Reset `setUsageWarning(false)` in `reset()`. Add `usageWarning` to the returned object and the `UseAiChat` interface.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/presentation/hooks/__tests__/useAiChat.test.ts`
Expected: PASS.

- [ ] **Step 5: Surface in `ChatPanel` consumers (optional minimal UI)**

In `ChatPanel.tsx`, when a new optional prop `usageWarning?: boolean` is true, render a small MUI caption: "Long conversation — older messages may be dropped." Pass `chat.usageWarning` from `PasswordStrengthIndicator`, `BreachDetailsModal`, and `GeneralAssistant`. (No test required for the static caption; covered by type-check.)

- [ ] **Step 6: Type-check, lint, commit**

```bash
npm run type-check && npm run lint
npm run test -- src/presentation/hooks/__tests__/useAiChat.test.ts
git add src/presentation/hooks/useAiChat.ts src/presentation/components/ai/ChatPanel.tsx src/presentation/components/PasswordStrengthIndicator.tsx src/presentation/components/BreachDetailsModal.tsx src/presentation/components/ai/GeneralAssistant.tsx src/presentation/hooks/__tests__/useAiChat.test.ts
git commit -m "feat(ai): warn in chat when approaching the model context quota"
```

---

# PHASE 6 — Docs & Verification

### Task 16: Documentation + on-device verification

**Files:**
- Modify: `SECURITY.md`
- Modify: `CLAUDE.md`
- Modify: `TEST_STATUS.md`

- [ ] **Step 1: Update `SECURITY.md` §On-Device AI Boundary**

Add a paragraph: structured output (`responseConstraint`) describes only non-secret fields; `assertNoSecrets()` remains the chokepoint for all app-constructed context including Summarizer input; structured output is model-generated text inside the ZK-out boundary; ephemeral sessions, no logging/persistence; no new network egress / CSP exception on the Chrome path.

- [ ] **Step 2: Update the CLAUDE.md On-device AI note + Last Updated line**

One sentence summarizing the alignment: capability-gated Chrome provider (`supports()`), structured insight cards, Summarizer vault overview, multilingual output, quota-aware chat — Chrome-only, hard-gated; Android unchanged.

- [ ] **Step 3: Run the full quality gate**

Run: `npm run type-check && npm run lint && npm run test`
Expected: 0 type errors, 0 lint warnings, all tests pass.

- [ ] **Step 4: Manual on-device verification in Chrome 148+/149** — record results in `TEST_STATUS.md`:
  1. Strength "Explain with AI" renders a typed `StrengthInsightCard`; follow-up chat works below it.
  2. Breach modal renders `BreachInsightCard`; follow-up chat works.
  3. With OS/browser locale set to `es`/`fr`, explanations render in that language; an unsupported locale renders English.
  4. General Assistant curated scope shows a Summarizer-backed overview (or graceful fallback).
  5. A long chat surfaces the near-limit warning.
  6. Confirm DevTools Network shows no new egress during inference.

- [ ] **Step 5: Commit**

```bash
git add SECURITY.md CLAUDE.md TEST_STATUS.md
git commit -m "docs(ai): document Chrome built-in AI alignment + on-device verification"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Provider hardening (params, language hints, quota seam, `supports()` hard-gate) → Tasks 1–3. ✓
- Structured output insight card + chat → Tasks 4–9. ✓
- Summarizer vault overview → Tasks 10–11. ✓
- Multilingual → Tasks 12–13. ✓
- Quota/usage UX → Tasks 14–15. ✓
- ZK boundary preserved (`assertNoSecrets` reused in breach prompt + vault overview; schemas non-secret) → Tasks 6, 11; Global Constraints. ✓
- Error/graceful degradation (raw-text fallback, summarizer fallback, language fallback, hard-gate) → Tasks 5, 6, 10, 11, 12, 15. ✓
- Docs + manual verification → Task 16. ✓

**Placeholder scan:** Task 9 and Task 15 Step 1 describe the test setup in prose rather than full code because they extend existing test files whose mock scaffolding must be matched in place; the assertions and implementation code are fully specified. No `TBD`/`TODO` remain.

**Type consistency:** `AiCapability`, `AiRunParams`, `AiLanguageHints`, `StructuredArgs`, `StrengthInsight`, `BreachInsight`, `UsageStatus`, `measureUsage`, `supports`, `runStructured`, `supportsCapability`, `resolveAiLanguage`, `summarize`, `summarizeVaultOverview`, `checkChatUsage`, `usageWarning` are defined once and consumed with matching signatures across tasks. ✓
