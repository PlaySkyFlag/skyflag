// Settings popover — a single gear-icon disclosure that holds the
// app-level pickers (Players mode, AI difficulty, visual theme, sound).
// Pulled out of the StatusBar so the in-game HUD stays focused on
// state + game-context actions.

import { useEffect, useRef, useState } from 'react';
import { CLOCK_OPTIONS, type ClockOptionId } from './game/constants';
import { isMuted, setMuted } from './game/sound';
import type { Difficulty } from './game/storage';
import type { ThemeId } from './game/themes';
import { THEMES } from './game/themes';
import type { Player } from './game/types';

type Mode = Player | null;

const SELECT_TO_MODE: Record<string, Mode> = {
  p2: 'p2',
  p1: 'p1',
  none: null,
};

type Props = {
  aiPlayer: Player | null;
  onSetMode: (mode: Mode) => void;
  difficulty: Difficulty;
  onSetDifficulty: (d: Difficulty) => void;
  themeId: ThemeId;
  onSetTheme: (id: ThemeId) => void;
  clockOption: ClockOptionId;
  onSetClockOption: (id: ClockOptionId) => void;
  showThreats: boolean;
  onSetShowThreats: (v: boolean) => void;
  // True while the user is in a multiplayer room — locks the
  // Players + AI difficulty pickers so AI can't be re-introduced
  // into a 2-human game by accident.
  inMpRoom: boolean;
};

export default function SettingsMenu({
  aiPlayer,
  onSetMode,
  difficulty,
  onSetDifficulty,
  themeId,
  onSetTheme,
  clockOption,
  onSetClockOption,
  showThreats,
  onSetShowThreats,
  inMpRoom,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mutedNow, setMutedNow] = useState(isMuted());
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close the popover when the user clicks outside or presses Escape.
  // Without this, the menu lingers behind anything they go to do next.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="settings-menu" ref={wrapperRef}>
      <button
        type="button"
        className="hud-btn hud-btn-subtle settings-trigger"
        aria-label="Settings"
        title="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-popover" role="menu">
          <label className="settings-row">
            <span className="settings-label">Players</span>
            <select
              className="hud-mode-select"
              value={inMpRoom ? 'mp' : (aiPlayer ?? 'none')}
              onChange={(e) => onSetMode(SELECT_TO_MODE[e.target.value])}
              disabled={inMpRoom}
              title={inMpRoom ? 'Online multiplayer — leave the room to change mode' : ''}
            >
              <option value="p2">1P · Ravens (you)</option>
              <option value="p1">1P · Stags (you)</option>
              <option value="none">2P hot-seat</option>
              {inMpRoom && (
                <option value="mp">Online — vs. opponent</option>
              )}
            </select>
          </label>
          <label className="settings-row">
            <span className="settings-label">AI difficulty</span>
            <select
              className="hud-mode-select"
              value={difficulty}
              onChange={(e) => onSetDifficulty(e.target.value as Difficulty)}
              disabled={inMpRoom || aiPlayer === null}
              title={
                inMpRoom
                  ? 'No AI in multiplayer'
                  : aiPlayer === null
                    ? 'Only used in 1-player modes'
                    : ''
              }
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label className="settings-row">
            <span className="settings-label">Clock</span>
            <select
              className="hud-mode-select"
              value={clockOption}
              onChange={(e) => onSetClockOption(e.target.value as ClockOptionId)}
              title="Time control — applied to the next new game"
            >
              {CLOCK_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <span className="settings-label">Theme</span>
            <select
              className="hud-mode-select"
              value={themeId}
              onChange={(e) => onSetTheme(e.target.value as ThemeId)}
            >
              {Object.values(THEMES).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <span className="settings-label">Sound</span>
            <button
              type="button"
              className="hud-btn hud-btn-subtle"
              onClick={() => {
                const next = !mutedNow;
                setMuted(next);
                setMutedNow(next);
              }}
            >
              {mutedNow ? '🔇 Muted' : '🔊 On'}
            </button>
          </label>
          <label className="settings-row">
            <span className="settings-label">Threat warnings</span>
            <button
              type="button"
              className="hud-btn hud-btn-subtle"
              onClick={() => onSetShowThreats(!showThreats)}
              title="Red ring + ! badge under pieces in opponent's capture range"
            >
              {showThreats ? '✓ On' : 'Off'}
            </button>
          </label>
        </div>
      )}
    </div>
  );
}
