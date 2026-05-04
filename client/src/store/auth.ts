import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  setAuth: (token: string | null, user: AuthUser | null) => void;
  logout: () => Promise<void>;
  initSession: () => Promise<void>;
}

function userFromSession(session: any): AuthUser | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata ?? {};
  return {
    id: session.user.id,
    fullName: meta.full_name ?? session.user.email?.split("@")[0] ?? "Investor",
    email: session.user.email ?? "",
    phone: meta.phone
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      loading: true,
      setAuth: (token, user) => set({ token, user, loading: false }),
      logout: async () => {
        try {
          await supabase.auth.signOut();
        } catch {
          // Sign out on client even if server call fails
        }
        set({ token: null, user: null, loading: false });
      },
      initSession: async () => {
        set({ loading: true });
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            set({
              token: session.access_token,
              user: userFromSession(session),
              loading: false
            });
          } else {
            set({ token: null, user: null, loading: false });
          }
        } catch {
          set({ token: null, user: null, loading: false });
        }
      }
    }),
    { name: "tracker-auth" }
  )
);

// Listen for auth state changes (token refresh, sign in/out from other tabs)
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    useAuthStore.getState().setAuth(session.access_token, userFromSession(session));
  } else {
    useAuthStore.getState().setAuth(null, null);
  }
});
