import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  initSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: async () => {
        await supabase.auth.signOut();
        set({ token: null, user: null });
      },
      initSession: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const meta = session.user.user_metadata ?? {};
          set({
            token: session.access_token,
            user: {
              id: session.user.id,
              fullName: meta.full_name ?? session.user.email?.split("@")[0] ?? "Investor",
              email: session.user.email ?? "",
              phone: meta.phone
            }
          });
        }
      }
    }),
    { name: "tracker-auth" }
  )
);

// Listen for auth state changes
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    const meta = session.user.user_metadata ?? {};
    useAuthStore.getState().setAuth(session.access_token, {
      id: session.user.id,
      fullName: meta.full_name ?? session.user.email?.split("@")[0] ?? "Investor",
      email: session.user.email ?? "",
      phone: meta.phone
    });
  } else {
    useAuthStore.getState().setAuth(null as any, null as any);
  }
});
