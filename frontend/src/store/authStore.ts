import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { User, authApi } from "@/lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  setHydrated: (hydrated: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    department_id?: string;
    designation?: string;
    specialization?: string;
  }) => Promise<void>;
  logout: () => void;
  verifyToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,
      isHydrated: false,

      setUser: (user: User | null) => set({ user }),
      
      setHydrated: (hydrated: boolean) => set({ isHydrated: hydrated }),

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login(email, password);
          if (response.success && response.data) {
            const { user, token } = response.data;
            localStorage.setItem("token", token);
            set({ user, token, isAuthenticated: true, isLoading: false });
          } else {
            throw new Error(response.error || "Login failed");
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const response = await authApi.register(data);
          if (response.success && response.data) {
            const { user, token } = response.data;
            localStorage.setItem("token", token);
            set({ user, token, isAuthenticated: true, isLoading: false });
          } else {
            throw new Error(response.error || "Registration failed");
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem("token");
        set({ user: null, token: null, isAuthenticated: false });
      },

      verifyToken: async () => {
        const token = localStorage.getItem("token");
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null, isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await authApi.verify();
          if (response.success && response.data) {
            set({
              user: response.data.user,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            localStorage.removeItem("token");
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          }
        } catch {
          localStorage.removeItem("token");
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
