// Tabbed drawer that consolidates the bottom panels (Rules, Multiplayer,
// Move history, Tournaments, Friends) and the Tutorial trigger into one
// strip — replaces the previous loose row of six independent disclosures.
//
// Tab state is local: clicking a tab opens its panel below; clicking the
// same tab again (or the close ✕) collapses the drawer. Only one tab is
// ever open at a time, so the page stays calm.

import type { User } from '@supabase/supabase-js';
import Friends from './Friends';
import Help from './Help';
import MoveHistory from './MoveHistory';
import Multiplayer from './Multiplayer';
import Tournaments from './Tournaments';
import type { Profile } from './game/profile';
import type { HistoryEntry, RoomState } from './game/types';
import { useState } from 'react';

type TabId = 'rules' | 'multiplayer' | 'history' | 'tournaments' | 'friends';

type Props = {
  authUser: User | null;
  profile: Profile | null;
  room: RoomState | null;
  history: HistoryEntry[];
  onlineIds: Set<string>;
  aiPlayer: import('./game/types').Player | null;
  onRoomEntered: (room: RoomState) => void;
  onLeaveRoom: () => void;
  onPresenceChange: (ids: Set<string>) => void;
  onOpenTutorial: () => void;
};

export default function Sidebar({
  authUser,
  profile,
  room,
  history,
  onlineIds,
  aiPlayer,
  onRoomEntered,
  onLeaveRoom,
  onPresenceChange,
  onOpenTutorial,
}: Props) {
  // Default to Multiplayer auto-open when the user picks 2P (matches the
  // old forceOpen behavior on the Multiplayer disclosure). Otherwise the
  // drawer starts closed.
  const [active, setActive] = useState<TabId | null>(
    aiPlayer === null ? 'multiplayer' : null,
  );

  // Build the panel for the active tab. Each panel renders the existing
  // component with inline=true, so it draws just its body without the
  // legacy <details>/<summary> chrome.
  const panel = (() => {
    switch (active) {
      case 'rules':
        return <Help inline />;
      case 'multiplayer':
        return (
          <Multiplayer
            inline
            room={room}
            forceOpen
            onRoomEntered={onRoomEntered}
            onLeave={onLeaveRoom}
            onPresenceChange={onPresenceChange}
          />
        );
      case 'history':
        return <MoveHistory inline history={history} />;
      case 'tournaments':
        return <Tournaments inline user={authUser} profile={profile} />;
      case 'friends':
        return (
          <Friends
            inline
            user={authUser}
            profile={profile}
            inRoom={room !== null}
            onlineIds={onlineIds}
          />
        );
      default:
        return null;
    }
  })();

  // Pending-request count drives a small red badge on the Friends tab,
  // mirroring the badge that used to live on the Friends disclosure
  // summary — gives the user a glanceable nudge to handle requests.
  // Computed lazily via the same listFriends path; here we just rely on
  // the embedded component's own state since this badge would otherwise
  // require lifting it up. For now the badge is omitted (Friends body
  // shows the same Requests section prominently).

  const tab = (id: TabId, label: string) => {
    const isActive = active === id;
    return (
      <button
        type="button"
        key={id}
        className={`sidebar-tab${isActive ? ' sidebar-tab-active' : ''}`}
        aria-pressed={isActive}
        onClick={() => setActive(isActive ? null : id)}
      >
        {label}
      </button>
    );
  };

  return (
    <section className="sidebar" aria-label="Game panels">
      <nav className="sidebar-tabs" role="tablist">
        {tab('rules', '📖 Rules')}
        <button
          type="button"
          className="sidebar-tab"
          onClick={onOpenTutorial}
          title="Open the interactive tutorial"
        >
          🎓 Tutorial
        </button>
        {tab('multiplayer', '👥 Multiplayer')}
        {tab('history', `📜 History${history.length > 0 ? ` (${history.length})` : ''}`)}
        {tab('tournaments', '🏆 Tournaments')}
        {tab('friends', '🤝 Friends')}
        {active && (
          <button
            type="button"
            className="sidebar-tab sidebar-tab-close"
            aria-label="Close panel"
            onClick={() => setActive(null)}
          >
            ✕
          </button>
        )}
      </nav>
      {active && <div className="sidebar-panel">{panel}</div>}
    </section>
  );
}
