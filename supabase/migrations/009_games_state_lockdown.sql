-- Games-state lockdown trigger — prevents the most obvious cheat vector
-- in our multiplayer architecture.
--
-- Background: RLS policy 007 lets either participant UPDATE the games row
-- (necessary for move sync). The reducer enforces game rules client-side,
-- but a malicious player can bypass the client entirely and write any
-- state JSON they want via the Supabase client. Since apply-rating reads
-- games.state as authoritative, a losing player could:
--   1. Write state.status = {kind: 'won', winner: <self>} after the
--      legitimate game has ended in their loss
--   2. Call apply-rating, which trusts the now-tampered state
--   3. Get a rating boost they didn't earn
--
-- This trigger blocks the post-game tampering case: once a game reaches
-- a terminal status (won or draw), the only allowed transitions are:
--   - identical status (no-op, e.g. realtime re-sync of the same state)
--   - back to in-progress (legitimate "play again" flow that resets the
--     game while staying in the same room)
-- Any other change to a terminal status — flipping the winner, swapping
-- won↔draw, etc. — raises an exception that aborts the UPDATE.
--
-- What this DOESN'T block: a player writing a fabricated terminal status
-- mid-game (in-progress → won/<self>) where the actual play wasn't
-- finished. Detecting that requires re-running the full game-rules
-- engine in SQL on every update, which isn't worth the complexity for
-- a hobby game. The opponent's client will see the divergence on the
-- next sync; combined with the rating idempotency in apply-rating
-- (game_results PK), the worst-case impact is one tampered rating per
-- game-room before the room is abandoned.

create or replace function public.games_state_lockdown()
returns trigger language plpgsql as $$
declare
  old_kind   text;
  new_kind   text;
  old_winner text;
  new_winner text;
begin
  old_kind := old.state -> 'status' ->> 'kind';
  new_kind := new.state -> 'status' ->> 'kind';

  -- Only enforce when the previous state was already terminal. Active
  -- games (in-progress) accept any update — that's how moves work.
  if old_kind in ('won', 'draw') then
    -- Resetting to a fresh in-progress game is allowed (play-again flow).
    if new_kind = 'in-progress' then
      return new;
    end if;

    -- Otherwise the kind itself must match — no won↔draw flips.
    if old_kind is distinct from new_kind then
      raise exception
        'games_state_lockdown: cannot change finalized game kind from % to %', old_kind, new_kind
        using errcode = '42501';
    end if;

    -- For 'won' specifically, the winner must also match.
    if old_kind = 'won' then
      old_winner := old.state -> 'status' ->> 'winner';
      new_winner := new.state -> 'status' ->> 'winner';
      if old_winner is distinct from new_winner then
        raise exception
          'games_state_lockdown: cannot change winner of a finalized game from % to %', old_winner, new_winner
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists games_state_lockdown on public.games;
create trigger games_state_lockdown
  before update on public.games
  for each row execute function public.games_state_lockdown();
