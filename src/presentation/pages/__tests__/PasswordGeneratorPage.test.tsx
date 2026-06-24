import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/presentation/hooks/useAiStrengthExplain', () => ({
  useAiStrengthExplain: vi.fn(),
}));
vi.mock('@/features/vault/generator/passwordGenerator', () => ({
  generatePassword: vi.fn(),
  generatePronounceablePassword: vi.fn(),
}));
vi.mock('@/features/vault/generator/passphraseGenerator', () => ({
  generatePassphrase: vi.fn(),
  getDefaultPassphraseOptions: vi.fn(),
}));
vi.mock('@/presentation/utils/clipboard', () => ({
  copyPassword: vi.fn(),
}));

import PasswordGeneratorPage from '../PasswordGeneratorPage';
import { useAiStrengthExplain } from '@/presentation/hooks/useAiStrengthExplain';
import {
  generatePassword,
  generatePronounceablePassword,
} from '@/features/vault/generator/passwordGenerator';
import {
  generatePassphrase,
  getDefaultPassphraseOptions,
} from '@/features/vault/generator/passphraseGenerator';
import { copyPassword } from '@/presentation/utils/clipboard';

const mockedUseAiStrengthExplain = vi.mocked(useAiStrengthExplain);
const mockedGeneratePassword = vi.mocked(generatePassword);
const mockedGeneratePassphrase = vi.mocked(generatePassphrase);
const mockedGeneratePronounceablePassword = vi.mocked(generatePronounceablePassword);
const mockedGetDefaultPassphraseOptions = vi.mocked(getDefaultPassphraseOptions);
const mockedCopyPassword = vi.mocked(copyPassword);

function mockGeneratedPassword() {
  mockedGeneratePassword.mockReturnValue({
    password: 'Aa1!Aa1!Aa1!Aa1!Aa1!',
    entropy: 80,
    strength: 'strong',
  });
  mockedGeneratePassphrase.mockReturnValue({
    password: 'Alpha-bravo-charlie-delta-echo',
    entropy: 72,
    strength: 'strong',
  });
  mockedGeneratePronounceablePassword.mockReturnValue({
    password: 'pronounceable-password',
    entropy: 64,
    strength: 'strong',
  });
  mockedGetDefaultPassphraseOptions.mockReturnValue({
    wordCount: 5,
    separator: 'dash',
    capitalize: 'first',
    includeNumbers: true,
  });
}

describe('PasswordGeneratorPage AI strength explanation', () => {
  beforeEach(() => {
    mockedUseAiStrengthExplain.mockReset();
    mockedGeneratePassword.mockReset();
    mockedGeneratePassphrase.mockReset();
    mockedGeneratePronounceablePassword.mockReset();
    mockedGetDefaultPassphraseOptions.mockReset();
    mockedCopyPassword.mockReset();
    mockGeneratedPassword();
  });

  it('shows Explain with AI only when the hook enables the feature', async () => {
    mockedUseAiStrengthExplain.mockReturnValue({
      enabled: true,
      loading: false,
      insight: null,
      rawText: null,
      error: false,
      explain: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PasswordGeneratorPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /explain with ai/i })).toBeInTheDocument();
  });

  it('passes the current strength data to the AI explainer', async () => {
    const explain = vi.fn().mockResolvedValue(undefined);
    mockedUseAiStrengthExplain.mockReturnValue({
      enabled: true,
      loading: false,
      insight: null,
      rawText: null,
      error: false,
      explain,
      reset: vi.fn(),
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PasswordGeneratorPage />
      </MemoryRouter>
    );

    const button = await screen.findByRole('button', { name: /explain with ai/i });
    await user.click(button);

    await waitFor(() => {
      expect(explain).toHaveBeenCalledWith({ strength: 'strong', entropyBits: 80 });
    });
  });

  it('shows the loading copy and disables the AI button while thinking', async () => {
    mockedUseAiStrengthExplain.mockReturnValue({
      enabled: true,
      loading: true,
      insight: null,
      rawText: null,
      error: false,
      explain: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PasswordGeneratorPage />
      </MemoryRouter>
    );

    const button = await screen.findByRole('button', { name: /ai is thinking/i });
    expect(button).toBeDisabled();
  });

  it('shows the error copy when the AI explainer fails', async () => {
    mockedUseAiStrengthExplain.mockReturnValue({
      enabled: true,
      loading: false,
      insight: null,
      rawText: null,
      error: true,
      explain: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PasswordGeneratorPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/could not generate an explanation/i),
    ).toBeInTheDocument();
  });

  it('renders a typed insight when explanation succeeds', async () => {
    mockedUseAiStrengthExplain.mockReturnValue({
      enabled: true,
      loading: false,
      insight: { severity: 'low', factors: ['long'], rankedActions: ['use a passphrase'] },
      rawText: null,
      error: false,
      explain: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PasswordGeneratorPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/use a passphrase/i)).toBeInTheDocument();
  });

  it('hides the AI button when the hook disables the feature', () => {
    mockedUseAiStrengthExplain.mockReturnValue({
      enabled: false,
      loading: false,
      insight: null,
      rawText: null,
      error: false,
      explain: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PasswordGeneratorPage />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /explain with ai/i })).toBeNull();
  });
});
