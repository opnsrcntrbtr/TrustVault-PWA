# E2E Tests

Playwright end-to-end tests for TrustVault PWA.

## Commands

| Command | Description |
|---|---|
| `npm run e2e` | Run all E2E tests (Chromium) |
| `npm run e2e:ui` | Run with Playwright UI |
| `npm run e2e:headed` | Run in headed browser |
| `npm run e2e:debug` | Run in debug mode |

## Structure

```
e2e/
├── login.spec.ts    # Smoke: login page renders
└── ...              # Add more spec files here
```

## Notes

- Tests run against the Vite dev server (`npm run dev`) on port 3000.
- The app serves under `/TrustVault-PWA/` in production builds.
- CI runs on Chromium + WebKit; local runs default to Chromium only.
