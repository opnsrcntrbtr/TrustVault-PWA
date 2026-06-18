import { describe, it, expect, beforeEach } from 'vitest';
import { useProfileStore } from '@/presentation/store/profileStore';
import type { VaultProfile } from '@/domain/entities/VaultProfile';

const makeProfile = (overrides: Partial<VaultProfile> = {}): VaultProfile => ({
  id: 'p1',
  name: 'Personal',
  type: 'personal',
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.setState({
      profiles: [],
      activeProfileId: null,
      isLoading: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useProfileStore.getState();
    expect(state.profiles).toEqual([]);
    expect(state.activeProfileId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setProfiles replaces the profile list', () => {
    const profiles = [makeProfile()];
    useProfileStore.getState().setProfiles(profiles);
    expect(useProfileStore.getState().profiles).toEqual(profiles);
  });

  it('setActiveProfile sets the active profile id', () => {
    useProfileStore.getState().setActiveProfile('p1');
    expect(useProfileStore.getState().activeProfileId).toBe('p1');
  });

  it('addProfile appends to the list', () => {
    useProfileStore.getState().setProfiles([makeProfile()]);
    useProfileStore.getState().addProfile(makeProfile({ id: 'p2', name: 'Work', isDefault: false }));
    expect(useProfileStore.getState().profiles).toHaveLength(2);
  });

  it('updateProfile patches a profile by id', () => {
    useProfileStore.getState().setProfiles([makeProfile()]);
    useProfileStore.getState().updateProfile(makeProfile({ name: 'Renamed' }));
    expect(useProfileStore.getState().profiles[0]?.name).toBe('Renamed');
  });

  it('removeProfile removes by id and clears activeProfileId if it matches', () => {
    useProfileStore.getState().setProfiles([makeProfile()]);
    useProfileStore.getState().setActiveProfile('p1');
    useProfileStore.getState().removeProfile('p1');
    expect(useProfileStore.getState().profiles).toHaveLength(0);
    expect(useProfileStore.getState().activeProfileId).toBeNull();
  });

  it('setLoading and setError update state', () => {
    useProfileStore.getState().setLoading(true);
    expect(useProfileStore.getState().isLoading).toBe(true);
    useProfileStore.getState().setError('boom');
    expect(useProfileStore.getState().error).toBe('boom');
  });

  it('clearProfiles resets to initial state', () => {
    useProfileStore.getState().setProfiles([makeProfile()]);
    useProfileStore.getState().setActiveProfile('p1');
    useProfileStore.getState().clearProfiles();
    expect(useProfileStore.getState().profiles).toEqual([]);
    expect(useProfileStore.getState().activeProfileId).toBeNull();
  });
});
