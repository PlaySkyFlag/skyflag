import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

// Single client instance, shared across the app. Null when env vars are
// missing — callers should treat that as "multiplayer unavailable" and
// disable the relevant UI rather than crashing.
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

export const isMultiplayerAvailable = supabase !== null;

// Database row shapes — keep these in sync with the SQL schema applied in the
// Supabase dashboard. The `state` column holds the full GameState as JSON.
export type GameRow = {
  id: string;
  room_code: string;
  state: unknown; // GameState — kept as unknown here to avoid circular imports
  p1_id: string;
  p2_id: string | null;
  created_at: string;
  updated_at: string;
};
