import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/data/storage/database';
import { profileRepository } from '@/data/repositories/ProfileRepositoryImpl';
import { useProfileStore } from '@/presentation/store/profileStore';
import { loadProfilesIntoStore } from '@/presentation/store/loadProfiles';

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

describe('loadProfilesIntoStore', () => {
  let key: CryptoKey;
  const userId = 'user-1';

  beforeEach(async () => {
    await db.vaultProfiles.clear();
    useProfileStore.setState({ profiles: [], activeProfileId: null, isLoading: false, error: null });
    key = await makeKey();
  });

  it('loads the user\'s profiles and selects the default as active', async () => {
    await profileRepository.create({ name: 'Personal', type: 'personal', isDefault: true }, key, userId);
    await profileRepository.create({ name: 'Work', type: 'work' }, key, userId);

    await loadProfilesIntoStore(key, userId);

    const state = useProfileStore.getState();
    expect(state.profiles).toHaveLength(2);
    const def = state.profiles.find((p) => p.isDefault);
    expect(state.activeProfileId).toBe(def?.id);
  });

  it('falls back to the first profile if none is marked default', async () => {
    const p = await profileRepository.create({ name: 'Work', type: 'work' }, key, userId);
    await db.vaultProfiles.update(p.id, { isDefault: false });

    await loadProfilesIntoStore(key, userId);

    expect(useProfileStore.getState().activeProfileId).toBe(p.id);
  });

  it('sets an error on failure', async () => {
    const spy = vi
      .spyOn(profileRepository, 'findAll')
      .mockRejectedValueOnce(new Error('db unavailable'));

    await loadProfilesIntoStore(key, userId);

    expect(useProfileStore.getState().error).toBe('db unavailable');
    spy.mockRestore();
  });
});
