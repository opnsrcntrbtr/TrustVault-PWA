/**
 * Phase 7 — lock/unlock integration: profile state must clear on lock (the
 * vault key disappears, so profileStore can't keep showing decrypted names)
 * and reload correctly on the next unlock, reusing the same persisted
 * profile (not creating a duplicate "Personal" each time).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import { UserRepositoryImpl } from '@/data/repositories/UserRepositoryImpl';
import { useProfileStore } from '@/presentation/store/profileStore';
import { loadProfilesIntoStore } from '@/presentation/store/loadProfiles';

describe('Profile lifecycle across lock/unlock', () => {
  let userRepository: UserRepositoryImpl;

  beforeEach(async () => {
    await db.users.clear();
    await db.vaultProfiles.clear();
    await db.credentials.clear();
    useProfileStore.setState({ profiles: [], activeProfileId: null, isLoading: false, error: null });
    userRepository = new UserRepositoryImpl();
  });

  it('loads the default profile on login, clears on lock, and reloads the same profile on unlock', async () => {
    const username = 'profileuser';
    const password = 'SecurePassword123!';
    const user = await userRepository.createUser(username, password);

    const session = await userRepository.authenticateWithPassword(username, password);
    await loadProfilesIntoStore(session.vaultKey, user.id);

    const afterLogin = useProfileStore.getState();
    expect(afterLogin.profiles).toHaveLength(1);
    expect(afterLogin.profiles[0]?.name).toBe('Personal');
    const profileId = afterLogin.activeProfileId;
    expect(profileId).toBeTruthy();

    // Lock: app clears the in-memory profile list (mirrors App.tsx's effect).
    useProfileStore.getState().clearProfiles();
    expect(useProfileStore.getState().profiles).toHaveLength(0);
    expect(useProfileStore.getState().activeProfileId).toBeNull();

    // Unlock again: same profile reappears, no duplicate created.
    const session2 = await userRepository.authenticateWithPassword(username, password);
    await loadProfilesIntoStore(session2.vaultKey, user.id);

    const afterUnlock = useProfileStore.getState();
    expect(afterUnlock.profiles).toHaveLength(1);
    expect(afterUnlock.profiles[0]?.id).toBe(profileId);
    expect(afterUnlock.activeProfileId).toBe(profileId);
  });
});
