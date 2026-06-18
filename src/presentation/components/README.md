# Presentation: Components (`src/presentation/components/`)

## Purpose

Reusable UI components for building pages and dialogs.

## Public API

### Credential Components

- `CredentialCard` — Display single credential (username, category, actions)
- `CredentialDetailsDialog` — Show/edit credential details
- `AddCredentialDialog` — Form for adding new credential with validation

### Security Components

- `BreachAlertBanner` — Alert if credential password is in HIBP
- `BiometricSetupDialog` — Configure WebAuthn biometric unlock
- `PasswordGeneratorDialog` — Generate strong passwords
- `PasswordStrengthIndicator` — Show password strength meter

### Utility Components

- `SearchBar` — Filter credentials by text
- `FilterChips` — Filter by category
- `SortDropdown` — Sort credentials (alphabetical, date, etc.)
- `ErrorBoundary` — Catch and display errors
- `OfflineIndicator` — Show when app is offline
- `ThemeToggle` — Dark/light mode switcher

### Dialogs

- `ExportDialog` — Encrypt and download vault
- `ImportDialog` — Import encrypted vault
- `ChangeMasterPasswordDialog` — Re-hash and re-encrypt vault

---

## Design Patterns

### Component Props

All component props are TypeScript interfaces:

```typescript
export interface CredentialCardProps {
  credential: Credential;
  onEdit?: (cred: Credential) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}

export function CredentialCard({ credential, onEdit, onDelete, loading }: CredentialCardProps) {
  // ...
}
```

### Dialogs & Modals

Dialogs use controlled state from parent:

```typescript
const [isOpen, setIsOpen] = useState(false);
return (
  <>
    <button onClick={() => setIsOpen(true)}>Add</button>
    <AddCredentialDialog
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSave={(cred) => {
        addCredential(cred);
        setIsOpen(false);
      }}
    />
  </>
);
```

### Accessibility

All components follow WCAG 2.1 AA:
- ARIA labels on icon buttons
- Keyboard navigation (Tab, Enter, Escape)
- Focus indicators
- Semantic HTML (button, input, label)

---

## Testing

**Location:** Colocated `.test.tsx` files

Example: `src/presentation/components/CredentialCard.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { CredentialCard } from './CredentialCard';
import { createMockCredential } from '@/__tests__/fixtures';

test('renders credential username', () => {
  const cred = createMockCredential({ username: 'john@example.com' });
  render(<CredentialCard credential={cred} />);
  expect(screen.getByText('john@example.com')).toBeInTheDocument();
});

test('calls onEdit when edit button clicked', () => {
  const cred = createMockCredential();
  const onEdit = vi.fn();
  render(<CredentialCard credential={cred} onEdit={onEdit} />);
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));
  expect(onEdit).toHaveBeenCalledWith(cred);
});
```

---

## Checklist for New Components

- [ ] TypeScript strict mode
- [ ] Props documented with JSDoc
- [ ] ARIA labels and semantic HTML
- [ ] Keyboard navigation support
- [ ] No console logs in production
- [ ] Responsive (mobile-first)
- [ ] Test coverage ≥70%
- [ ] Storybook stories (optional, for design teams)
