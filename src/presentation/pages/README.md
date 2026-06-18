# Presentation: Pages (`src/presentation/pages/`)

## Purpose

Page-level components rendered by router. Each page corresponds to a user flow.

## Public API

### Exported Pages

- `AddCredentialPage` — Create or edit a credential (form + OCR capture)
- `DashboardPage` — View, search, filter credentials list
- `SettingsPage` — Manage autofill, auto-lock, master password, biometric
- `SignInPage` — Login with master password or biometric
- `SignUpPage` — Register new account
- `UnlockPage` — Re-unlock vault after session timeout

### Example Usage (Router)

```typescript
import { AddCredentialPage, DashboardPage, SettingsPage } from '@/presentation/pages';

const routes = [
  { path: '/', element: <DashboardPage /> },
  { path: '/add', element: <AddCredentialPage /> },
  { path: '/settings', element: <SettingsPage /> },
];
```

---

## Design Patterns

### Props & State Management

Pages use Zustand stores directly (no prop drilling):

```typescript
export function DashboardPage() {
  const { user, credentials } = useAuthStore();
  const { credentials: storeCredentials, updateCredential } = useCredentialStore();

  return (
    <div>
      {/* Use store state directly */}
    </div>
  );
}
```

### Error Boundaries

Each page is wrapped in `<ErrorBoundary>` at the router level (see `App.tsx`).

---

## Testing

**Location:** Colocated `.test.tsx` files

Example: `src/presentation/pages/DashboardPage.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';

test('renders credential list', () => {
  render(<DashboardPage />);
  expect(screen.getByText('Your Credentials')).toBeInTheDocument();
});
```

---

## Checklist for New Pages

- [ ] TypeScript strict mode
- [ ] Zustand store integration (no prop drilling)
- [ ] Error boundary wrapper in router
- [ ] Responsive design (mobile-first)
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Test coverage ≥60%
- [ ] Load indicators for async operations
