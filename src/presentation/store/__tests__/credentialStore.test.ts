/**
 * Credential Store Tests
 * Tests the REAL Zustand store module (unlike authStore.test.ts, which
 * validates a local mock). Security focus: clearCredentials() must purge
 * all decrypted data from memory on lock/logout (Use Case 1).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCredentialStore } from '@/presentation/store/credentialStore';
import type { Credential } from '@/domain/entities/Credential';

function makeCredential(overrides: Partial<Credential> = {}): Credential {
  return {
    id: crypto.randomUUID(),
    title: 'Test Site',
    username: 'user@example.com',
    password: 'PlaintextInMemoryOnly1!',
    category: 'login',
    tags: [],
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('credentialStore (real module)', () => {
  beforeEach(() => {
    // Reset to a clean state between tests (Zustand stores are singletons)
    useCredentialStore.setState({
      credentials: [],
      selectedCredential: null,
      isLoading: false,
      error: null,
      searchQuery: '',
      filterCategory: null,
    });
  });

  describe('initial state', () => {
    it('starts empty with no selection, loading, or error', () => {
      const state = useCredentialStore.getState();
      expect(state.credentials).toEqual([]);
      expect(state.selectedCredential).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.searchQuery).toBe('');
      expect(state.filterCategory).toBeNull();
    });
  });

  describe('setCredentials()', () => {
    it('replaces the credential list', () => {
      const creds = [makeCredential(), makeCredential()];
      useCredentialStore.getState().setCredentials(creds);
      expect(useCredentialStore.getState().credentials).toEqual(creds);
    });
  });

  describe('addCredential()', () => {
    it('prepends the new credential (most recent first)', () => {
      const first = makeCredential({ title: 'First' });
      const second = makeCredential({ title: 'Second' });

      useCredentialStore.getState().addCredential(first);
      useCredentialStore.getState().addCredential(second);

      const { credentials } = useCredentialStore.getState();
      expect(credentials).toHaveLength(2);
      expect(credentials[0]?.title).toBe('Second');
      expect(credentials[1]?.title).toBe('First');
    });
  });

  describe('updateCredential()', () => {
    it('replaces only the matching credential', () => {
      const a = makeCredential({ title: 'A' });
      const b = makeCredential({ title: 'B' });
      useCredentialStore.getState().setCredentials([a, b]);

      const updatedA: Credential = { ...a, title: 'A-updated' };
      useCredentialStore.getState().updateCredential(a.id, updatedA);

      const { credentials } = useCredentialStore.getState();
      expect(credentials.find((c) => c.id === a.id)?.title).toBe('A-updated');
      expect(credentials.find((c) => c.id === b.id)?.title).toBe('B');
    });

    it('is a no-op for an unknown id', () => {
      const a = makeCredential();
      useCredentialStore.getState().setCredentials([a]);

      useCredentialStore
        .getState()
        .updateCredential('does-not-exist', makeCredential({ title: 'Ghost' }));

      const { credentials } = useCredentialStore.getState();
      expect(credentials).toHaveLength(1);
      expect(credentials[0]?.id).toBe(a.id);
    });
  });

  describe('removeCredential()', () => {
    it('removes only the matching credential', () => {
      const a = makeCredential();
      const b = makeCredential();
      useCredentialStore.getState().setCredentials([a, b]);

      useCredentialStore.getState().removeCredential(a.id);

      const { credentials } = useCredentialStore.getState();
      expect(credentials).toHaveLength(1);
      expect(credentials[0]?.id).toBe(b.id);
    });
  });

  describe('selectCredential()', () => {
    it('sets and clears the selection', () => {
      const cred = makeCredential();
      useCredentialStore.getState().selectCredential(cred);
      expect(useCredentialStore.getState().selectedCredential).toEqual(cred);

      useCredentialStore.getState().selectCredential(null);
      expect(useCredentialStore.getState().selectedCredential).toBeNull();
    });
  });

  describe('UI state setters', () => {
    it('setLoading / setError / setSearchQuery / setFilterCategory update state', () => {
      const store = useCredentialStore.getState();
      store.setLoading(true);
      store.setError('boom');
      store.setSearchQuery('gmail');
      store.setFilterCategory('login');

      const state = useCredentialStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.error).toBe('boom');
      expect(state.searchQuery).toBe('gmail');
      expect(state.filterCategory).toBe('login');

      useCredentialStore.getState().setError(null);
      useCredentialStore.getState().setFilterCategory(null);
      expect(useCredentialStore.getState().error).toBeNull();
      expect(useCredentialStore.getState().filterCategory).toBeNull();
    });
  });

  describe('clearCredentials() — lock/logout security invariant', () => {
    it('purges all decrypted credentials AND the selected credential', () => {
      const a = makeCredential();
      const b = makeCredential();
      useCredentialStore.getState().setCredentials([a, b]);
      useCredentialStore.getState().selectCredential(a);

      useCredentialStore.getState().clearCredentials();

      const state = useCredentialStore.getState();
      expect(state.credentials).toEqual([]);
      expect(state.selectedCredential).toBeNull();
    });

    it('leaves no plaintext password reachable from store state after clear', () => {
      const cred = makeCredential({ password: 'SuperSecret!' });
      useCredentialStore.getState().setCredentials([cred]);
      useCredentialStore.getState().selectCredential(cred);

      useCredentialStore.getState().clearCredentials();

      const snapshot = JSON.stringify({
        credentials: useCredentialStore.getState().credentials,
        selectedCredential: useCredentialStore.getState().selectedCredential,
      });
      expect(snapshot).not.toContain('SuperSecret!');
    });
  });
});
