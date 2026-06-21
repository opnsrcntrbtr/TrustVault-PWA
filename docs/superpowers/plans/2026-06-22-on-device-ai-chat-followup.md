# On-Device AI Chat Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-turn chat follow-up to the existing on-device AI strength/breach panels plus a standalone general assistant, all fully local with ephemeral history.

**Architecture:** Add a stateful `ChatSession` to the provider abstraction (chrome-builtin and litert-lm use native stateful sessions; webllm keeps an internal trimmed transcript). A shared `chatContext` module is the single chokepoint that builds and inspects every app-constructed system prompt. A `useAiChat` hook owns ephemeral React state + session lifecycle (destroyed on unmount/lock), and a presentational `ChatPanel` renders all three surfaces.

**Tech Stack:** React 19, TypeScript 5.7 (strict), Zustand, Vitest, MUI, existing `src/core/ai/providers/` abstraction.

## Global Constraints

- **No secrets in prompts:** passwords, secret notes, and keys MUST NEVER enter any app-constructed prompt. App context runs through `assertNoSecrets()`; free-text user turns are passed through verbatim (never inspected).
- **Fully local inference:** no new network calls beyond the existing opt-in WebLLM/LiteRT weight download. No prompt/response logged or persisted.
- **Ephemeral history:** chat lives only in React state. Destroyed on panel close, unmount, vault lock, logout, reload. Never written to disk/IndexedDB/console.
- **TypeScript strict:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Use `arr[i]?` and explicit returns. Use `@/` path aliases.
- **Defaults stay "on" (local-safe):** new settings default `true` / `'stateless'`, nested under `enableOnDeviceAI`; every chat surface hides when `getAiAvailability()` is `'unavailable'`.
- **Definition of Done (per `CLAUDE.md`):** `npm run type-check` 0 errors, `npm run lint` 0 errors, targeted `npm run test` pass; `SECURITY.md` + `CLAUDE.md` + `TEST_STATUS.md` updated.
- **Commit cadence:** one commit per task (TDD: failing test → impl → passing test → commit).

## File Structure

New:
- `src/core/ai/chat/chatTypes.ts` — `ChatScope`, `ChatMessage`, `CredentialSafeMeta`, `VaultSafeAggregate`.
- `src/core/ai/chat/chatContext.ts` — `assertNoSecrets`, system-prompt builders per scope.
- `src/core/ai/chat/chatTrim.ts` — `MAX_CHAT_TURNS`, `trimChatMessages`.
- `src/core/ai/chat/vaultAggregate.ts` — `computeVaultSafeAggregate`.
- `src/presentation/hooks/useAiChat.ts` — ephemeral chat state + session lifecycle.
- `src/presentation/components/ai/ChatPanel.tsx` — shared chat UI.
- `src/presentation/components/ai/GeneralAssistant.tsx` — standalone assistant container + scope selector.
- Tests mirroring each module under existing `__tests__` layout.

Modified:
- `src/core/ai/providers/types.ts` — `ChatSession` + `AiProvider.createChatSession`.
- `src/core/ai/providers/chromeBuiltinProvider.ts`, `webllmProvider.ts`, `litertProvider.ts`.
- `src/core/ai/promptApi.ts` — `createChatSession` facade.
- `src/core/ai/breachImpactExplain.ts` — reuse shared `assertNoSecrets`.
- `src/core/ai/aiSettings.ts` — three new settings.
- `src/presentation/components/AiAssistanceSettings.tsx` — Chat subsection.
- `src/presentation/components/PasswordStrengthIndicator.tsx`, `BreachDetailsModal.tsx`.
- `src/presentation/hooks/useAiStrengthExplain.ts`, `useAiBreachImpactExplain.ts`.
- App nav/header for the standalone-assistant entry point.
- `SECURITY.md`, `CLAUDE.md`, `TEST_STATUS.md`.

---

## Phase 1 — Core multi-turn infrastructure

### Task 1: `ChatSession` interface + shared trim helper

**Files:**
- Modify: `src/core/ai/providers/types.ts`
- Create: `src/core/ai/chat/chatTypes.ts`
- Create: `src/core/ai/chat/chatTrim.ts`
- Test: `src/core/ai/__tests__/chat/chatTrim.test.ts`

**Interfaces:**
- Produces: `ChatSession { send(userText, signal?): AsyncIterableIterator<string>; destroy(): void }`; `AiProvider.createChatSession(systemPrompt: string): Promise<ChatSession>`; `MAX_CHAT_TURNS: number`; `trimChatMessages<T extends { role: string }>(messages: T[], maxTurns: number): void`; type `ChatMessage`, `ChatScope`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/ai/__tests__/chat/chatTrim.test.ts
import { describe, it, expect } from 'vitest';
import { trimChatMessages, MAX_CHAT_TURNS } from '@/core/ai/chat/chatTrim';

describe('trimChatMessages', () => {
  it('keeps the system message and the last N non-system messages', () => {
    const msgs = [
      { role: 'system', content: 's' },
      { role: 'user', content: '1' },
      { role: 'assistant', content: '2' },
      { role: 'user', content: '3' },
      { role: 'assistant', content: '4' },
    ];
    trimChatMessages(msgs, 2);
    expect(msgs.map((m) => m.content)).toEqual(['s', '3', '4']);
  });

  it('is a no-op when within budget', () => {
    const msgs = [{ role: 'system', content: 's' }, { role: 'user', content: '1' }];
    trimChatMessages(msgs, 4);
    expect(msgs).toHaveLength(2);
  });

  it('handles no leading system message', () => {
    const msgs = [{ role: 'user', content: '1' }, { role: 'assistant', content: '2' }, { role: 'user', content: '3' }];
    trimChatMessages(msgs, 2);
    expect(msgs.map((m) => m.content)).toEqual(['2', '3']);
  });

  it('exposes a positive default turn budget', () => {
    expect(MAX_CHAT_TURNS).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/chat/chatTrim.test.ts`
Expected: FAIL — cannot resolve `@/core/ai/chat/chatTrim`.

- [ ] **Step 3: Create the types and trim helper**

```ts
// src/core/ai/chat/chatTypes.ts
/** Runtime data-access scope for the standalone general assistant. */
export type ChatScope = 'stateless' | 'curated' | 'per-credential';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

/** Non-secret per-credential metadata safe to send to the model. */
export interface CredentialSafeMeta {
  title: string;
  username?: string | undefined;
  category?: string | undefined;
  ageDays?: number | undefined;
  breachCount?: number | undefined;
}

/** Non-secret vault-wide aggregate safe to send to the model. */
export interface VaultSafeAggregate {
  total: number;
  weak: number;
  reused: number;
  breached: number;
  categories: Record<string, number>;
  oldestPasswordAgeDays?: number | undefined;
}
```

```ts
// src/core/ai/chat/chatTrim.ts
/**
 * Conversation history trimming for the 2048-token context cap shared by both
 * on-device backends. Keeps the system message plus the most recent turns.
 */

/** User+assistant messages retained (the system message is always kept). */
export const MAX_CHAT_TURNS = 8;

/** Mutates `messages` in place: keeps a leading system message + last `maxTurns`. */
export function trimChatMessages<T extends { role: string }>(messages: T[], maxTurns: number): void {
  const hasSystem = messages[0]?.role === 'system' ? 1 : 0;
  const nonSystem = messages.length - hasSystem;
  if (nonSystem <= maxTurns) return;
  messages.splice(hasSystem, nonSystem - maxTurns);
}
```

- [ ] **Step 4: Add `ChatSession` to the provider interface**

```ts
// src/core/ai/providers/types.ts — add to the existing file
export interface ChatSession {
  /** Stream the assistant's reply to one user turn. */
  send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string>;
  /** Free native resources / clear transcript. Idempotent. */
  destroy(): void;
}
```

Then add this member to the existing `AiProvider` interface (after `runStreaming`):

```ts
  /** Create a multi-turn session primed with a (pre-inspected) system prompt. */
  createChatSession(systemPrompt: string): Promise<ChatSession>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/chat/chatTrim.test.ts`
Expected: PASS (4 tests).

> Note: `npm run type-check` will now fail until Tasks 2–4 add `createChatSession` to each provider. That is expected mid-phase; do not "fix" it by stubbing elsewhere.

- [ ] **Step 6: Commit**

```bash
git add src/core/ai/chat/chatTypes.ts src/core/ai/chat/chatTrim.ts src/core/ai/providers/types.ts src/core/ai/__tests__/chat/chatTrim.test.ts
git commit -m "feat(ai): add ChatSession interface, chat types, and trim helper"
```

---

### Task 2: chrome-builtin `createChatSession` (native stateful session)

**Files:**
- Modify: `src/core/ai/providers/chromeBuiltinProvider.ts`
- Test: `src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts`

**Interfaces:**
- Consumes: existing `getClonedSession(systemPrompt)`, `AiSession`.
- Produces: `chromeBuiltinProvider.createChatSession`.

- [ ] **Step 1: Write the failing test** (append to existing describe block)

```ts
// src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts — add inside describe('chromeBuiltinProvider', ...)
  it('createChatSession reuses ONE cloned session across turns and destroys on destroy()', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn()
      .mockReturnValueOnce(streamOf(['A1']))
      .mockReturnValueOnce(streamOf(['A2']));
    const clone = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    const create = vi.fn().mockResolvedValue({ clone, destroy });
    setLanguageModel({ create, availability: vi.fn().mockResolvedValue('available') });

    const chat = await chromeBuiltinProvider.createChatSession('sys');
    expect(await collect(chat.send('q1'))).toBe('A1');
    expect(await collect(chat.send('q2'))).toBe('A2');

    expect(clone).toHaveBeenCalledOnce();        // session reused, not re-cloned
    expect(promptStreaming).toHaveBeenCalledTimes(2);
    chat.destroy();
    chat.destroy();                               // idempotent
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('createChatSession.send rejects after destroy()', async () => {
    const clone = vi.fn().mockResolvedValue({ promptStreaming: vi.fn(), destroy: vi.fn() });
    const create = vi.fn().mockResolvedValue({ clone, destroy: vi.fn() });
    setLanguageModel({ create, availability: vi.fn().mockResolvedValue('available') });
    const chat = await chromeBuiltinProvider.createChatSession('sys');
    chat.destroy();
    await expect(collect(chat.send('q'))).rejects.toThrow('destroyed');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts`
Expected: FAIL — `createChatSession is not a function`.

- [ ] **Step 3: Implement `createChatSession`**

```ts
// src/core/ai/providers/chromeBuiltinProvider.ts — add above the exported provider object
import type { AiProvider, ChatSession } from '@/core/ai/providers/types';

async function createChatSession(systemPrompt: string): Promise<ChatSession> {
  const session = await getClonedSession(systemPrompt); // persistent for the whole conversation
  let destroyed = false;
  return {
    async *send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string> {
      if (destroyed) throw new Error('Chat session destroyed');
      const opts = signal ? { signal } : undefined;
      for await (const chunk of session.promptStreaming(userText, opts)) yield chunk;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      session.destroy();
    },
  };
}
```

Add `createChatSession` to the exported `chromeBuiltinProvider` object (after `runStreaming`). Update the existing `import type { AiProvider }` line to also import `ChatSession` (shown above).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/providers/chromeBuiltinProvider.ts src/core/ai/__tests__/providers/chromeBuiltinProvider.test.ts
git commit -m "feat(ai): chrome-builtin createChatSession with native stateful session"
```

---

### Task 3: webllm `createChatSession` (internal trimmed transcript)

**Files:**
- Modify: `src/core/ai/providers/webllmProvider.ts`
- Test: `src/core/ai/__tests__/providers/webllmProvider.test.ts`

**Interfaces:**
- Consumes: existing module-level `engine`, `ensureReady`, `resetEngineState`, `isDeviceLostError`; `trimChatMessages`, `MAX_CHAT_TURNS`.
- Produces: `webllmProvider.createChatSession`.

- [ ] **Step 1: Write the failing test**

Check the existing test file's mock setup first (`npm run test -- src/core/ai/__tests__/providers/webllmProvider.test.ts` then open it). Append, reusing that file's existing engine-mock helpers:

```ts
// src/core/ai/__tests__/providers/webllmProvider.test.ts — add inside the describe block
  it('createChatSession accumulates a multi-turn transcript and trims to budget', async () => {
    // Reuse the file's existing helper that installs a mock MLC engine and returns the
    // captured `create` spy. If named differently, adapt to the local helper.
    const { create } = installMockEngine([['A1'], ['A2']]); // streams for two turns
    const chat = await webllmProvider.createChatSession('sys');

    expect(await collect(chat.send('q1'))).toBe('A1');
    expect(await collect(chat.send('q2'))).toBe('A2');

    // Second call must include the first turn's user+assistant messages.
    const secondCallMessages = create.mock.calls[1]![0].messages as Array<{ role: string; content: string }>;
    expect(secondCallMessages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(secondCallMessages.at(-1)!.content).toBe('q2');

    chat.destroy();
    chat.destroy(); // idempotent — must not throw
  });
```

If the existing test file has no `installMockEngine`/`collect` helper, add these at the top of the file:

```ts
function collect(it: AsyncIterableIterator<string>) {
  return (async () => { let s = ''; for await (const c of it) s += c; return s; })();
}
function streamOf(chunks: string[]) {
  return (async function* () { for (const c of chunks) yield { choices: [{ delta: { content: c } }] }; })();
}
function installMockEngine(turns: string[][]) {
  const create = vi.fn();
  turns.forEach((chunks) => create.mockResolvedValueOnce(streamOf(chunks)));
  const engine = {
    chat: { completions: { create } },
    interruptGenerate: vi.fn(),
    resetChat: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn().mockResolvedValue(undefined),
  };
  __setWebllmEngineForTesting(engine); // see Step 3 for this test seam
  return { create, engine };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/providers/webllmProvider.test.ts`
Expected: FAIL — `createChatSession is not a function` (and/or missing test seam).

- [ ] **Step 3: Implement `createChatSession` + a test seam**

```ts
// src/core/ai/providers/webllmProvider.ts
import type { AiProvider, AiDownloadProgress, ChatSession } from '@/core/ai/providers/types';
import { trimChatMessages, MAX_CHAT_TURNS } from '@/core/ai/chat/chatTrim';

// Add near __resetWebllmEngineForTesting:
export function __setWebllmEngineForTesting(e: unknown): void {
  engine = e as MlcEngine; engineModelId = 'test'; initPromise = null;
}

type ChatRoleMsg = { role: 'system' | 'user' | 'assistant'; content: string };

async function createChatSession(systemPrompt: string): Promise<ChatSession> {
  const messages: ChatRoleMsg[] = [{ role: 'system', content: systemPrompt }];
  let destroyed = false;
  return {
    async *send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string> {
      if (destroyed) throw new Error('Chat session destroyed');
      await ensureReady();
      if (!engine) throw new Error('WebLLM engine not ready');
      messages.push({ role: 'user', content: userText });
      trimChatMessages(messages, MAX_CHAT_TURNS);
      const onAbort = () => { engine?.interruptGenerate(); };
      signal?.addEventListener('abort', onAbort, { once: true });
      let assistant = '';
      try {
        const stream = await engine.chat.completions.create({ stream: true, messages: [...messages] });
        for await (const chunk of stream) {
          const piece = chunk.choices[0]?.delta.content;
          if (piece) { assistant += piece; yield piece; }
        }
        messages.push({ role: 'assistant', content: assistant });
      } catch (err: unknown) {
        if (isDeviceLostError(err)) { resetEngineState(); throw new Error(DEVICE_UNAVAILABLE_MESSAGE); }
        throw err;
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      messages.length = 0;
    },
  };
}
```

Add `createChatSession` to the exported `webllmProvider` object (after `runStreaming`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/providers/webllmProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/providers/webllmProvider.ts src/core/ai/__tests__/providers/webllmProvider.test.ts
git commit -m "feat(ai): webllm createChatSession with trimmed internal transcript"
```

---

### Task 4: litert-lm `createChatSession` (native stateful conversation)

**Files:**
- Modify: `src/core/ai/providers/litertProvider.ts`
- Test: `src/core/ai/__tests__/providers/litertProvider.test.ts`

**Interfaces:**
- Consumes: existing `ensureReady`, `engine`, `LitertConversation`, `resetEngineState`, `isDeviceLostError`.
- Produces: `litertProvider.createChatSession`.

- [ ] **Step 1: Write the failing test** (mirror the existing litert test's engine mock)

```ts
// src/core/ai/__tests__/providers/litertProvider.test.ts — add inside the describe block
  it('createChatSession sends multiple turns on one native conversation, deletes on destroy()', async () => {
    // Reuse the file's existing helper that installs a mock LiteRT engine + conversation.
    const { conversation } = installMockLitertEngine([['A1'], ['A2']]);
    const chat = await litertProvider.createChatSession('sys');

    expect(await collect(chat.send('q1'))).toBe('A1');
    expect(await collect(chat.send('q2'))).toBe('A2');
    expect(conversation.sendMessageStreaming).toHaveBeenCalledTimes(2);

    chat.destroy();
    chat.destroy();                               // idempotent
    expect(conversation.delete).toHaveBeenCalledOnce();
  });
```

If the file lacks a reusable helper, model `installMockLitertEngine` on the existing litert test setup: a `conversation` with `sendMessageStreaming(msg)` returning a `ReadableStream` of `{ role, content: [{ type:'text', text }] }`, plus `cancel`/`delete` spies; an `engine.createConversation` resolving to it; installed via the file's existing engine test seam.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/providers/litertProvider.test.ts`
Expected: FAIL — `createChatSession is not a function`.

- [ ] **Step 3: Implement `createChatSession`**

```ts
// src/core/ai/providers/litertProvider.ts
import type { AiProvider, AiDownloadProgress, ChatSession } from '@/core/ai/providers/types';

async function createChatSession(systemPrompt: string): Promise<ChatSession> {
  await ensureReady();
  if (!engine) throw new Error('LiteRT-LM engine not ready');
  const conversation = await engine.createConversation({
    preface: { messages: [{ role: 'system', content: systemPrompt }] },
  });
  let destroyed = false;
  return {
    async *send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string> {
      if (destroyed) throw new Error('Chat session destroyed');
      const onAbort = () => { conversation.cancel(); };
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const stream = conversation.sendMessageStreaming(userText);
        const reader = stream.getReader();
        try {
          let result = await reader.read();
          while (!result.done) {
            const items = Array.isArray(result.value.content) ? result.value.content : [];
            for (const item of items) {
              if (item.type === 'text' && item.text) yield item.text;
            }
            result = await reader.read();
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err: unknown) {
        if (isDeviceLostError(err)) { resetEngineState(); throw new Error(DEVICE_UNAVAILABLE_MESSAGE); }
        throw err;
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      void conversation.delete();
    },
  };
}
```

Add `createChatSession` to the exported `litertProvider` object (after `runStreaming`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/providers/litertProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/providers/litertProvider.ts src/core/ai/__tests__/providers/litertProvider.test.ts
git commit -m "feat(ai): litert-lm createChatSession using native conversation"
```

---

### Task 5: `createChatSession` facade in `promptApi`

**Files:**
- Modify: `src/core/ai/promptApi.ts`
- Test: `src/core/ai/__tests__/promptApi.test.ts`

**Interfaces:**
- Consumes: `getActiveProvider()`, `ChatSession`.
- Produces: `createChatSession(systemPrompt: string): Promise<ChatSession | null>`.

- [ ] **Step 1: Write the failing test** (append, mirroring the file's existing registry mock)

```ts
// src/core/ai/__tests__/promptApi.test.ts — add inside the existing describe
  it('createChatSession delegates to the active provider', async () => {
    const fakeSession = { send: vi.fn(), destroy: vi.fn() };
    const provider = {
      id: 'chrome-builtin',
      createChatSession: vi.fn().mockResolvedValue(fakeSession),
    };
    __setActiveProviderForTesting(provider as unknown as AiProvider);
    const session = await createChatSession('sys');
    expect(provider.createChatSession).toHaveBeenCalledWith('sys');
    expect(session).toBe(fakeSession);
  });

  it('createChatSession returns null when no provider is available', async () => {
    __setActiveProviderForTesting(null);
    expect(await createChatSession('sys')).toBeNull();
  });
```

Ensure the test imports `createChatSession` from `@/core/ai/promptApi`, `__setActiveProviderForTesting`/`__resetRegistryForTesting` from `@/core/ai/providers/registry`, and `AiProvider` type. Add an `afterEach(() => __resetRegistryForTesting())` if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/promptApi.test.ts`
Expected: FAIL — `createChatSession` is not exported.

- [ ] **Step 3: Implement the facade**

```ts
// src/core/ai/promptApi.ts — add
import type { ChatSession } from '@/core/ai/providers/providers'; // NOTE: import from '@/core/ai/providers/types'

export async function createChatSession(systemPrompt: string): Promise<ChatSession | null> {
  const provider = await getActiveProvider();
  if (!provider) return null;
  return provider.createChatSession(systemPrompt);
}
```

Correct the import to `import type { ChatSession } from '@/core/ai/providers/types';` (the inline note above is a reminder — use the types path).

- [ ] **Step 4: Run test + full type-check (Phase 1 closes here)**

Run: `npm run test -- src/core/ai/__tests__/promptApi.test.ts`
Expected: PASS.
Run: `npm run type-check`
Expected: 0 errors (all providers now implement `createChatSession`).

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/promptApi.ts src/core/ai/__tests__/promptApi.test.ts
git commit -m "feat(ai): add createChatSession facade in promptApi"
```

---

## Phase 2 — Security context chokepoint

### Task 6: `chatContext` — `assertNoSecrets` + system-prompt builders

**Files:**
- Create: `src/core/ai/chat/chatContext.ts`
- Modify: `src/core/ai/breachImpactExplain.ts` (reuse shared guard)
- Test: `src/core/ai/__tests__/chat/chatContext.test.ts`

**Interfaces:**
- Consumes: `ChatScope`, `CredentialSafeMeta`, `VaultSafeAggregate` from `chatTypes`.
- Produces:
  - `assertNoSecrets(text: string): void`
  - `buildAssistantSystemPrompt(scope: ChatScope, data?: { credential?: CredentialSafeMeta; aggregate?: VaultSafeAggregate }): string`
  - `GENERAL_ASSISTANT_SYSTEM_PROMPT_BASE: string`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/ai/__tests__/chat/chatContext.test.ts
import { describe, it, expect } from 'vitest';
import { assertNoSecrets, buildAssistantSystemPrompt } from '@/core/ai/chat/chatContext';

describe('assertNoSecrets', () => {
  it('throws when a password field is present', () => {
    expect(() => assertNoSecrets('password: hunter2')).toThrow(/safety invariant/i);
  });
  it('throws when a notes field is present', () => {
    expect(() => assertNoSecrets('Notes: my secret')).toThrow(/safety invariant/i);
  });
  it('passes for clean context', () => {
    expect(() => assertNoSecrets('Title: GitHub\nCategory: dev')).not.toThrow();
  });
});

describe('buildAssistantSystemPrompt', () => {
  it('stateless: emits the base prompt with no vault data', () => {
    const p = buildAssistantSystemPrompt('stateless');
    expect(p).toContain('no access');
    expect(p).not.toContain('Title:');
  });

  it('curated: includes only aggregate counts, never secrets', () => {
    const p = buildAssistantSystemPrompt('curated', {
      aggregate: { total: 10, weak: 2, reused: 1, breached: 3, categories: { dev: 4 }, oldestPasswordAgeDays: 400 },
    });
    expect(p).toContain('10');
    expect(p).toContain('weak');
    expect(() => assertNoSecrets(p)).not.toThrow();
  });

  it('per-credential: includes safe fields only', () => {
    const p = buildAssistantSystemPrompt('per-credential', {
      credential: { title: 'GitHub', username: 'me', category: 'dev', ageDays: 30, breachCount: 1 },
    });
    expect(p).toContain('GitHub');
    expect(p).toContain('dev');
  });

  it('throws if a credential title smuggles a secret field', () => {
    expect(() => buildAssistantSystemPrompt('per-credential', {
      credential: { title: 'x\npassword: leak' },
    })).toThrow(/safety invariant/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/chat/chatContext.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `chatContext.ts`**

```ts
// src/core/ai/chat/chatContext.ts
/**
 * Single chokepoint for every APP-CONSTRUCTED chat prompt.
 * SECURITY: passwords / secret notes / keys MUST NEVER reach here. All output
 * is run through assertNoSecrets(). Free-text USER turns are NOT inspected and
 * never pass through this module.
 */
import type { ChatScope, CredentialSafeMeta, VaultSafeAggregate } from '@/core/ai/chat/chatTypes';

const SECRET_FIELD_PATTERN = /(?:password|notes)\s*:/i;

export function assertNoSecrets(text: string): void {
  if (SECRET_FIELD_PATTERN.test(text)) {
    throw new Error('Safety invariant violation: context contains potential secret fields.');
  }
}

export const GENERAL_ASSISTANT_SYSTEM_PROMPT_BASE =
  'You are a security assistant for a zero-knowledge password manager. ' +
  'Answer the user\'s security and password questions clearly and concisely. ' +
  'Never ask for or guess any actual password, secret, or private key.';

function curatedBlock(agg: VaultSafeAggregate): string {
  const cats = Object.entries(agg.categories).map(([k, v]) => `${k}=${String(v)}`).join(', ');
  let block = `\n\nNon-secret summary of the user's vault (no passwords or secrets):\n`;
  block += `- Total credentials: ${String(agg.total)}\n`;
  block += `- Weak: ${String(agg.weak)}, Reused: ${String(agg.reused)}, Breached: ${String(agg.breached)}\n`;
  if (cats) block += `- Categories: ${cats}\n`;
  if (agg.oldestPasswordAgeDays !== undefined) {
    block += `- Oldest password age: ${String(Math.round(agg.oldestPasswordAgeDays))} days\n`;
  }
  return block;
}

function credentialBlock(c: CredentialSafeMeta): string {
  let block = `\n\nThe user is asking about one credential (no password or secret):\n`;
  block += `- Title: ${c.title}\n`;
  if (c.username) block += `- Username: ${c.username}\n`;
  if (c.category) block += `- Category: ${c.category}\n`;
  if (c.ageDays !== undefined) block += `- Password age: ${String(Math.round(c.ageDays))} days\n`;
  if (c.breachCount !== undefined) block += `- Known breaches: ${String(c.breachCount)}\n`;
  return block;
}

export function buildAssistantSystemPrompt(
  scope: ChatScope,
  data?: { credential?: CredentialSafeMeta; aggregate?: VaultSafeAggregate },
): string {
  let prompt = GENERAL_ASSISTANT_SYSTEM_PROMPT_BASE;
  if (scope === 'stateless') {
    prompt += ' You have no access to the user\'s vault contents.';
  } else if (scope === 'curated' && data?.aggregate) {
    prompt += curatedBlock(data.aggregate);
  } else if (scope === 'per-credential' && data?.credential) {
    prompt += credentialBlock(data.credential);
  }
  assertNoSecrets(prompt);
  return prompt;
}
```

- [ ] **Step 4: Refactor `breachImpactExplain.ts` to reuse the shared guard**

In `src/core/ai/breachImpactExplain.ts`, replace the inline check at the end of `buildBreachPrompt`:

```ts
// remove:
//   const lowerPrompt = prompt.toLowerCase();
//   if (lowerPrompt.includes('password: ') || lowerPrompt.includes('notes: ')) {
//     throw new Error('Safety invariant violation: Prompt contains potential secret fields.');
//   }
// add at top of file:
import { assertNoSecrets } from '@/core/ai/chat/chatContext';
// and at the end of buildBreachPrompt, before `return prompt;`:
  assertNoSecrets(prompt);
  return prompt;
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test -- src/core/ai/__tests__/chat/chatContext.test.ts src/core/ai/__tests__/breachImpactExplain.test.ts`
Expected: PASS (both files).

- [ ] **Step 6: Commit**

```bash
git add src/core/ai/chat/chatContext.ts src/core/ai/breachImpactExplain.ts src/core/ai/__tests__/chat/chatContext.test.ts
git commit -m "feat(ai): chatContext system-prompt builder + shared assertNoSecrets guard"
```

---

### Task 7: `computeVaultSafeAggregate`

**Files:**
- Create: `src/core/ai/chat/vaultAggregate.ts`
- Test: `src/core/ai/__tests__/chat/vaultAggregate.test.ts`

**Interfaces:**
- Produces: `computeVaultSafeAggregate(items: CredentialSummary[]): VaultSafeAggregate` where
  `CredentialSummary = { category?: string; ageDays?: number; isWeak?: boolean; isReused?: boolean; breachCount?: number }`.
- Note: input is a minimal NON-SECRET summary computed by the caller from already-loaded vault data. This module never touches passwords.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/ai/__tests__/chat/vaultAggregate.test.ts
import { describe, it, expect } from 'vitest';
import { computeVaultSafeAggregate } from '@/core/ai/chat/vaultAggregate';

describe('computeVaultSafeAggregate', () => {
  it('counts totals, flags, categories, and oldest age', () => {
    const agg = computeVaultSafeAggregate([
      { category: 'dev', ageDays: 10, isWeak: true, breachCount: 0 },
      { category: 'dev', ageDays: 500, isReused: true, breachCount: 2 },
      { category: 'social', ageDays: 50, breachCount: 0 },
    ]);
    expect(agg.total).toBe(3);
    expect(agg.weak).toBe(1);
    expect(agg.reused).toBe(1);
    expect(agg.breached).toBe(1);
    expect(agg.categories).toEqual({ dev: 2, social: 1 });
    expect(agg.oldestPasswordAgeDays).toBe(500);
  });

  it('handles an empty vault', () => {
    const agg = computeVaultSafeAggregate([]);
    expect(agg).toEqual({ total: 0, weak: 0, reused: 0, breached: 0, categories: {}, oldestPasswordAgeDays: undefined });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/chat/vaultAggregate.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// src/core/ai/chat/vaultAggregate.ts
import type { VaultSafeAggregate } from '@/core/ai/chat/chatTypes';

export interface CredentialSummary {
  category?: string | undefined;
  ageDays?: number | undefined;
  isWeak?: boolean | undefined;
  isReused?: boolean | undefined;
  breachCount?: number | undefined;
}

export function computeVaultSafeAggregate(items: CredentialSummary[]): VaultSafeAggregate {
  const categories: Record<string, number> = {};
  let weak = 0, reused = 0, breached = 0;
  let oldest: number | undefined;
  for (const it of items) {
    if (it.isWeak) weak += 1;
    if (it.isReused) reused += 1;
    if ((it.breachCount ?? 0) > 0) breached += 1;
    if (it.category) categories[it.category] = (categories[it.category] ?? 0) + 1;
    if (it.ageDays !== undefined) oldest = oldest === undefined ? it.ageDays : Math.max(oldest, it.ageDays);
  }
  return { total: items.length, weak, reused, breached, categories, oldestPasswordAgeDays: oldest };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/chat/vaultAggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/chat/vaultAggregate.ts src/core/ai/__tests__/chat/vaultAggregate.test.ts
git commit -m "feat(ai): computeVaultSafeAggregate for curated chat scope"
```

---

## Phase 3 — Hook + shared UI

### Task 8: `useAiChat` hook

**Files:**
- Create: `src/presentation/hooks/useAiChat.ts`
- Test: `src/presentation/hooks/__tests__/useAiChat.test.ts`

**Interfaces:**
- Consumes: `createChatSession`, `warmUpAi` (`promptApi`); `getAiAvailability`, `isFeatureUsable` (`aiAvailability`); `ChatMessage` (`chatTypes`); `useAuthStore`.
- Produces:
```ts
export interface UseAiChatOptions { systemPrompt: string; seedMessages?: ChatMessage[]; autoEnable?: boolean; }
export interface UseAiChat {
  enabled: boolean; messages: ChatMessage[]; streaming: boolean; error: boolean;
  send: (text: string) => Promise<void>; stop: () => void; retry: () => void; reset: () => void;
}
export function useAiChat(opts: UseAiChatOptions): UseAiChat;
```

- [ ] **Step 1: Write the failing test**

```ts
// src/presentation/hooks/__tests__/useAiChat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const createChatSession = vi.fn();
vi.mock('@/core/ai/promptApi', () => ({
  createChatSession: (s: string) => createChatSession(s),
  warmUpAi: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: vi.fn().mockResolvedValue('available'),
  isFeatureUsable: (a: string) => a === 'available',
}));

import { useAiChat } from '@/presentation/hooks/useAiChat';

function sessionStreaming(chunks: string[]) {
  return {
    send: vi.fn(() => (async function* () { for (const c of chunks) yield c; })()),
    destroy: vi.fn(),
  };
}

beforeEach(() => { createChatSession.mockReset(); });

describe('useAiChat', () => {
  it('becomes enabled when availability is usable', async () => {
    createChatSession.mockResolvedValue(sessionStreaming(['hi']));
    const { result } = renderHook(() => useAiChat({ systemPrompt: 'sys' }));
    await waitFor(() => expect(result.current.enabled).toBe(true));
  });

  it('send() appends a user turn then streams an assistant turn', async () => {
    createChatSession.mockResolvedValue(sessionStreaming(['Hel', 'lo']));
    const { result } = renderHook(() => useAiChat({ systemPrompt: 'sys' }));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => { await result.current.send('q'); });
    expect(result.current.messages.map((m) => `${m.role}:${m.content}`)).toEqual(['user:q', 'assistant:Hello']);
    expect(result.current.streaming).toBe(false);
  });

  it('seedMessages prime the transcript as the first assistant turn', async () => {
    createChatSession.mockResolvedValue(sessionStreaming(['x']));
    const { result } = renderHook(() => useAiChat({
      systemPrompt: 'sys',
      seedMessages: [{ id: 's1', role: 'assistant', content: 'seeded' }],
    }));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.content).toBe('seeded');
  });

  it('reset() destroys the session and clears messages', async () => {
    const session = sessionStreaming(['a']);
    createChatSession.mockResolvedValue(session);
    const { result } = renderHook(() => useAiChat({ systemPrompt: 'sys' }));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => { await result.current.send('q'); });
    act(() => { result.current.reset(); });
    expect(result.current.messages).toEqual([]);
    expect(session.destroy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/hooks/__tests__/useAiChat.test.ts`
Expected: FAIL — cannot resolve `useAiChat`.

- [ ] **Step 3: Implement the hook**

```ts
// src/presentation/hooks/useAiChat.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { createChatSession, warmUpAi } from '@/core/ai/promptApi';
import { getAiAvailability, isFeatureUsable } from '@/core/ai/aiAvailability';
import type { ChatSession } from '@/core/ai/providers/types';
import type { ChatMessage } from '@/core/ai/chat/chatTypes';
import { useAuthStore } from '@/presentation/store/authStore';

export interface UseAiChatOptions {
  systemPrompt: string;
  seedMessages?: ChatMessage[];
  autoEnable?: boolean;
}
export interface UseAiChat {
  enabled: boolean;
  messages: ChatMessage[];
  streaming: boolean;
  error: boolean;
  send: (text: string) => Promise<void>;
  stop: () => void;
  retry: () => void;
  reset: () => void;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAiChat(opts: UseAiChatOptions): UseAiChat {
  const { systemPrompt, seedMessages } = opts;
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages ?? []);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(false);

  const sessionRef = useRef<ChatSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserRef = useRef<string | null>(null);
  const isLocked = useAuthStore((s) => s.isLocked);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const teardown = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current?.destroy();
    sessionRef.current = null;
  }, []);

  const reset = useCallback(() => {
    teardown();
    setMessages([]);
    setStreaming(false);
    setError(false);
  }, [teardown]);

  // Availability + warm-up.
  useEffect(() => {
    let mounted = true;
    getAiAvailability()
      .then((a) => {
        if (mounted && isFeatureUsable(a)) {
          setEnabled(true);
          warmUpAi(systemPrompt).catch(console.error);
        }
      })
      .catch(() => { if (mounted) setEnabled(false); });
    return () => { mounted = false; };
  }, [systemPrompt]);

  // Force-teardown on lock / logout.
  useEffect(() => {
    if (isLocked || !isAuthenticated) reset();
  }, [isLocked, isAuthenticated, reset]);

  // Teardown on unmount.
  useEffect(() => () => { teardown(); }, [teardown]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    lastUserRef.current = trimmed;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(false);
    setStreaming(true);
    const userMsg: ChatMessage = { id: newId(), role: 'user', content: trimmed };
    const assistantMsg: ChatMessage = { id: newId(), role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      if (!sessionRef.current) {
        sessionRef.current = await createChatSession(systemPrompt);
      }
      if (!sessionRef.current) throw new Error('No on-device AI provider available');
      let acc = '';
      for await (const chunk of sessionRef.current.send(trimmed, controller.signal)) {
        acc += chunk;
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // keep partial assistant text; no error state
      } else {
        console.error('AI chat error:', err);
        setError(true);
      }
    } finally {
      if (abortRef.current === controller) {
        setStreaming(false);
        abortRef.current = null;
      }
    }
  }, [systemPrompt]);

  const retry = useCallback(() => {
    if (lastUserRef.current) void send(lastUserRef.current);
  }, [send]);

  return { enabled, messages, streaming, error, send, stop, retry, reset };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/presentation/hooks/__tests__/useAiChat.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/presentation/hooks/useAiChat.ts src/presentation/hooks/__tests__/useAiChat.test.ts
git commit -m "feat(ai): useAiChat hook with ephemeral state and lock teardown"
```

---

### Task 9: `ChatPanel` shared component

**Files:**
- Create: `src/presentation/components/ai/ChatPanel.tsx`
- Test: `src/presentation/components/ai/__tests__/ChatPanel.test.tsx`

**Interfaces:**
- Consumes: `ChatMessage` (`chatTypes`).
- Produces:
```ts
export interface ChatPanelProps {
  messages: ChatMessage[];
  streaming: boolean;
  error: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
  suggestions?: string[];
  header?: React.ReactNode;     // e.g. the scope selector for the standalone assistant
}
export function ChatPanel(props: ChatPanelProps): JSX.Element;
```
- Behavior: renders the disclaimer once, transcript, suggestion chips, input + Send (disabled while empty), Stop (only while streaming), error row + Retry. Submitting clears the input and calls `onSend`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/presentation/components/ai/__tests__/ChatPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel } from '@/presentation/components/ai/ChatPanel';

const base = { messages: [], streaming: false, error: false, onSend: vi.fn(), onStop: vi.fn(), onRetry: vi.fn() };

describe('ChatPanel', () => {
  it('renders the local-only disclaimer', () => {
    render(<ChatPanel {...base} />);
    expect(screen.getByText(/never leave it/i)).toBeInTheDocument();
  });

  it('renders transcript messages', () => {
    render(<ChatPanel {...base} messages={[
      { id: '1', role: 'user', content: 'hello' },
      { id: '2', role: 'assistant', content: 'hi there' },
    ]} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('hi there')).toBeInTheDocument();
  });

  it('calls onSend with input text and clears the field', () => {
    const onSend = vi.fn();
    render(<ChatPanel {...base} onSend={onSend} />);
    fireEvent.change(screen.getByPlaceholderText(/ask a follow-up/i), { target: { value: 'why?' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith('why?');
  });

  it('shows Stop while streaming and calls onStop', () => {
    const onStop = vi.fn();
    render(<ChatPanel {...base} streaming onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onStop).toHaveBeenCalled();
  });

  it('shows an error row with Retry', () => {
    const onRetry = vi.fn();
    render(<ChatPanel {...base} error onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('clicking a suggestion sends it', () => {
    const onSend = vi.fn();
    render(<ChatPanel {...base} onSend={onSend} suggestions={["What's a passkey?"]} />);
    fireEvent.click(screen.getByRole('button', { name: /what's a passkey\?/i }));
    expect(onSend).toHaveBeenCalledWith("What's a passkey?");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/components/ai/__tests__/ChatPanel.test.tsx`
Expected: FAIL — cannot resolve `ChatPanel`.

- [ ] **Step 3: Implement `ChatPanel.tsx`** (follow MUI usage already in `BreachDetailsModal.tsx`)

```tsx
// src/presentation/components/ai/ChatPanel.tsx
import { useState, type ReactNode, type JSX } from 'react';
import { Box, Stack, TextField, Button, Typography, Chip, Alert } from '@mui/material';
import type { ChatMessage } from '@/core/ai/chat/chatTypes';

export interface ChatPanelProps {
  messages: ChatMessage[];
  streaming: boolean;
  error: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
  suggestions?: string[];
  header?: ReactNode;
}

const DISCLAIMER = 'Replies are generated on your device and never leave it. Avoid pasting real passwords.';

export function ChatPanel(props: ChatPanelProps): JSX.Element {
  const { messages, streaming, error, onSend, onStop, onRetry, suggestions, header } = props;
  const [input, setInput] = useState('');

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    onSend(text);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {header}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        ⓘ {DISCLAIMER}
      </Typography>

      <Stack spacing={1} sx={{ maxHeight: 320, overflowY: 'auto' }}>
        {messages.map((m) => (
          <Box
            key={m.id}
            sx={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
          >
            <Typography
              variant="body2"
              sx={{
                px: 1.5, py: 1, borderRadius: 2,
                bgcolor: m.role === 'user' ? 'primary.main' : 'action.hover',
                color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </Typography>
          </Box>
        ))}
      </Stack>

      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
          Could not generate a response.
        </Alert>
      )}

      {suggestions && suggestions.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {suggestions.map((s) => (
            <Chip key={s} label={s} size="small" onClick={() => onSend(s)} />
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth size="small" placeholder="Ask a follow-up…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        {streaming
          ? <Button variant="outlined" onClick={onStop}>Stop</Button>
          : <Button variant="contained" onClick={submit} disabled={!input.trim()}>Send</Button>}
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/presentation/components/ai/__tests__/ChatPanel.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/presentation/components/ai/ChatPanel.tsx src/presentation/components/ai/__tests__/ChatPanel.test.tsx
git commit -m "feat(ai): shared ChatPanel presentational component"
```

---

## Phase 4 — Settings

### Task 10: New AI settings fields

**Files:**
- Modify: `src/core/ai/aiSettings.ts`
- Test: `src/core/ai/__tests__/aiSettings.test.ts`

**Interfaces:**
- Produces (on `AiSettings`): `allowChatFollowUp: boolean`, `enableGeneralAssistant: boolean`, `generalAssistantDefaultScope: ChatScope`.

- [ ] **Step 1: Write the failing test** (append)

```ts
// src/core/ai/__tests__/aiSettings.test.ts — add
  it('defaults the new chat settings to on / stateless', () => {
    localStorage.clear();
    const s = loadAiSettings();
    expect(s.allowChatFollowUp).toBe(true);
    expect(s.enableGeneralAssistant).toBe(true);
    expect(s.generalAssistantDefaultScope).toBe('stateless');
  });

  it('merges missing new fields from defaults for older stored blobs', () => {
    localStorage.setItem('trustvault_ai_settings', JSON.stringify({ enableOnDeviceAI: false }));
    const s = loadAiSettings();
    expect(s.enableOnDeviceAI).toBe(false);
    expect(s.allowChatFollowUp).toBe(true);
  });
```

Ensure `loadAiSettings` is imported in the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/ai/__tests__/aiSettings.test.ts`
Expected: FAIL — properties undefined.

- [ ] **Step 3: Implement**

```ts
// src/core/ai/aiSettings.ts
import type { ChatScope } from '@/core/ai/chat/chatTypes';

// add to interface AiSettings:
  /** Follow-up chat in the inline strength/breach panels. */
  allowChatFollowUp: boolean;
  /** Show the standalone general assistant entry point. */
  enableGeneralAssistant: boolean;
  /** Scope the standalone assistant opens with. */
  generalAssistantDefaultScope: ChatScope;

// add to DEFAULT_AI_SETTINGS:
  allowChatFollowUp: true,
  enableGeneralAssistant: true,
  generalAssistantDefaultScope: 'stateless',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/ai/__tests__/aiSettings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/aiSettings.ts src/core/ai/__tests__/aiSettings.test.ts
git commit -m "feat(ai): add chat follow-up + general assistant settings"
```

---

### Task 11: Settings UI — Chat subsection

**Files:**
- Modify: `src/presentation/components/AiAssistanceSettings.tsx`
- Test: `src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`

**Interfaces:**
- Consumes: `loadAiSettings`, `saveAiSettings`, existing availability gating already in the component.

- [ ] **Step 1: Write the failing test** (append; mirror existing test setup that mocks availability)

```tsx
// src/presentation/components/__tests__/AiAssistanceSettings.test.tsx — add
  it('renders chat toggles and persists changes when AI is available', async () => {
    // (reuse the file's existing render helper + 'available' availability mock)
    renderSettings();
    const followUp = await screen.findByRole('checkbox', { name: /follow-up chat/i });
    expect(followUp).toBeChecked();
    fireEvent.click(followUp);
    expect(loadAiSettings().allowChatFollowUp).toBe(false);
  });

  it('disables chat toggles when AI is unavailable', async () => {
    // (reuse the file's existing 'unavailable' availability mock variant)
    renderSettingsUnavailable();
    const followUp = await screen.findByRole('checkbox', { name: /follow-up chat/i });
    expect(followUp).toBeDisabled();
  });
```

Adapt `renderSettings`/`renderSettingsUnavailable`/`loadAiSettings` to the helpers/imports already present in this test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`
Expected: FAIL — no follow-up chat checkbox.

- [ ] **Step 3: Implement the Chat subsection**

In `AiAssistanceSettings.tsx`, add a "Chat" subsection mirroring the existing strength/breach toggle rows. Use the same `disabled={!aiUsable}` guard the component already applies (where `aiUsable` is the existing availability-derived flag — match its actual local name). Add:
- A `FormControlLabel` + `Switch`/`Checkbox` labelled "Follow-up chat" bound to `allowChatFollowUp`.
- One labelled "General assistant" bound to `enableGeneralAssistant`.
- A `Select` labelled "Assistant default scope" bound to `generalAssistantDefaultScope` with options Stateless / Curated summary / Per-credential, disabled when `enableGeneralAssistant` is false or AI unavailable.
Each change calls the component's existing `saveAiSettings(updated)` + local state update pattern. Add helper copy: "Chat stays on your device; history is cleared when you close it or lock the vault."

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/presentation/components/__tests__/AiAssistanceSettings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/components/AiAssistanceSettings.tsx src/presentation/components/__tests__/AiAssistanceSettings.test.tsx
git commit -m "feat(ai): chat settings subsection in AiAssistanceSettings"
```

---

## Phase 5 — Surface integration

### Task 12: Strength explainer → follow-up chat

**Files:**
- Modify: `src/presentation/hooks/useAiStrengthExplain.ts`
- Modify: `src/presentation/components/PasswordStrengthIndicator.tsx`
- Test: `src/presentation/components/__tests__/PasswordStrengthIndicator.test.tsx` (or the hook test if the component lacks one)

**Interfaces:**
- Consumes: `useAiChat`, `STRENGTH_SYSTEM_PROMPT`, `buildStrengthPrompt`, `ChatPanel`, `loadAiSettings().allowChatFollowUp`.
- Behavior: after the one-shot explanation streams in, if `allowChatFollowUp` and AI usable, render `ChatPanel` seeded with that explanation as the first assistant message; otherwise keep today's static paragraph.

- [ ] **Step 1: Write the failing test**

```tsx
// add to PasswordStrengthIndicator test (reuse the file's AI-available mock; ensure allowChatFollowUp true)
  it('shows a follow-up chat input after the explanation when chat is enabled', async () => {
    renderIndicatorWithAi(); // existing helper that renders with a non-empty password + AI available
    fireEvent.click(await screen.findByRole('button', { name: /explain with ai/i }));
    expect(await screen.findByPlaceholderText(/ask a follow-up/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/components/__tests__/PasswordStrengthIndicator.test.tsx`
Expected: FAIL — no follow-up input.

- [ ] **Step 3: Implement**

Refactor so the strength surface uses `useAiChat`:
- Keep the existing "Explain with AI" trigger. On click, instead of `ai.explain`, build the first user prompt with `buildStrengthPrompt({ strength, entropyBits })` and call `chat.send(prompt)` once; OR keep `useAiStrengthExplain` for turn 1 and, when it completes, mount `useAiChat({ systemPrompt: STRENGTH_SYSTEM_PROMPT, seedMessages: [{ id, role:'assistant', content: explanation }] })`. Prefer the single-hook path:

```tsx
// PasswordStrengthIndicator.tsx (sketch of the AI block, replacing lines ~142–166)
const chat = useAiChat({ systemPrompt: STRENGTH_SYSTEM_PROMPT });
const allowChat = loadAiSettings().allowChatFollowUp;
// ...
{allowAiExplanation && chat.enabled && (
  expanded ? (
    <Box sx={{ mt: 1 }}>
      <ChatPanel
        messages={chat.messages}
        streaming={chat.streaming}
        error={chat.error}
        onSend={chat.send}
        onStop={chat.stop}
        onRetry={chat.retry}
        suggestions={allowChat ? ['How do I make it stronger?', "What's entropy?"] : []}
      />
    </Box>
  ) : (
    <Button size="small" onClick={() => { setExpanded(true); void chat.send(buildStrengthPrompt({ strength: analysisResult.strength, entropyBits })); }}>
      Explain with AI
    </Button>
  )
)}
```

If `allowChatFollowUp` is false, render the input-less variant by passing `streaming`/`messages` to `ChatPanel` but hide the input — simplest: when `!allowChat`, render the existing static `<Typography>{chat.messages.at(-1)?.content}</Typography>` block instead of `ChatPanel`. Keep `buildStrengthPrompt` exported from `strengthExplain.ts` (it already is). Add `import { buildStrengthPrompt, STRENGTH_SYSTEM_PROMPT } from '@/core/ai/strengthExplain'`.

`useAiStrengthExplain.ts`: leave in place for back-compat if other call sites use it; this surface now uses `useAiChat`. (No deletion required.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/presentation/components/__tests__/PasswordStrengthIndicator.test.tsx`
Expected: PASS. Also run `npm run test -- src/core/ai/__tests__/strengthExplain.test.ts` to confirm no regression.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/components/PasswordStrengthIndicator.tsx src/presentation/components/__tests__/PasswordStrengthIndicator.test.tsx
git commit -m "feat(ai): follow-up chat in password strength explainer"
```

---

### Task 13: Breach impact → follow-up chat

**Files:**
- Modify: `src/presentation/components/BreachDetailsModal.tsx`
- Test: `src/presentation/components/__tests__/BreachDetailsModal.test.tsx`

**Interfaces:**
- Consumes: `useAiChat`, `BREACH_SYSTEM_PROMPT`, `buildBreachPrompt`, `ChatPanel`, `loadAiSettings().allowChatFollowUp`.
- Behavior: on expand, seed turn 1 by sending `buildBreachPrompt(input)`; render `ChatPanel` thereafter.

- [ ] **Step 1: Write the failing test** (reuse the file's breach + AI-available mocks)

```tsx
// add to BreachDetailsModal test
  it('renders a follow-up chat input after expanding AI analysis', async () => {
    renderModalWithAi(); // existing helper: open modal, AI available, breaches present
    fireEvent.click(await screen.findByText(/ai/i)); // the existing expand control (match its real label)
    expect(await screen.findByPlaceholderText(/ask a follow-up/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/components/__tests__/BreachDetailsModal.test.tsx`
Expected: FAIL — no follow-up input.

- [ ] **Step 3: Implement**

Export `buildBreachPrompt` from `breachImpactExplain.ts` (already exported). In `BreachDetailsModal.tsx` replace the `useAiBreachImpactExplain` block (~lines 210–280) with `useAiChat`:

```tsx
const chat = useAiChat({ systemPrompt: BREACH_SYSTEM_PROMPT });
const allowChat = loadAiSettings().allowChatFollowUp;
// on the existing Accordion expand handler, when first expanding and no messages yet:
if (expanded && chat.messages.length === 0 && !chat.streaming) {
  void chat.send(buildBreachPrompt({
    breaches, credentialTitle, credentialUsername, credentialCategory, credentialAgeDays,
  }));
}
// render:
{chat.enabled && expanded && (
  <ChatPanel
    messages={chat.messages}
    streaming={chat.streaming}
    error={chat.error}
    onSend={chat.send}
    onStop={chat.stop}
    onRetry={chat.retry}
    suggestions={allowChat ? ['How do I fix this?', 'Should I change my password?'] : []}
  />
)}
```

Where `breaches`/`credentialTitle`/… are the same values the modal already passes to `ai.analyze` today (match the existing prop/variable names in the file). Add `import { buildBreachPrompt, BREACH_SYSTEM_PROMPT } from '@/core/ai/breachImpactExplain'`. When `!allowChat`, render the last assistant message as the existing static block instead of `ChatPanel`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/presentation/components/__tests__/BreachDetailsModal.test.tsx`
Expected: PASS. Run `npm run test -- src/core/ai/__tests__/breachImpactExplain.test.ts` for no regression.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/components/BreachDetailsModal.tsx src/presentation/components/__tests__/BreachDetailsModal.test.tsx
git commit -m "feat(ai): follow-up chat in breach impact panel"
```

---

### Task 14: Standalone general assistant + entry point

**Files:**
- Create: `src/presentation/components/ai/GeneralAssistant.tsx`
- Test: `src/presentation/components/ai/__tests__/GeneralAssistant.test.tsx`
- Modify: app header/nav (the component that renders the dashboard top bar) to add the entry point.

**Interfaces:**
- Consumes: `useAiChat`, `buildAssistantSystemPrompt`, `loadAiSettings().enableGeneralAssistant` + `generalAssistantDefaultScope`, `ChatPanel`, `ChatScope`.
- Produces: `GeneralAssistant({ open, onClose })` — a Dialog/Drawer with a scope `Select` header; changing scope rebuilds the system prompt and calls `reset()`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/presentation/components/ai/__tests__/GeneralAssistant.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/presentation/hooks/useAiChat', () => ({
  useAiChat: () => ({
    enabled: true, messages: [], streaming: false, error: false,
    send: vi.fn(), stop: vi.fn(), retry: vi.fn(), reset: vi.fn(),
  }),
}));

import { GeneralAssistant } from '@/presentation/components/ai/GeneralAssistant';

describe('GeneralAssistant', () => {
  it('renders the scope selector and chat input when open', () => {
    render(<GeneralAssistant open onClose={vi.fn()} />);
    expect(screen.getByLabelText(/scope/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask a follow-up/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<GeneralAssistant open={false} onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/ask a follow-up/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/presentation/components/ai/__tests__/GeneralAssistant.test.tsx`
Expected: FAIL — cannot resolve `GeneralAssistant`.

- [ ] **Step 3: Implement `GeneralAssistant.tsx`**

```tsx
// src/presentation/components/ai/GeneralAssistant.tsx
import { useMemo, useState, type JSX } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, MenuItem, Select, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ChatPanel } from '@/presentation/components/ai/ChatPanel';
import { useAiChat } from '@/presentation/hooks/useAiChat';
import { buildAssistantSystemPrompt } from '@/core/ai/chat/chatContext';
import { loadAiSettings } from '@/core/ai/aiSettings';
import type { ChatScope } from '@/core/ai/chat/chatTypes';

export interface GeneralAssistantProps { open: boolean; onClose: () => void; }

const SCOPE_LABELS: Record<ChatScope, string> = {
  'stateless': 'No vault data',
  'curated': 'Vault summary',
  'per-credential': 'One credential',
};

export function GeneralAssistant({ open, onClose }: GeneralAssistantProps): JSX.Element | null {
  const [scope, setScope] = useState<ChatScope>(() => loadAiSettings().generalAssistantDefaultScope);
  // Curated/per-credential data wiring is intentionally minimal here: stateless ships first.
  const systemPrompt = useMemo(() => buildAssistantSystemPrompt(scope), [scope]);
  const chat = useAiChat({ systemPrompt });

  if (!open) return null;

  const handleScope = (next: ChatScope) => {
    if (next === scope) return;
    chat.reset();
    setScope(next);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        AI Assistant
        <IconButton aria-label="close" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <Select
            size="small"
            value={scope}
            inputProps={{ 'aria-label': 'scope' }}
            onChange={(e) => handleScope(e.target.value as ChatScope)}
          >
            {(Object.keys(SCOPE_LABELS) as ChatScope[]).map((s) => (
              <MenuItem key={s} value={s}>{SCOPE_LABELS[s]}</MenuItem>
            ))}
          </Select>
          {!chat.enabled && (
            <Typography variant="body2" color="text.secondary">
              On-device AI is unavailable on this device.
            </Typography>
          )}
          <ChatPanel
            messages={chat.messages}
            streaming={chat.streaming}
            error={chat.error}
            onSend={chat.send}
            onStop={chat.stop}
            onRetry={chat.retry}
            suggestions={['How do I make a strong passphrase?', "What's a passkey?"]}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
```

> Scope note: this task ships the **stateless** assistant end-to-end. Wiring the `curated`/`per-credential` data (via `computeVaultSafeAggregate` from already-loaded dashboard data) into `buildAssistantSystemPrompt` is a follow-up enhancement; the selector switches the system-prompt mode now, and curated/per-credential pass no data until that wiring lands. This keeps the task shippable without reaching into vault-loading internals.

- [ ] **Step 4: Add the entry point**

In the dashboard header/nav component, add an icon button (e.g. MUI `ChatBubbleOutline`) gated by `loadAiSettings().enableGeneralAssistant`, with local `const [assistantOpen, setAssistantOpen] = useState(false)` and `<GeneralAssistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />`. Match the file's existing icon-button + state idioms.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/presentation/components/ai/__tests__/GeneralAssistant.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/components/ai/GeneralAssistant.tsx src/presentation/components/ai/__tests__/GeneralAssistant.test.tsx
git commit -m "feat(ai): standalone general assistant (stateless) + entry point"
```

---

## Phase 6 — Verification & docs

### Task 15: Full verification + documentation

**Files:**
- Modify: `SECURITY.md`, `CLAUDE.md`, `TEST_STATUS.md`

- [ ] **Step 1: Full type-check**

Run: `npm run type-check`
Expected: 0 errors. Fix any `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` issues inline.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: 0 errors/warnings. Fix inline.

- [ ] **Step 3: Full test suite**

Run: `npm run test`
Expected: all pass (existing + new). Investigate any failure before proceeding — do not skip.

- [ ] **Step 4: Update `SECURITY.md` §On-Device AI Boundary**

Add a paragraph describing chat: multi-turn `ChatSession` (native session on chrome-builtin/litert; trimmed transcript on webllm), ephemeral RAM-only history destroyed on close/lock, the runtime context-scope selector (stateless/curated/per-credential), the single `assertNoSecrets` chokepoint for app-constructed context, and that free-text user turns are trusted/local and never inspected.

- [ ] **Step 5: Update `CLAUDE.md`**

In the On-device AI Security note + "Last Updated" line, add chat follow-up + general assistant: new `ChatSession` abstraction, `chatContext` chokepoint, three new settings (default on/stateless), ephemeral history, desktop-only in practice (Android surfaces still kill-switched).

- [ ] **Step 6: Update `TEST_STATUS.md`**

Note manual verification: desktop Chrome (Gemini Nano) — follow-up chat in strength + breach panels, standalone assistant stateless Q&A, Stop mid-stream, Retry after error, history cleared on lock.

- [ ] **Step 7: Commit**

```bash
git add SECURITY.md CLAUDE.md TEST_STATUS.md
git commit -m "docs(ai): document chat follow-up + general assistant security boundary"
```

---

## Self-Review

**Spec coverage:**
- Multi-turn abstraction → Tasks 1–5. ✓
- chrome native session / webllm transcript / litert native conversation → Tasks 2–4. ✓
- Security chokepoint + scope builders + reuse of breach guard → Task 6. ✓
- Curated aggregate (safe, no secrets) → Task 7. ✓
- Ephemeral RAM-only history + lock/unmount teardown → Task 8 (`useAiChat`). ✓
- Passive disclaimer + Stop + Retry + chips + transcript UI → Task 9 (`ChatPanel`). ✓
- Three settings, default on/stateless, gated by availability → Tasks 10–11. ✓
- Inline strength + breach surfaces → Tasks 12–13. ✓
- Standalone assistant + runtime scope selector + entry point → Task 14. ✓
- Context-window trim policy (2048 cap) → Task 1 (`trimChatMessages`) applied in Task 3; chrome/litert rely on native session handling. ✓
- Docs (SECURITY/CLAUDE/TEST_STATUS) → Task 15. ✓

**Placeholder scan:** Tasks 11–14 reference existing in-file helpers/variables by description rather than reproducing whole large components verbatim; each names the exact symbol to match and shows the new code. Task 14 explicitly scopes curated/per-credential data-wiring as a follow-up so no step is left vague-but-required.

**Type consistency:** `ChatSession.send/destroy`, `createChatSession(systemPrompt)`, `ChatMessage{id,role,content}`, `ChatScope`, `buildAssistantSystemPrompt(scope, {credential?,aggregate?})`, `assertNoSecrets`, `trimChatMessages(messages,maxTurns)`, `computeVaultSafeAggregate(items)` are used consistently across tasks.

**Known intentional partial:** curated/per-credential scopes ship the system-prompt mode without live vault data in Task 14 (flagged inline); chrome/litert context-window management defers to the native runtimes (only webllm uses the explicit trim). Both are deliberate, not gaps.
