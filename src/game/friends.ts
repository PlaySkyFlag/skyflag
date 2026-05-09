// Friends DB layer. Mirrors the public.friendships table from
// supabase/migrations/006_friendships.sql.
//
// Friendships are symmetric — there's only one row per pair, with the two
// user ids in canonical order (smaller first as `user_a_id`). This module
// hides that detail from callers: `sendRequest(me, them)` figures out which
// id goes where, `listFriends(me)` returns rows from the perspective of
// `me` so callers don't have to flip them themselves.

import type { Profile } from './profile';
import { supabase } from './supabase';

export type FriendshipStatus = 'pending' | 'accepted';

// Direction of the relationship from the perspective of the calling user.
//   accepted        — confirmed friend, either side initiated
//   pending-out     — we sent a request, waiting on them
//   pending-in      — they sent a request, waiting on us to accept
export type FriendDirection = 'accepted' | 'pending-out' | 'pending-in';

export type FriendEntry = {
  // The OTHER user (the friend or pending peer), never the caller.
  other_id: string;
  other_nickname: string;
  other_rating: number;
  direction: FriendDirection;
  created_at: string;
};

type FriendshipRow = {
  user_a_id: string;
  user_b_id: string;
  initiator_id: string;
  status: FriendshipStatus;
  created_at: string;
};

type Result = { ok: true } | { ok: false; message: string };

// Sort the two ids so they match the table's canonical (a < b) constraint.
function canonical(idA: string, idB: string): { a: string; b: string } {
  return idA < idB ? { a: idA, b: idB } : { a: idB, b: idA };
}

// Look up a profile by nickname (case-insensitive). Used by the "add a
// friend by nickname" form so callers don't have to know the user id.
export async function findProfileByNickname(
  nickname: string,
): Promise<Profile | null> {
  if (!supabase) return null;
  const trimmed = nickname.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('nickname', trimmed)
    .maybeSingle();
  if (error) {
    console.error('[friends] nickname lookup failed', error);
    return null;
  }
  return (data as Profile | null) ?? null;
}

// Send a friend request from `meId` to `themId`. Inserts a pending row in
// canonical order with `initiator_id = meId`. Surfaces a friendly error if
// the row already exists (duplicate primary key).
export async function sendRequest(meId: string, themId: string): Promise<Result> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  if (meId === themId) return { ok: false, message: "You can't friend yourself." };
  const { a, b } = canonical(meId, themId);
  const { error } = await supabase.from('friendships').insert({
    user_a_id: a,
    user_b_id: b,
    initiator_id: meId,
    status: 'pending',
  });
  if (error) {
    // 23505 = unique_violation — the pair already has a row.
    if (error.code === '23505') {
      return { ok: false, message: 'Already friends or request pending.' };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

// The recipient of a pending request flips it to accepted. RLS on the
// table enforces that only the non-initiator can run this update.
export async function acceptRequest(meId: string, themId: string): Promise<Result> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { a, b } = canonical(meId, themId);
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('user_a_id', a)
    .eq('user_b_id', b);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Used for both "decline pending request" and "unfriend an existing
// friend" — RLS allows either side to delete the row in either state.
export async function removeFriendship(meId: string, themId: string): Promise<Result> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { a, b } = canonical(meId, themId);
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_a_id', a)
    .eq('user_b_id', b);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Returns every friendship row touching `meId`, enriched with the OTHER
// user's profile. Two queries: one for the friendship rows, then one to
// pull profiles for all the peers in a single `in()` call.
export async function listFriends(meId: string): Promise<FriendEntry[]> {
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_a_id.eq.${meId},user_b_id.eq.${meId}`)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[friends] list failed', error);
    return [];
  }
  const friendships = (rows ?? []) as FriendshipRow[];
  if (friendships.length === 0) return [];

  const otherIds = friendships.map((r) => (r.user_a_id === meId ? r.user_b_id : r.user_a_id));
  const { data: profileRows, error: profErr } = await supabase
    .from('profiles')
    .select('id, nickname, rating')
    .in('id', otherIds);
  if (profErr) {
    console.error('[friends] profiles lookup failed', profErr);
    return [];
  }
  const byId = new Map<string, { nickname: string; rating: number }>();
  for (const p of (profileRows ?? []) as { id: string; nickname: string; rating: number }[]) {
    byId.set(p.id, { nickname: p.nickname, rating: p.rating });
  }

  return friendships.map((r) => {
    const otherId = r.user_a_id === meId ? r.user_b_id : r.user_a_id;
    const prof = byId.get(otherId);
    let direction: FriendDirection;
    if (r.status === 'accepted') {
      direction = 'accepted';
    } else if (r.initiator_id === meId) {
      direction = 'pending-out';
    } else {
      direction = 'pending-in';
    }
    return {
      other_id: otherId,
      other_nickname: prof?.nickname ?? otherId.slice(0, 8),
      other_rating: prof?.rating ?? 1200,
      direction,
      created_at: r.created_at,
    };
  });
}
