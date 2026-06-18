import { profileRepository } from '@/data/repositories/ProfileRepositoryImpl';
import { useProfileStore } from '@/presentation/store/profileStore';

/**
 * Loads the user's vault profiles into profileStore and selects the active
 * one (the default, or the first profile if none is marked default — should
 * not happen post-ensureDefaultProfile(), but a profile list is never empty
 * by the time this runs after login).
 */
export async function loadProfilesIntoStore(vaultKey: CryptoKey, userId: string): Promise<void> {
  const { setProfiles, setActiveProfile, setError, setLoading } = useProfileStore.getState();
  setLoading(true);
  try {
    const profiles = await profileRepository.findAll(vaultKey, userId);
    setProfiles(profiles);
    const active = profiles.find((p) => p.isDefault) ?? profiles[0];
    if (active) setActiveProfile(active.id);
    setError(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load profiles');
  } finally {
    setLoading(false);
  }
}
