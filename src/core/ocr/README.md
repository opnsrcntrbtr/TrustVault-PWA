# Core: OCR (`src/core/ocr/`)

## Purpose

Provides camera-based credential capture and Tesseract OCR parsing:
- Access device camera, capture frames
- Self-hosted Tesseract OCR worker (no external API, P2)
- Parse OCR text into credential fields (username, password, TOTP secret)
- Merge extracted fields with user input

## Public API

### Camera Capture

```typescript
import { isCameraSupported, captureFrame, clearImageData } from '@/core/ocr';

// Check if camera is available
const supported = isCameraSupported();
// → true/false

// Capture frame from video stream
const frame = await captureFrame(videoElement);
// → { imageData, dataUrl }

// Clear sensitive image data
clearImageData(frame);
```

---

### Tesseract Recognition

```typescript
import { initializeWorker, recognizeText, terminateWorker } from '@/core/ocr';

// Initialize worker (lazy-loaded)
const worker = await initializeWorker();

// Recognize text from image
const result = await recognizeText(imageData);
// → { text: "username: john\npassword: p@ssw0rd", confidence: 0.87 }

// Cleanup
await terminateWorker();
```

---

### Credential Parser

```typescript
import { parseCredentialText, mergeExtractedFields } from '@/core/ocr';

// Parse OCR text into credential fields
const extracted = parseCredentialText('username: john\npassword: p@ssw0rd');
// → { username: 'john', password: 'p@ssw0rd', fields: { ... } }

// Merge with user input (user input takes precedence)
const merged = mergeExtractedFields(extracted, userInput);
// → final credential object
```

---

## Design Notes

### Self-Hosted Tesseract (P2)

- **No external API calls** — OCR runs in browser via Web Worker
- **Assets at** `public/ocr/` — copied by `scripts/copy-ocr-assets.js` (pre-build hook)
- **Performance:** ~5-10s per image (depends on image quality, device)
- **Privacy:** All processing stays in user's device

### Camera Permissions

- First access triggers browser permission dialog
- User grants/denies access permanently
- App gracefully degrades if camera unavailable (optional feature)

---

## Import Rules

✅ **Can import from:**
- `@/core/utils/`, `@/domain/entities/`

❌ **Cannot import from:**
- `@/data/`, `@/presentation/`

---

## Testing

**Location:** Colocated `.test.ts` files

Example: `src/core/ocr/credentialParser.test.ts`

```typescript
test('parseCredentialText extracts username and password', () => {
  const text = 'Username: john\nPassword: p@ssw0rd\n2FA: 123456';
  const result = parseCredentialText(text);
  expect(result.username).toBe('john');
  expect(result.password).toBe('p@ssw0rd');
});
```

---

## Checklist for New OCR Code

- [ ] Camera access uses permissions API correctly
- [ ] Worker cleanup (no dangling workers)
- [ ] Image data cleared from memory after OCR
- [ ] No sensitive text logged to console
- [ ] Graceful degradation if camera unavailable
- [ ] Offline-first: Tesseract loads from `public/ocr/`
- [ ] TypeScript strict mode
- [ ] Test coverage ≥70%
