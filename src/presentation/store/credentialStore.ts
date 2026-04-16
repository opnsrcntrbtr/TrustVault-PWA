/**
 * Credentials Store (Zustand)
 * Manages credential state and operations
 */

import { create } from 'zustand';
import type { Credential } from '@/domain/entities/Credential';

interface CredentialState {
  // State
  credentials: Credential[];
  selectedCredential: Credential | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filterCategory: string | null;

  // Actions
  setCredentials: (credentials: Credential[]) => void;
  addCredential: (credential: Credential) => void;
  updateCredential: (id: string, credential: Credential) => void;
  removeCredential: (id: string) => void;
  selectCredential: (credential: Credential | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilterCategory: (category: string | null) => void;
  clearCredentials: () => void;
}

export const useCredentialStore = create<CredentialState>((set) => ({
  // Initial state
  credentials: [],
  selectedCredential: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  filterCategory: null,

  // Actions
  setCredentials: (credentials) => {
    set({ credentials });
  },

  addCredential: (credential) => {
    set((state) => ({
      credentials: [credential, ...state.credentials],
    }));
  },

  updateCredential: (id, credential) => {
    set((state) => ({
      credentials: state.credentials.map((c) => (c.id === id ? credential : c)),
    }));
  },

  removeCredential: (id) => {
    set((state) => ({
      credentials: state.credentials.filter((c) => c.id !== id),
    }));
  },

  selectCredential: (credential) => {
    set({ selectedCredential: credential });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setFilterCategory: (category) => {
    set({ filterCategory: category });
  },

  clearCredentials: () => {
    set({ credentials: [], selectedCredential: null });
  },
}));
