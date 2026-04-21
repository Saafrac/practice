import { create } from "zustand";

import * as authApi from "../api/authApi";
import { clearToken, getStoredToken, saveToken } from "../lib/tokenStorage";
import { AuthUser, LoginPayload, RegisterPayload, UserRole } from "../types/auth";

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  role: UserRole | null;
  token: string | null;
  error: string | null;
  initialize: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isLoading: true,
  isAuthenticated: false,
  user: null,
  role: null,
  token: null,
  error: null,
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await getStoredToken();
      if (!token) {
        set({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          role: null,
          token: null,
        });
        return;
      }

      const user = await authApi.me(token);
      set({
        isLoading: false,
        isAuthenticated: true,
        user,
        role: user.role,
        token,
      });
    } catch {
      await clearToken();
      set({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        role: null,
        token: null,
      });
    }
  },
  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(payload);
      await saveToken(response.access_token);
      set({
        isLoading: false,
        isAuthenticated: true,
        user: response.user,
        role: response.user.role,
        token: response.access_token,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Login failed.",
      });
    }
  },
  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.register(payload);
      await saveToken(response.access_token);
      set({
        isLoading: false,
        isAuthenticated: true,
        user: response.user,
        role: response.user.role,
        token: response.access_token,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Registration failed.",
      });
    }
  },
  logout: async () => {
    await clearToken();
    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      role: null,
      token: null,
      error: null,
    });
  },
  clearError: () => set({ error: null }),
}));
