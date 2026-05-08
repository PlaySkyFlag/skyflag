// Profile DB layer. Mirrors the public.profiles table shape from
// supabase/migrations/001_profiles.sql.

import { supabase } from './supabase';

export type Gender = 'female' | 'male' | 'non-binary' | 'other' | 'prefer-not-to-say';

export type Profile = {
  id: string;
  nickname: string;
  full_name: string | null;
  age: number | null;
  gender: Gender | null;
  rating: number;
  games_played: number;
  created_at: string;
  updated_at: string;
};

export type ProfileInput = {
  nickname: string;
  full_name?: string | null;
  age?: number | null;
  gender?: Gender | null;
};

// Loads the profile row for a given user id. Returns null if no row exists
// yet (a freshly signed-in user before they've completed the profile form)
// or if Supabase is unavailable.
export async function loadProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[profile] load failed', error);
    return null;
  }
  return (data as Profile | null) ?? null;
}

// Creates or updates the profile row for `userId`. Uses upsert so the
// first-save flow (no row yet) and edits (row exists) both work.
export async function saveProfile(
  userId: string,
  input: ProfileInput,
): Promise<{ ok: true; profile: Profile } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const row = {
    id: userId,
    nickname: input.nickname.trim(),
    full_name: input.full_name?.trim() || null,
    age: input.age ?? null,
    gender: input.gender ?? null,
  };
  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, profile: data as Profile };
}
