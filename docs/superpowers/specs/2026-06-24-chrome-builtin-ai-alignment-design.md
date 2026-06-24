# Chrome Built-in AI (Gemini Nano) — Best-Practice Architecture Alignment

**Date:** 2026-06-24
**Status:** Approved design — ready for implementation planning
**Owner:** TrustVault PWA on-device AI

---

## 1. Goal & Scope

Align TrustVault's **Chrome built-in / Gemini Nano** on-device AI path with the
now-stable Chrome Prompt API surface (Chrome ~148–149, June 2026). The current
wrapper is intentionally minimal — it calls `LanguageModel.create({ initialPrompts })`
and consumes `promptStreaming` / `clone` / `destroy` / `availability()` with
free-text in and free-text out. It adopts none of the capabilities that became
stable in 2026: native structured output, sampling parameters, language hints,
quota/usage awareness, or the purpose-built task APIs (Summarizer).

This work does an **audit + hardening pass** of the existing wrapper, then layers
**four new capabilities** on the improved foundation.

### In scope
- **Provider hardening:** sampling `params()`, `expectedInputs`/`expectedOutputs`,
  quota/usage seam (`measureInputUsage`), capability hard-gate.
- **Structured output** (`responseConstraint` + JSON Schema) for the strength and
  breach-impact explainers.
- **Summarizer API** for the General Assistant vault overview.
- **Multilingual** input/output via language hints wired to app locale.
- **Quota/usage UX** for multi-turn chat.

### Out of scope
- WebLLM / LiteRT (Android) feature parity. Android is kill-switched
  (`WEBLLM_ANDROID_ENABLED = false`); these providers keep today's behavior and
  report `supports() === false` for all new capabilities. No degraded
  reimplementation is built for them now.
- Multimodal **inputs** (image/audio). Available in the Prompt API but not
  justified for a password manager and a potential privacy-surface expansion —
  explicitly deferred (YAGNI).
- Writer / Rewriter / Proofreader APIs (still origin-trial/EPP; no clear fit).
- Changes to the Zero-Knowledge boundary, persistence model, or logging policy.

### Non-negotiable constraints
- **ZK boundary preserved unchanged.** `assertNoSecrets()`
  (`src/core/ai/chat/chatContext.ts`) remains the single chokepoint for all
  app-constructed context. User free-text turns stay trusted and are not
  content-inspected, exactly as today.
- **Sessions stay ephemeral.** No prompt/response is logged or persisted; sessions
  are destroyed after each one-shot call and on chat panel close / vault lock /
  logout / unmount.
- Inference remains fully local; no new network egress on the Chrome path. (No new
  CSP `connect-src` exception — that only applies to the Android WebLLM weights
  path, untouched here.)

---

## 2. Background: current vs. best-practice surface

**Current Chrome path (`src/core/ai/providers/chromeBuiltinProvider.ts`):**
- `LanguageModel.create({ initialPrompts: [{ role: 'system', content }] })`
- `session.promptStreaming(input, { signal })`, `clone()`, `destroy()`, `availability()`
- Base-session-per-system-prompt cache + clone for isolation; free-text only.

**Stable / best-practice as of June 2026:**
- Prompt API **stable** (Chrome 148) with **structured output** via
  `responseConstraint` (JSON Schema) and **multimodal inputs** (text/image/audio;
  output text-only).
- **`params()`** to read/set `temperature` / `topK`.
- **`expectedInputs` / `expectedOutputs`** declarations, incl. language hints; from
  Chrome 149 Gemini Nano supports en/es/ja/de/fr for input and output.
- **Quota/usage:** `session.inputUsage`, `session.inputQuota`,
  `session.measureInputUsage()`; download `monitor` for progress.
- **Task-specific APIs stable:** Summarizer, Language Detector, Translator (Chrome
  138+). Writer/Rewriter (origin trial), Proofreader (origin trial / EPP).

References:
- https://developer.chrome.com/docs/ai/prompt-api
- https://developer.chrome.com/docs/ai/built-in-apis
- https://developer.chrome.com/docs/ai/summarizer-api
- https://developer.chrome.com/blog/build-new-features-using-built-in-ai-in-chrome-io2026

---

## 3. Architecture (Approach A: capability-typed provider + thin facade)

The clean provider abstraction is preserved. New capabilities are **optional**
members on `AiProvider`, implemented natively by the Chrome provider and gated by a
single `supports()` check. The public facade (`promptApi.ts`) stays the only import
point for feature modules. Each feature **owns its own JSON Schema and result
type** — schemas live next to the prompts that produce them; there is no central
schema registry (rejected as needless indirection for ~3 schemas).

```
promptApi.ts  (facade — stable import surface for hooks/features)
 ├─ runPromptStreaming / runPrompt / createChatSession        (existing)
 ├─ runStructured<T>(schema, { systemPrompt, userPrompt, signal, params, languages })   (NEW)
 └─ measureUsage(session-ish) seam                            (NEW, optional)

providers/types.ts → AiProvider gains OPTIONAL members:
 ├─ supports(cap: 'structured' | 'params' | 'quota' | 'languages'): boolean
 ├─ runStructured?<T>(args): Promise<T>
 └─ extended run/chat opts: { params?, expectedInputs?, expectedOutputs? }

providers/chromeBuiltinProvider.ts → implements all natively:
 ├─ create({ initialPrompts, expectedInputs, expectedOutputs, ...params })
 ├─ session.prompt(userPrompt, { responseConstraint: schema, signal })
 └─ session.measureInputUsage / inputUsage / inputQuota

providers/webllmProvider.ts, providers/litertProvider.ts → supports() => false
                                                            for all new caps

core/ai/summarizer.ts (NEW) → standalone wrapper over the global `Summarizer`
                              (availability + create + summarize), same gate
                              pattern as the LanguageModel provider; kept
                              architecturally separate from the Prompt API
                              provider, matching how Chrome ships them.
```

### Module ownership

| Concern | Module |
| --- | --- |
| Facade / single import point | `src/core/ai/promptApi.ts` |
| Provider interface + capability enum | `src/core/ai/providers/types.ts` |
| Native capability impl + hard-gate | `src/core/ai/providers/chromeBuiltinProvider.ts` |
| `supports() === false` stubs | `webllmProvider.ts`, `litertProvider.ts` |
| Strength schema + result type | `src/core/ai/strengthExplain.ts` |
| Breach schema + result type | `src/core/ai/breachImpactExplain.ts` |
| Summarizer wrapper | `src/core/ai/summarizer.ts` (NEW) |
| Vault overview (uses summarizer) | `src/core/ai/chat/vaultAggregate.ts` |
| Quota-driven trim | `src/core/ai/chat/chatTrim.ts` (Chrome path adds quota branch) |
| Locale → language hint mapping | small helper in `aiSettings.ts` or `providers/capabilities.ts` |

---

## 4. Phased delivery

Each phase is independently shippable once Phase 1 lands. Phases 2–5 do not depend
on each other.

### Phase 1 — Provider hardening (foundation)
- Thread `params()` (low `temperature`, conservative `topK`) through `create()` so
  **security advice is deterministic/steady** across runs.
- Pass `expectedInputs` / `expectedOutputs` (modality + language) into `create()`.
- Add a `measureInputUsage` / `inputUsage` / `inputQuota` seam exposed via the
  facade.
- Add `supports(capability)` to `AiProvider`; Chrome returns true for the relevant
  caps, WebLLM/LiteRT return false. This is the single hard-gate.
- Verify the download `monitor` progress path is wired (Chrome reports
  `downloadable`/`downloading` states).
- **User-visible change:** none beyond steadier outputs. Pure foundation.

### Phase 2 — Structured security insights
- `strengthExplain.ts`: define `StrengthInsight` type + JSON Schema
  (`{ severity, factors[], rankedActions[] }`) and call
  `promptApi.runStructured(schema, …)`.
- `breachImpactExplain.ts`: define `BreachInsight` type + JSON Schema
  (`{ riskLevel, exposedData[], steps[] }`).
- Hooks (`useAiStrengthExplain`, `useAiBreachImpactExplain`) return typed objects;
  `PasswordStrengthIndicator.tsx` and `BreachDetailsModal.tsx` render typed fields
  instead of parsing prose.
- **Multi-turn chat turns remain free-text** (structured output applies only to the
  one-shot explainers).

### Phase 3 — Summarizer-backed vault overview
- New `summarizer.ts` wrapping the global `Summarizer` (availability/create/summarize).
- `vaultAggregate.ts` uses it for the General Assistant overview; **input still runs
  through `assertNoSecrets()`**.
- Falls back to the existing raw-prompt summary if Summarizer is unavailable.

### Phase 4 — Multilingual
- Map app locale → supported Gemini Nano language (en/es/ja/de/fr); pass via
  `expectedInputs`/`expectedOutputs`.
- Explainers and chat render in the user's language; **fall back to English** if the
  locale is unsupported. Never blocks the feature.

### Phase 5 — Quota/usage UX
- On the Chrome path, drive chat trimming from real `inputUsage` / `inputQuota` and
  warn the user before overflow.
- `chatTrim.ts` heuristic is retained as the fallback (and remains the only path for
  non-Chrome providers).

---

## 5. Data flow — structured insight (Phase 2 example)

```
PasswordStrengthIndicator.tsx
  → useAiStrengthExplain (hook)
    → strengthExplain.buildContext()        // label + rounded entropy only
      → assertNoSecrets(context)            // ZK chokepoint (unchanged)
        → promptApi.runStructured(strengthSchema, { systemPrompt, userPrompt, params, languages, signal })
          → getActiveProvider()             // must be chrome-builtin, else gate off
          → chromeBuiltinProvider.runStructured:
              session = create({ initialPrompts, expectedInputs, expectedOutputs, ...params })
              raw = await session.prompt(userPrompt, { responseConstraint: strengthSchema, signal })
              session.destroy()
          → validate(raw) against StrengthInsight (parse; on failure → raw-text fallback)
      ← typed StrengthInsight | { raw: string }
  ← UI renders typed fields (or raw text on fallback)
```

---

## 6. Error handling — graceful degradation everywhere

| Failure | Behavior |
| --- | --- |
| Structured output fails schema validation | Render raw text; no hard error |
| `measureInputUsage` throws / quota unavailable | Fall back to `chatTrim.ts` heuristic |
| Summarizer `unavailable` / `downloadable`-not-ready | Fall back to current `vaultAggregate` raw-prompt summary |
| Requested locale unsupported | Fall back to English; never block |
| Active provider ≠ `chrome-builtin` | `supports()` → false; callers use today's free-text path |
| Model availability `unavailable` | Existing behavior: feature disabled in Settings/UI |

---

## 7. Security

- **Schemas describe only non-secret fields** (severity, categories, action steps).
  No schema field ever names or solicits a password, secret note, or key.
- `assertNoSecrets()` remains the chokepoint for **all** app-constructed input,
  including Summarizer input and structured-prompt context. User free-text chat
  turns stay trusted/uninspected, as today.
- Structured **output** is model-generated text rendered in-UI — already inside the
  ZK-out boundary (decrypted plaintext to browser runtime). No new persistence, no
  logging; sessions destroyed per call.
- No new network egress on the Chrome path; no new CSP exception.
- **Docs to update:** `SECURITY.md` §On-Device AI Boundary, the CLAUDE.md On-device
  AI note, and `TEST_STATUS.md` (manual verification).

---

## 8. Testing & verification

- **TDD** per project discipline. Unit tests mirror `src/core/ai/__tests__/…` and
  `src/presentation/.../__tests__/…`.
- Mock the global `LanguageModel` with `responseConstraint`, `params`,
  `measureInputUsage`; mock the global `Summarizer`.
- Test cases: structured-validation success + raw-text fallback; quota fallback;
  language fallback to English; Summarizer fallback; **`supports()` hard-gate**
  (non-Chrome provider → feature off); ZK chokepoint still invoked on every
  app-constructed path.
- Gates: `npm run type-check` (0), `npm run lint` (0), targeted `npm run test` pass.
- **Manual on-device verification in Chrome 148+/149**, recorded in
  `TEST_STATUS.md`: structured insights render, multilingual output, Summarizer
  overview, quota warning in long chat.

---

## 9. Decisions captured

- **Primary goal:** audit/harden the existing wrapper, then extend. (Both.)
- **Extensions in scope:** structured output, Summarizer vault overview,
  multilingual, quota/usage UX (all four).
- **Provider scope:** Chrome-only, **hard-gate** — new features unavailable unless
  active provider is `chrome-builtin`; no degraded path for WebLLM/LiteRT now.
- **Structure:** Approach A (capability-typed provider + thin facade, per-feature
  schemas). Rejected: central schema registry (B), free-text + post-hoc parsing (C).
- **Single spec, five phases** sharing the Phase 1 foundation; not decomposed.
