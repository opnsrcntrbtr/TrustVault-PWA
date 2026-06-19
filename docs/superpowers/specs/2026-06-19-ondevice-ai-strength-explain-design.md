# On-Device AI: "Explain Password Strength" — Validated Design

**Date:** 2026-06-19
**Status:** Approved design (pre-implementation)
**Supersedes:** `trustvault-ai-lowest-risk-plan.md` (uploaded draft) — see §10 for what changed and why.

---

## 1. Summary

Add a single experimental AI feature to TrustVault-PWA: an **"Explain with AI"** button on eligible
password strength indicators that produces a short human-readable explanation of *why* a password is rated as it is.

The feature uses **only Chrome's built-in on-device AI** (Prompt API / Gemini Nano via the global `LanguageModel`).
It sends **only** the already-displayed strength label and entropy estimate — never a password or any secret.
It **never** initiates a model download. The app remains fully functional with zero AI.

This document is the validated, codebase-aligned replacement for the original uploaded plan. It corrects three
architectural mismatches and two stale-API assumptions in that draft (see §10).

---

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Provider scope | **Chrome built-in only** | On-device only. Drops the Window AI extension path, which would route prompts through a third-party extension that may hold remote API keys — incompatible with zero-knowledge posture. |
| Surface | **Password surface matrix** | The current implemented surface is `PasswordGeneratorPage`. Other password add/generate/edit modules are inventoried below and classified as eligible-later or excluded so future work does not accidentally expose sensitive flows. |
| Download policy | **Never trigger download** | Feature enables only when the model is already `available`. If `downloadable`, app shows a hint and does nothing — no app-initiated multi-GB download; offline-first intact. |
| Streaming | Yes (`promptStreaming()`) | Better UX; isolated in one wrapper file. |

---

## 3. Scope

### In scope (v1)
- On-device strength explanation via Chrome built-in `LanguageModel`.
- Settings module + two toggles that currently default to on (`enableOnDeviceAI: true`, `allowStrengthExplanation: true`).
- Strict availability gating (never-download).
- Wiring into the inline strength UI on `PasswordGeneratorPage.tsx`.
- Comprehensive documentation of all password add/generate/edit surfaces and their eligibility.
- Tests + `SECURITY.md` update.

### Out of scope (explicitly deferred — YAGNI)
- Window AI extension provider (`windowAI.ts`, dual-provider abstraction, selection manager, `AIContext.tsx`).
- WebLLM / bundled / app-downloaded models.
- Note rewriting or any feature touching secret fields.
- Implementing AI explanation UI on add/edit credential pages, the embedded generator dialog, export passwords,
  master-password flows, import flows, breach checks, or repository/key-management modules.

---

## 4. Architecture & Module Layout

Follows existing conventions: logic in `src/core`, React in `src/presentation`. Settings follow the
existing localStorage-module pattern (`src/core/autofill/autofillSettings.ts`) — **not** a Zustand store
and **not** a `useSettings()` hook (neither exists in this codebase).

```
src/core/ai/
  aiAvailability.ts    # availability() → 'available' | 'downloadable' | 'downloading' | 'unavailable'
  promptApi.ts         # thin wrapper over global LanguageModel.* (create + streaming prompt)
  aiSettings.ts        # localStorage module, mirrors autofillSettings.ts
  strengthExplain.ts   # builds safe prompt from strength metadata; calls promptApi
  __tests__/

src/presentation/
  hooks/useAiStrengthExplain.ts          # consumes core/ai; respects settings + availability
  components/PasswordStrengthIndicator.tsx  # shared strength UI; future expansion must be opt-in per consumer
  pages/SettingsPage.tsx                    # (existing) add "AI Assistance (Experimental)" section
```

**Single provider → no selection layer.** The original plan's `providers.ts` interface,
`chromeBuiltIn.ts`/`windowAI.ts` implementations, `manager.ts`, and `AIContext.tsx` are all dropped.
With one provider there is nothing to abstract or select.

### Unit responsibilities
- `aiAvailability.ts` — detect the global `LanguageModel` and report availability. No side effects, no `create()`.
- `promptApi.ts` — only place that touches `LanguageModel.create()` / `session.prompt()` / `promptStreaming()`. Isolates API drift.
- `aiSettings.ts` — load/save `AiSettings` to localStorage; secure defaults.
- `strengthExplain.ts` — pure prompt construction + a single call into `promptApi`. Asserts no secret in payload.
- `useAiStrengthExplain.ts` — React glue: gate on settings + availability, expose `{ enabled, explain, loading }`.

---

## 5. Settings

`src/core/ai/aiSettings.ts`, mirroring `autofillSettings.ts` (localStorage, merge-with-defaults, try/catch):

```ts
export interface AiSettings {
  enableOnDeviceAI: boolean;          // default true — master toggle
  allowStrengthExplanation: boolean;  // default true — feature toggle
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enableOnDeviceAI: true,
  allowStrengthExplanation: true,
};

const STORAGE_KEY = 'trustvault_ai_settings';
// loadAiSettings(): AiSettings    — merge stored over defaults
// saveAiSettings(s): void
```

**Settings UI** — new "AI Assistance (Experimental)" section in `SettingsPage.tsx`:
- Toggle: "Enable on-device AI (Chrome built-in, where available)" → `enableOnDeviceAI`.
  Help: "Uses your browser's on-device model. TrustVault never sends your passwords or secrets, and never downloads a model for you."
- Toggle: "Allow AI to explain password strength" → `allowStrengthExplanation`.
  Help: "AI receives only the strength rating and entropy estimate — never your password."
- Show detected availability state (e.g. "On-device AI: available" / "not available in this browser" / "enable in your browser first").

Both toggles default to on, matching the current implementation and tests. Availability gating still hides the feature
unless Chrome's built-in model is already `available`. No API-key field (no remote provider).

---

## 5.1 Password Surface Matrix

The feature is metadata-only everywhere: any eligible surface may pass only `{ strength, entropyBits }` to AI.
No implementation may pass password characters, username, title, URL/origin, notes, TOTP/recovery codes,
master-password material, export passwords, or CryptoKey material.

| Surface / module | Password role | AI eligibility | Notes |
|------------------|---------------|----------------|-------|
| `src/presentation/pages/PasswordGeneratorPage.tsx` | Standalone generated password/passphrase/pronounceable output. | **Eligible now / implemented v1.** | Page owns `strength` + `entropy`, so it can call `useAiStrengthExplain({ strength, entropyBits })` without exposing the generated value. |
| `src/presentation/components/PasswordGeneratorDialog.tsx` + `src/presentation/hooks/usePasswordGenerator.ts` | Embedded generator used by add/edit credential forms. | **Eligible later.** | It currently has a generated password and a strength object, but future work should route through a shared gated panel instead of duplicating UI. |
| `src/presentation/pages/AddCredentialPage.tsx` | Manually entered, generated, or OCR-applied credential password before save. | **Eligible later with explicit click.** | May only send strength label + entropy. Must never include title, URL, username, tags, notes, TOTP, or OCR source text. |
| `src/presentation/pages/EditCredentialPage.tsx` | Existing decrypted credential password loaded into edit state, then modified by user. | **Eligible later with explicit click.** | Treat as a stored secret in memory. The AI call remains metadata-only and must not trigger automatically when loading the credential. |
| `src/presentation/components/OcrResultDialog.tsx` | OCR-confirmed password staging before applying to add/edit forms. | **Not a direct AI surface.** | It may feed add/edit forms, but the OCR review dialog itself should not explain strength or call AI. |
| `src/presentation/components/PasswordStrengthIndicator.tsx` | Shared strength meter used by add/edit, generator dialog, export, and master-password flows. | **Shared UI candidate, consumer-gated.** | Any future AI panel inside this component must require an explicit opt-in prop such as `allowAiExplanation` plus caller-provided metadata, so excluded consumers cannot inherit AI. |
| `src/presentation/components/ChangeMasterPasswordDialog.tsx` | Master-password change flow. | **Excluded.** | Master passwords and confirmation fields remain outside AI, even metadata-only, unless a separate security review approves a change. |
| `src/presentation/components/ExportDialog.tsx` | Export-file password creation. | **Excluded.** | Export passwords protect backups. Do not add AI explanation without a separate security review. |
| `src/presentation/components/ImportDialog.tsx` and repository import paths | Bulk credential password ingestion. | **Excluded.** | Import is not an interactive strength-explanation surface; repository paths must never call AI. |
| `src/data/repositories/CredentialRepositoryImpl.ts` | Credential encryption, updates, import/export persistence. | **Excluded.** | Persistence and encryption code must remain AI-free. |
| `src/data/repositories/UserRepositoryImpl.ts` | Master-password hashing, auth, biometric enrollment, master-password change. | **Excluded.** | Key management and auth code must remain AI-free. |
| Sign-in/unlock pages and dialogs | Authentication password entry. | **Excluded.** | Auth secrets are never AI inputs or AI-triggering surfaces. |
| Breach-check modules and Security Audit page | HIBP/password-risk checks over stored credentials. | **Excluded for this feature.** | Any future explanatory audit feature needs a separate spec and must preserve k-anonymity/privacy constraints. |

---

## 6. Provider — Availability Gating (never-download)

`aiAvailability.ts` maps the Chrome Prompt API state to a feature decision:

| `LanguageModel.availability()` | Feature behavior |
|--------------------------------|------------------|
| `available` | Button shown (if settings on). |
| `downloadable` | Button hidden. Hint: "Enable on-device AI in your browser first." **No `create()` call.** |
| `downloading` | Button hidden. Hint only. |
| `unavailable` / API absent | Feature hidden entirely. |

`promptApi.ts` (June-2026 API shape):

```ts
// Detection: global `LanguageModel`, not window.ai.languageModel (old origin-trial shape).
// availability(): Promise<'unavailable'|'downloadable'|'downloading'|'available'>
// create() only ever called when availability === 'available'.

const session = await LanguageModel.create({
  initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
});
const stream = session.promptStreaming(userPrompt, { signal });
// consume stream → text; session.destroy() when done
```

All `LanguageModel` access is confined to `promptApi.ts` so future API changes touch one file.

---

## 7. Data Flow & Zero-Knowledge Boundary

```
PasswordGeneratorPage inline strength UI  (currently implemented v1; owns { strength, entropy })
  └─ user clicks "Explain with AI"
       └─ useAiStrengthExplain({ strength, entropyBits })   ← ONLY a label + a rounded integer
            └─ strengthExplain.ts → builds prompt (no password, no site, no username)
                 └─ promptApi.session.promptStreaming()  (on-device)
                      └─ stream into explanation panel + "Generated by Chrome built-in AI"

Future eligible credential surfaces:
Add/Edit/embedded generator strength UI
  └─ user explicitly clicks an AI explanation affordance
       └─ caller passes only { strength, entropyBits }
            └─ same hook/core flow as above

Excluded surfaces:
Master password, export password, auth unlock/sign-in, import/repository, breach-check, and key-management flows
  └─ no AI affordance and no call into core/ai
```

### Boundary rules (§9 of original, retained and tightened)
- **Never sent to AI:** master password, site passwords, TOTP/recovery codes, secret notes/documents,
  username, site origin, credential title.
- **Sent to AI:** the `strength` enum (`weak|medium|strong|very-strong`) and the rounded `entropy` integer
  — the same two values the strength meter already displays to the user.
- AI is treated as **outside** the zero-knowledge boundary even though it runs on-device. Documented in
  code comments and `SECURITY.md`.

### Prompt shape
```
System: You are a security assistant. Explain password strength in 2–3 simple sentences.
        Never ask for or guess the actual password.
User:   The password strength is "<strength>" with an estimated entropy of <entropyBits> bits.
        Explain why and give one tip. Do not guess or reveal any password.
```

---

## 8. Error Handling, Logging, Offline

- Any failure (API absent, `create()` throws, stream error) → hook returns `null`, button degrades silently.
  The generator and strength meter keep working. AI never blocks core flows.
- **No remote logging** of prompts or responses (CLAUDE.md rule). No persistence of prompt/response.
- Dev-only debug logging gated behind a dev flag; `drop_console: true` strips it in prod.
- Offline: never-download policy means no network dependency. On-device inference works offline once the
  browser already has the model; otherwise feature is simply hidden.

---

## 9. Testing & Definition of Done

### Tests (Vitest)
- `aiAvailability`: all four states map to correct feature decision; `create()` never called unless `available`.
- `strengthExplain`: prompt builder output contains the strength label + entropy and **asserts absence**
  of any secret-shaped field (no password, username, origin); fuzz a few inputs.
- `aiSettings`: defaults are both `true`; load merges over defaults; save round-trips.
- `useAiStrengthExplain`: disabled when settings off, when unavailable, or when API absent; degrade path returns null.
- `PasswordGeneratorPage`: current v1 button visibility, click payload, loading copy, and error copy.
- Future eligible surfaces: add targeted tests before wiring `PasswordGeneratorDialog`, `AddCredentialPage`, or
  `EditCredentialPage`.
- Excluded surfaces: if shared UI moves into `PasswordStrengthIndicator`, add negative tests proving
  `ChangeMasterPasswordDialog` and `ExportDialog` do not inherit the AI affordance.

### Definition of Done (per CLAUDE.md)
1. Feature guarded as experimental (both toggles default on, with availability gating and no remote provider). ✔ by design.
2. `npm run type-check` 0 errors, `npm run lint` 0 errors, targeted `npm run test` pass.
3. Manual verification recorded (Chrome with built-in AI available + unavailable; offline; no-AI browser).
4. `SECURITY.md` updated with an "On-device AI boundary" subsection; CLAUDE.md security notes touched if needed.
5. No sensitive data logged; no prompt/response persisted; CryptoKey objects untouched by this feature.

---

## 10. What Changed vs the Uploaded Plan (and why)

| Original plan | This design | Why |
|---------------|-------------|-----|
| Dual provider: Chrome built-in **+** Window AI extension | **Chrome built-in only** | Window AI routes prompts through a third-party extension that may hold remote API keys → breaks on-device / zero-knowledge guarantee. |
| `providers.ts` / `manager.ts` / `AIContext.tsx` selection layer | Dropped | One provider needs no abstraction or selection. YAGNI. |
| `useSettings()` Zustand-style hook | `aiSettings.ts` **localStorage module** | Codebase has no `useSettings()` and no app-settings Zustand store; settings use the localStorage-module pattern (`autofillSettings.ts`). |
| `window.ai.languageModel` / `ai.languageModel.availability()` | Global `LanguageModel.create()` / `LanguageModel.availability()` | June-2026 Prompt API moved off the `window.ai.languageModel` origin-trial shape to the global `LanguageModel`. |
| `window.ai.createTextSession` (Window AI) | Removed | 2023-era extension API; Window AI dropped anyway. |
| "No app-initiated model downloads" but `create()` on any state | **Never-download gate** (`available` only) | Calling `create()` in `downloadable` state makes the browser fetch Gemini Nano (~1–4 GB). The never-download gate makes the no-download claim actually true. |
| Streaming "assume false" | Streaming via `promptStreaming()` | Supported in current API; better UX. |

### Validated as correct in the original plan
- Sending only strength label + entropy (never the password) — sound; the data already exists in
  `PasswordStrengthResult` from `strengthAnalyzer.ts` (zxcvbn-based).
- Metadata-only prompts, graceful degradation, and no remote logging — all retained.
- Treating AI as external even when on-device — retained.

---

## 11. Open Items / Future Phases

- Candidate future eligible surfaces: `PasswordGeneratorDialog.tsx`, `AddCredentialPage.tsx`, and
  `EditCredentialPage.tsx`, each with explicit click and metadata-only input.
- Keep excluded unless separately reviewed: master-password flows, export-password flows, auth unlock/sign-in,
  import/repository paths, breach-check modules, and key-management modules.
- After v1 validation: consider a separate Security Audit explanation feature only under a new spec.
- Note-rewriting for explicitly-flagged non-secret notes — only after a separate security review.
- Re-evaluate Window AI / remote providers only if a future requirement justifies relaxing the on-device
  guarantee (currently: no).
