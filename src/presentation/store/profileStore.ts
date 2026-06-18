import { create } from 'zustand';
import type { VaultProfile } from '@/domain/entities/VaultProfile';

interface ProfileState {
  profiles: VaultProfile[];
  activeProfileId: string | null;
  isLoading: boolean;
  error: string | null;
  setProfiles: (profiles: VaultProfile[]) => void;
  addProfile: (profile: VaultProfile) => void;
  updateProfile: (profile: VaultProfile) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearProfiles: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: [],
  activeProfileId: null,
  isLoading: false,
  error: null,
  setProfiles: (profiles) => { set({ profiles }); },
  addProfile: (profile) => { set((state) => ({ profiles: [...state.profiles, profile] })); },
  updateProfile: (profile) => {
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === profile.id ? profile : p)),
    }));
  },
  removeProfile: (id) => {
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
      activeProfileId: state.activeProfileId === id ? null : state.activeProfileId,
    }));
  },
  setActiveProfile: (id) => { set({ activeProfileId: id }); },
  setLoading: (isLoading) => { set({ isLoading }); },
  setError: (error) => { set({ error }); },
  clearProfiles: () => {
    set({ profiles: [], activeProfileId: null, isLoading: false, error: null });
  },
}));
