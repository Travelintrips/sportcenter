import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { sendWelcomeEmail } from "../lib/email";

interface Profile {
  id: string;
  role_id: string;
  full_name: string;
  role?: {
    id: string;
    name: string;
  };
  phone_number?: string;
  email?: string;
}

interface AuthState {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  setProfile: (profile: Profile) => void;
  signIn: (email: string, password: string) => Promise<string | void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,

  setProfile: (profile: Profile) => set({ profile }),

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        role_id,
        full_name,
        phone_number,
        email,
        role:roles (
          id,
          name
        )
      `,
      )
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile) throw new Error("No profile found");
    set({ user, profile, loading: false });

    set({ user, profile });

    if (profile.role?.name === "staff") return "/";
    else if (
      profile.role?.name === "admin" ||
      profile.role?.name === "super_admin"
    )
      return "/dashboard";
    else return "/";
  },

  signUp: async (email: string, password: string, fullName: string) => {
    try {
      const {
        data: { user },
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: "http://localhost:3000/verified", // Ganti sesuai kebutuhan
        },
      });

      if (signUpError) throw signUpError;
      if (!user) throw new Error("No user returned after signup");

      const { data: roleData, error: roleError } = await supabase
        .from("roles")
        .select("id")
        .eq("name", "user")
        .single();

      if (roleError) throw roleError;
      if (!roleData) throw new Error("Default role not found");

      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        role_id: roleData.id,
        full_name: fullName,
        email: email,
      });

      if (profileError) throw profileError;

      await sendWelcomeEmail({
        to: email,
        fullName: fullName,
      });
    } catch (error) {
      console.error("Error during signup:", error);
      throw error;
    }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null, profile: null });
  },

  loadProfile: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        role_id,
        full_name,
        phone_number,
        email,
        role:roles (
          id,
          name
        )
      `,
      )
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile) throw new Error("No profile found");

    set({ user, profile });
  },
}));

// Initialize auth state
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    useAuthStore.getState().loadProfile();
  } else {
    useAuthStore.setState({ user: null, profile: null, loading: false });
  }
});
