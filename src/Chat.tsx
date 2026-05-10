// Per-room multiplayer chat. Messages live in App state and are
// transported via broadcast on the existing room:${code} channel —
// no new schema, no persistence. A refresh wipes the log; for MVP
// that's fine.

import { useEffect, useRef, useState } from 'react';
import type { Player } from './game/types';

export type ChatMessage = {
  id: string;
  from: Player;
  nickname: string;
  text: string;
  // Wall-clock timestamp from the sender; used for ordering and the
  // "X min ago" relative time display.
  ts: number;
};

const MAX_LEN = 240;

type Props = {
  messages: ChatMessage[];
  // Local user's role in the current room — used to right-align their
  // own messages and skip the nickname prefix.
  myRole: Player | null;
  // Sender. Returns false synchronously if the message can't be sent
  // (e.g., not in a room) so the input can stay full of pending text.
  onSend: (text: string) => boolean;
  // True when the parent has an active room channel; `false` makes
  // the input read-only with a "join a room" hint.
  active: boolean;
};

export default function Chat({ messages, myRole, onSend, active }: Props) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages so the latest is always visible.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const trimmed = draft.trim().slice(0, MAX_LEN);
    if (!trimmed) return;
    if (!onSend(trimmed)) return;
    setDraft('');
  };

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <p className="lobby-hint">
            {active
              ? 'No messages yet — say hello.'
              : 'Join a multiplayer room to chat with your opponent.'}
          </p>
        ) : (
          messages.map((m) => {
            const isMine = myRole !== null && m.from === myRole;
            return (
              <div
                key={m.id}
                className={`chat-msg chat-msg-${m.from}${isMine ? ' chat-msg-mine' : ''}`}
              >
                {!isMine && <span className="chat-msg-name">{m.nickname}</span>}
                <span className="chat-msg-body">{m.text}</span>
              </div>
            );
          })
        )}
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          placeholder={active ? 'Message your opponent…' : 'Not in a room'}
          value={draft}
          maxLength={MAX_LEN}
          disabled={!active}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="hud-btn"
          disabled={!active || !draft.trim()}
          onClick={submit}
        >
          Send
        </button>
      </div>
    </div>
  );
}
