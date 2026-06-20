# On-Device AI: "Breach Impact Analysis" — Validated Design

**Date:** 2026-06-20
**Status:** Implemented

---

## 1. Summary

Add an **"AI Impact Analysis"** feature to TrustVault-PWA's Breach Details Modal that produces a short, human-readable explanation of a data breach's impact and tailored remediation steps.

The feature uses **only Chrome's built-in on-device AI** (Prompt API / Gemini Nano via the global `LanguageModel`).
It sends **only** non-sensitive metadata (such as credential category, age, username format) and public HIBP breach data. It **never** receives the actual password or secret notes.
It **never** initiates a model download. The app remains fully functional with zero AI.

---

## 2. Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Provider scope | **Chrome built-in only** | On-device only. Protects zero-knowledge boundary. |
| Surface | **BreachDetailsModal** | An expandable accordion within the existing breach details modal triggers the analysis on demand. |
| Download policy | **Never trigger download** | Feature enables only when the model is already `available`. Preserves offline-first capabilities. |
| Streaming | Yes (`promptStreaming()`) | Re-uses the generator stream created for the Strength Explain feature. |

---

## 3. Scope

### In scope
- On-device breach impact explanation via Chrome built-in `LanguageModel`.
- Settings module: Add `allowBreachImpactAnalysis` toggle to `AiSettings`.
- Strict availability gating (never-download).
- Wiring into `BreachDetailsModal.tsx`.
- Safety boundary: strict filtering to block `password:` and `notes:` from prompts.

### Out of scope
- Explanations of non-breach related vulnerabilities (e.g. reused passwords).
- Model auto-downloading.

---

## 4. Architecture & Module Layout

```
src/core/ai/
  breachImpactExplain.ts         # safe prompt builder + calls promptApi
  aiSettings.ts                  # added allowBreachImpactAnalysis

src/presentation/
  hooks/useAiBreachImpactExplain.ts  # orchestrator: checks settings, calls explain, handles aborts
  components/BreachDetailsModal.tsx  # the UI that hosts the accordion & streams the explanation
```

### Unit responsibilities
- `breachImpactExplain.ts` — pure prompt construction. Merges the credential metadata (title, category, username, password age) and breach array. Asserts that sensitive values (password/notes) are blocked.
- `useAiBreachImpactExplain.ts` — React hook: gate on settings + availability, provides a stream of text via an `AbortController`.
- `BreachDetailsModal.tsx` — Triggered when the user expands the "AI Impact Analysis" accordion. Renders the streaming text block.

---

## 5. Settings

Added to the existing `aiSettings.ts`:

```ts
export interface AiSettings {
  enableOnDeviceAI: boolean;          // master toggle
  allowStrengthExplanation: boolean;
  allowBreachImpactAnalysis: boolean; // default true
}
```

**Settings UI** — "AI Assistance (Experimental)" section updated with a new toggle:
- Toggle: "Allow AI to explain breach impact"
- Both master toggle and feature toggle must be ON for the feature to trigger.

---

## 6. Data Flow & Zero-Knowledge Boundary

```
BreachDetailsModal 
  └─ user expands "AI Impact Analysis"
       └─ useAiBreachImpactExplain({ credential, breaches })
            └─ breachImpactExplain.ts → builds prompt (no password, no notes)
                 └─ promptApi.runPromptStreaming()
                      └─ streams into explanation panel
```

### Boundary Rules
- **Never sent to AI:** site passwords, TOTP/recovery codes, secret notes/documents.
- **Sent to AI:** credential title, category, username format, password age, and breach details (name, date, compromised data classes).
- The prompt builder (`buildBreachPrompt`) throws an error if strings matching `"password: "` or `"notes: "` are detected.

### Prompt Shape
```
System: You are a security assistant. Explain the impact of a data breach on a specific credential in 3–4 concise sentences...
User:   Title: <title>
        Username format/domain: <username>
        Category: <category>
        Password age: <ageDays> days

        Breaches:
        - Breach Name: <breachName>
          Date: <date>
          Compromised data: <dataClasses>
```

---

## 7. Error Handling & Degradation

- If the AI model is unavailable, the user just won't see the AI accordion or it will fall back gracefully.
- Canceling the generation is supported on modal unmount or re-collapse using `AbortController`.
- **No remote logging** of prompts or responses.

---

## 8. Definition of Done (Verified)
1. Feature guarded by the `allowBreachImpactAnalysis` toggle.
2. `npm run type-check`, `npm run lint`, and unit tests pass.
3. Verification recorded in `SECURITY_AUDIT_REPORT.md` under patch notes.
4. No sensitive data logged or persisted. CryptoKey objects untouched.
