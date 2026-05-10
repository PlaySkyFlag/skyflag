// Tabbed drawer that consolidates the bottom panels (Rules, Multiplayer,
// Move history, Tournaments, Friends) and the Tutorial trigger into one
// strip — replaces the previous loose row of six independent disclosures.
//
// Tab state is local: clicking a tab opens its panel below; clicking the
// same tab again (or the close ✕) collapses the drawer. Only one tab is
// ever open at a time, so the page stays calm.

import type { User } from '@supabase/supabase-js';
import Chat, { type ChatMessage } from './Chat';
import Friends from './Friends';
import Help from './Help';
import MoveHistory from './MoveHistory';
import Multiplayer from './Multiplayer';
import Tournaments from './Tournaments';
import { listFriends } from './game/friends';
import type { Profile } from './game/profile';
import type { HistoryEntry, RoomState } from './game/types';
import { useEffect, useState } from 'react';

type TabId = 'rules' | 'multiplayer' | 'history' | 'tournaments' | 'friends' | 'chat';

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
  onOpenDaily: () => void;
  // Opens the AccountModal from inside child panels — currently used
  // by the Tournaments "Verify email to join" CTA so unverified guests
  // have a one-click path to linking an email.
  onOpenAccount: () => void;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => boolean;
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
  onOpenDaily,
  onOpenAccount,
  chatMessages,
  onSendChat,
}: Props) {
  // Default to Multiplayer auto-open when the user picks 2P (matches the
  // old forceOpen behavior on the Multiplayer disclosure). Otherwise the
  // drawer starts closed.
  const [active, setActive] = useState<TabId | null>(
    aiPlayer === null ? 'multiplayer' : null,
  );

  // Count of pending incoming friend requests — drives a small red
  // badge on the Friends tab so the user notices new requests without
  // opening the tab. Refreshed on sign-in and whenever the Friends
  // tab closes (after the user has presumably accepted/declined).
  const [pendingCount, setPendingCount] = useState(0);
  const refreshKey = active === 'friends' ? 'open' : 'closed';
  useEffect(() => {
    if (!authUser) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const list = await listFriends(authUser.id);
      if (cancelled) return;
      setPendingCount(list.filter((f) => f.direction === 'pending-in').length);
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser, refreshKey]);

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
        return <Tournaments inline user={authUser} profile={profile} onOpenAccount={onOpenAccount} />;
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
      case 'chat':
        return (
          <Chat
            messages={chatMessages}
            myRole={room?.role ?? null}
            onSend={onSendChat}
            active={room !== null}
          />
        );
      default:
        return null;
    }
  })();

  const tab = (id: TabId, label: string, badge?: number) => {
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
        {badge !== undefined && badge > 0 && (
          <span className="sidebar-tab-badge" aria-label={`${badge} pending`}>
            {badge}
          </span>
        )}
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
        <button
          type="button"
          className="sidebar-tab"
          onClick={onOpenDaily}
          title="Today's puzzle — find the best move"
        >
          🧩 Daily
        </button>
        {tab('multiplayer', '👥 Multiplayer')}
        {tab('history', `📜 History${history.length > 0 ? ` (${history.length})` : ''}`)}
        {tab('tournaments', '🏆 Tournaments')}
        {tab('friends', '🤝 Friends', pendingCount)}
        {tab('chat', '💬 Chat')}
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
