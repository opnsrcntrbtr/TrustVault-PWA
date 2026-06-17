/**
 * Dashboard Sort Integration Tests
 *
 * Regression coverage for the sort control's discoverability. The control must
 * sit prominently at the TOP of the credentials area (with the search / filter
 * row), BEFORE the curated Favorites / Recently Used sections. Burying it below
 * those sections made the bold "Recently Used" section heading read as if it had
 * replaced the control, and pushed the dropdown far down and to the right.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/presentation/App';
import { useAuthStore } from '@/presentation/store/authStore';
import { db } from '@/data/storage/database';

async function setupAuthenticatedUser(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
  }, { timeout: 5000 });

  await user.type(screen.getByLabelText(/username/i), 'sorttester');
  await user.type(screen.getByLabelText(/email/i), 'sort@example.com');
  const [passwordInput, confirmInput] = screen.getAllByLabelText(/master password/i);
  if (!passwordInput || !confirmInput) throw new Error('master password fields not found');
  await user.type(passwordInput, 'TestPassword123!');
  await user.type(confirmInput, 'TestPassword123!');
  await user.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => {
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  }, { timeout: 10000 });
  await waitFor(() => {
    expect(screen.getByLabelText('add')).toBeInTheDocument();
  }, { timeout: 10000 });
}

async function createCredential(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  { favorite = false }: { favorite?: boolean } = {}
) {
  await user.click(screen.getByLabelText('add'));
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
  }, { timeout: 5000 });

  await user.type(screen.getByLabelText(/title/i), title);
  await user.type(screen.getByLabelText(/username/i), `${title}@example.com`);
  await user.type(screen.getByLabelText(/^password/i), 'testpass123');
  if (favorite) {
    await user.click(screen.getByRole('checkbox', { name: /add to favorites/i }));
  }
  await user.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(screen.getByLabelText('add')).toBeInTheDocument();
  }, { timeout: 5000 });
}

describe('Dashboard sort layout', () => {
  beforeEach(async () => {
    useAuthStore.getState().clearSession();
    localStorage.clear();
    sessionStorage.clear();
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();
    await vi.waitFor(() => {}, { timeout: 100 });
    window.history.pushState({}, '', '/');
    localStorage.setItem('trustvault_tour_state', JSON.stringify({ completed: true, version: '1.0.0', tours: {} }));
  });

  it('renders the sort control at the top, before the Favorites section', async () => {
    const user = userEvent.setup();
    render(<App />);

    await setupAuthenticatedUser(user);
    await createCredential(user, 'Banana', { favorite: true });
    await createCredential(user, 'Apple');

    // Favorites SECTION heading (CredentialSection renders an <h2>); this is
    // distinct from the "Favorites" filter chip (a button) higher up the page.
    const favoritesHeading = await screen.findByRole('heading', { name: 'Favorites', level: 2 });
    // The sort control is present.
    const sortControl = screen.getByRole('combobox', { name: /sort by/i });

    // Root-cause assertion: the sort control must come BEFORE the Favorites
    // section in document order so it stays prominent at the top of the
    // credentials area instead of being buried under the curated sections.
    // DOCUMENT_POSITION_PRECEDING (2) means sortControl precedes favoritesHeading.
    const position = favoritesHeading.compareDocumentPosition(sortControl);
    expect(position & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('reorders the credentials grid when a sort option is selected', async () => {
    const user = userEvent.setup();
    render(<App />);

    await setupAuthenticatedUser(user);
    await createCredential(user, 'Banana');
    await createCredential(user, 'Apple');

    const getGridTitles = () =>
      within(screen.getByTestId('credentials-grid'))
        .getAllByRole('heading', { level: 6 })
        .map((h) => h.textContent.trim());

    // Default updated-desc → newest first: Apple, Banana.
    await waitFor(() => { expect(getGridTitles()).toEqual(['Apple', 'Banana']); });

    // Switch to Title A-Z → Apple, Banana (already), then Title Z-A → Banana, Apple.
    await user.click(screen.getByRole('combobox', { name: /sort by/i }));
    await user.click(await screen.findByRole('option', { name: /title z-a/i }));

    await waitFor(() => { expect(getGridTitles()).toEqual(['Banana', 'Apple']); });
  });
});
