# On-Device AI Chat Follow-Up — Design

**Date:** 2026-06-22
**Status:** Approved (design); implementation plan pending
**Owner:** TrustVault PWA

## Summary

Extend the existing on-device AI features (one-shot password-strength explanation and
breach-impact analysis) with **multi-turn chat follow-up in the same UI/UX**, plus a new
**standalone general assistant**. All inference stays fully local (Chrome Gemini Nano on
desktop; WebLLM/LiteRT on Android behind existing kill-switches). Chat history is
**ephemeral (RAM only)** — never persisted or logged. The work aligns with the current
provider abstraction (`src/core/ai/providers/`) and the zero-knowledge (ZK) security
boundary documented in `SECURITY.md` and `CLAUDE.md`.

## Goals

- Let users ask free-text follow-up questions after any AI explanation, in place.
- Add a standalone general assistant with a **runtime context-scope selector**.
- Reuse the existing provider abstraction, settings, availability gating, and security
  chokepoint — no regression to the one-shot paths.
- Keep the ZK posture: no secrets in prompts, fully local inference, nothing persisted.

## Non-Goals

- No persistence of chat history (no IndexedDB, no localStorage, no logging).
- No new network calls beyond the existing opt-in WebLLM weight download.
- No re-enabling of the Android WebLLM/LiteRT surfaces (kill-switches unchanged).
- No service-worker / background involvement.

## Decisions (from brainstorming)

| Topic | Decision |
|-------|----------|
| Scope | Follow-up chat in **both** existing panels **and** a standalone general assistant. |
| General-assistant data boundary | **Runtime-selectable** scope in the chat menu: Stateless (default) / Curated safe metadata / Per-credential. |
| Chat history lifecycle | **Ephemeral (RAM only)** — cleared on panel close, vault lock, logout, reload. |
| Inbound free-text | **Allowed** with a one-time passive disclaimer; no content inspection, no blocking. |
| Multi-turn mechanics | **Stateful `ChatSession`** per provider (Approach A). Chrome uses a persistent cloned session (incremental + KV-cache reuse); WebLLM/LiteRT keep an internal transcript. |

## Architecture

### Core abstraction: `ChatSession`

Add a stateful, conversation-scoped session alongside the untouched single-turn
`runStreaming` path. The one-shot strength/breach explainers continue to work unchanged.

`src/core/ai/providers/types.ts`:
```ts
export interface ChatSession {
  /** Stream the assistant's reply to one user turn. */
  send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string>;
  /** Free native resources / clear transcript. Idempotent. */
  destroy(): void;
}

export interface AiProvider {
  // ...existing members unchanged...
  /** Create a multi-turn session primed with a (pre-inspected) system prompt. */
  createChatSession(systemPrompt: string): Promise<ChatSession>;
}
```

Per-provider implementation:
- **chrome-builtin** (`chromeBuiltinProvider.ts`): `createChatSession` clones the warmed
  base session once and holds it; `send()` calls `promptStreaming` on the held session
  (native multi-turn + KV-cache reuse); `destroy()` calls `session.destroy()`. The
  existing clone-and-destroy-per-call `runStreaming` stays for the one-shot path.
- **webllm / litert-lm** (`webllmProvider.ts`, `litertProvider.ts`): the session holds an
  internal `messages[]` (system + alternating user/assistant). `send()` pushes the user
  turn, calls `chat.completions.create({ messages })`, accumulates the assistant reply.
  `destroy()` clears the array and calls `resetChat()`. Device-loss handling reused from
  `gpuErrors.ts`. (Approach A subsumes the transcript approach here, since these backends
  expose no incremental API.)

Facade (`promptApi.ts`): add `createChatSession(systemPrompt)` that delegates to
`getActiveProvider()`, mirroring the existing `runPromptStreaming` delegation. The
registry/provider-selection logic (`getActiveProvider()`) is unchanged.

### Security boundary

Hard rule unchanged: **no secrets ever enter a prompt**; inference is fully local; nothing
persisted or logged. Three new concerns are handled as follows.

**Shared safe-context builder (one chokepoint)** — `src/core/ai/chat/chatContext.ts`:
builds every system prompt and any structured context block, and runs the existing
defense-in-depth inspection (the `password:`/`notes:` invariant extracted from
`breachImpactExplain.ts`) **before** a session is created. Providers never assemble
context themselves. Scope → emitted context:

- **Stateless** → system prompt only ("generic security assistant; no access to the
  user's vault"). No vault data.
- **Curated safe metadata** → appends a non-secret aggregate block computed on explicit
  user action: counts of weak/reused/breached items, category breakdown, oldest-password
  age. Never a password/note/key, never titles+secrets together. Run through the inspector.
- **Per-credential** → user explicitly attaches one credential's safe metadata (title,
  username, category, age, breach flags) — the same fields the breach panel already sends.
  Run through the inspector.

Inline panels (strength / breach) are implicitly **per-credential**, pre-seeded with the
metadata that surface already uses; no scope selector shown there.

**Inbound free-text:** allowed, passed through verbatim (local + RAM-only). A one-time
subtle disclaimer renders above the input on first use: *"Replies are generated on your
device and never leave it. Avoid pasting real passwords."* No content inspection, no
blocking. User turns are **not** routed through the secret-inspector — that guard applies
only to app-constructed context, which must stay clean.

**Teardown / ephemerality:** `ChatSession.destroy()` is called on panel close, component
unmount, vault lock, and logout. The chat hook subscribes to the auth/lock store to
force-destroy and clear React state on lock. No transcript is written to disk, IndexedDB,
or console. The session-per-conversation lifecycle replaces "destroy after each call".

`SECURITY.md` §On-Device AI Boundary and `CLAUDE.md` are updated to describe chat, the
scope selector, and the "user free-text is trusted/local, app context is inspected"
distinction.

### UI/UX

One shared presentational `ChatPanel` drives all three surfaces; only the wrapper and
initial context differ.

`src/presentation/components/ai/ChatPanel.tsx`:
- Renders the transcript (user right-aligned, assistant left), a live-streaming reply
  using the existing stream treatment, an error row with retry, a Stop button while
  streaming (wired to the abort controller), and a text input + send.
- The first assistant message is the existing one-shot explanation, so the panel opens
  already populated; the input below is "ask a follow-up." No empty-state friction.
- Optional suggested-prompt chips above the input (e.g. "How do I fix this?", "What's a
  passkey?"); tapping fills/sends text.

Surfaces:
- **1 & 2 — inline:** the strength explainer and Breach Details modal keep their current
  "Explain with AI" entry point. When expanded, they render `ChatPanel` seeded with the
  generated explanation as message 1 and **per-credential** context. No scope selector.
- **3 — standalone general assistant:** a new entry point (chat icon in the dashboard
  header / nav) opens the same `ChatPanel` in a fuller layout with a **context-scope
  selector** in its menu (Stateless [default] / Curated / Per-credential). Changing scope
  destroys the old session, starts fresh, and shows a one-line note of what the assistant
  can now see.

```
┌─ AI Assistant ───────────── [scope: Stateless ▾] [×] ─┐
│  ⓘ Replies are generated on your device and never      │
│    leave it. Avoid pasting real passwords.            │
│                                                       │
│            How do I make a strong passphrase? │ ◀ user│
│  ◀ asst │ A passphrase of 4+ random words…            │
│                                                       │
│  [How do I fix this?] [What's a passkey?]   ← chips   │
│  ┌─────────────────────────────────┐  [Stop] [Send]  │
│  │ Ask a follow-up…                │                 │
│  └─────────────────────────────────┘                 │
└───────────────────────────────────────────────────────┘
```

Hooks: a new `useAiChat({ systemPrompt, seedMessages?, scope? })` owns the ephemeral
`messages[]`, the `ChatSession` ref, streaming state, abort, and lock-teardown. The
existing `useAiStrengthExplain` / `useAiBreachImpactExplain` are refactored to seed
`useAiChat` (or thin-wrap it) so the one-shot behavior becomes "turn 1 of a chat."

### Data flow & lifecycle

A single turn:
1. User submits text (or a chip). Hook pushes a `{ role: 'user' }` turn and renders it.
2. Hook creates an `AbortController`, aborting any in-flight turn first.
3. On first turn, hook lazily calls `createChatSession(systemPrompt)` and stores the
   session ref; later turns reuse it.
4. `for await` over `session.send(userText, signal)`, appending chunks to a streaming
   `{ role: 'assistant' }` turn for live rendering.
5. On completion, finalize the turn. On `AbortError`, keep partial text and drop the
   spinner. On other errors, show the error row + retry (retry re-sends the last user
   turn).

Context-window policy (2048-token cap, shared by both backends):
- **chrome-builtin:** read `inputUsage`/`inputQuota` when exposed; when a turn would
  exceed the budget, rebuild the session from system prompt + last *N* turns (drop
  oldest). Rebuild is occasional, so KV-cache reuse is preserved between rebuilds.
- **webllm/litert:** the session trims its internal `messages[]` to system + last *N*
  turns before each `create()`.
- A shared conservative turn-budget constant lives with the session code; oldest turns
  drop first; system prompt + structured context always retained. Optional "earlier
  messages trimmed" marker when trimming occurs.

Lifecycle / teardown:
- `useAiChat` cleanup (unmount) → `destroy()` + abort in-flight.
- Auth/lock store subscription → on lock/logout, `destroy()` and clear `messages[]`.
- Scope change (standalone only) → `destroy()` old, clear transcript, start fresh.
- WebGPU device-loss mid-stream → reuse `gpuErrors.ts`: reset engine, one clean error,
  allow retry.

Not introduced: no persistence, no service-worker involvement, no new network calls
(chat reuses the already-loaded model; the only existing network exception remains the
opt-in WebLLM weight download).

### Settings & gating

Reuse `aiSettings.ts` (localStorage) and `getAiAvailability()` gating. New settings,
nested under the existing `enableOnDeviceAI` master toggle:

- `allowChatFollowUp: boolean` (default `true`) — follow-up chat in the inline panels.
- `enableGeneralAssistant: boolean` (default `true`) — shows the standalone entry point.
- `generalAssistantDefaultScope: 'stateless' | 'curated' | 'per-credential'`
  (default `'stateless'`) — scope the standalone assistant opens with.

When `enableOnDeviceAI` is off or `getAiAvailability()` is `'unavailable'`, all chat
surfaces and new toggles are disabled/hidden — the rule `AiAssistanceSettings.tsx`
already applies. `AiAssistanceSettings.tsx` gains a "Chat" subsection with the two
booleans + default-scope picker and copy explaining the local/ephemeral boundary.

Platform behavior unchanged: desktop Chrome → chat on Gemini Nano; Android WebLLM/LiteRT
remain behind `WEBLLM_ANDROID_ENABLED` / `LITERT_ANDROID_ENABLED`. The abstraction is
ready for Android with no further change.

## Testing

Vitest, following the existing `__tests__` layout:
- **Core:** `ChatSession` per provider — multi-turn ordering, transcript trim policy,
  `destroy()` idempotency, abort mid-stream, device-loss path (webllm/litert), chrome
  session reuse vs. rebuild-on-budget.
- **Security:** `chatContext.ts` — each scope emits only safe fields; inspector throws on
  injected `password:`/`notes:`; free-text user turns bypass the inspector but app
  context never does.
- **Hooks:** `useAiChat` — seed message becomes turn 1, streaming accumulation, abort
  keeps partial, retry re-sends last turn, lock/unmount teardown destroys session +
  clears state, scope change resets.
- **Component:** `ChatPanel` — renders transcript, disclaimer shows once, Stop wired to
  abort, chips send, scope selector only in standalone.
- **Settings:** new toggles gate surfaces; all disabled when availability is
  `'unavailable'`.

## Definition of Done (from `CLAUDE.md`)

- `npm run type-check` (0 errors), `npm run lint` (0 errors), targeted `npm run test` pass.
- `SECURITY.md` + `CLAUDE.md` updated; manual verification noted in `TEST_STATUS.md`.
- No sensitive data logged; `ChatSession` state stays memory-bound; no persistence.

## Files (new / changed)

New:
- `src/core/ai/chat/chatContext.ts` — safe-context builder + inspector (extracts the
  existing invariant).
- `src/presentation/components/ai/ChatPanel.tsx` — shared chat UI.
- `src/presentation/hooks/useAiChat.ts` — ephemeral chat state + session lifecycle.
- Standalone assistant entry point + container component.
- Tests mirroring each new module under the existing `__tests__` layout.

Changed:
- `src/core/ai/providers/types.ts` — `ChatSession` + `createChatSession`.
- `src/core/ai/providers/chromeBuiltinProvider.ts`, `webllmProvider.ts`,
  `litertProvider.ts` — implement `createChatSession`.
- `src/core/ai/promptApi.ts` — `createChatSession` facade.
- `src/core/ai/aiSettings.ts` — three new settings.
- `src/presentation/components/AiAssistanceSettings.tsx` — Chat subsection.
- `src/presentation/hooks/useAiStrengthExplain.ts`, `useAiBreachImpactExplain.ts` —
  refactor to seed/wrap `useAiChat`.
- `SECURITY.md`, `CLAUDE.md`, `TEST_STATUS.md` — docs.
