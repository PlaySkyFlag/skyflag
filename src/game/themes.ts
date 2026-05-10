// Visual theme registry. Each theme bundles per-layer board palettes +
// the two player marker palettes, so picking a theme changes both the
// board look and the piece colors in one move. Selection is persisted
// in localStorage; later it can be promoted to a profile column.
//
// To add a new theme: copy a block, tweak the hexes, and add it to
// THEMES. The CSS variables in :root are kept in sync via the effect
// in App.tsx that runs on theme change.

import type { Layer } from './types';

export type ThemeId = 'classic' | 'twilight' | 'aurora' | 'frost';

export type LayerThemeDef = {
  lightFill: string;
  darkFill: string;
  background: string;
  stroke: string;
  label: string;
};

export type PlayerPaletteDef = {
  fill: string;        // SVG marker fill (the piece glyph color)
  border: string;      // CSS subtle border / accent
  accent: string;      // Brighter accent / deploy stroke
  textOnLight: string; // Text color for areas where the player swatch is the bg
};

export type Theme = {
  id: ThemeId;
  name: string;
  layers: Record<Layer, LayerThemeDef>;
  players: Record<'p1' | 'p2', PlayerPaletteDef>;
};

// ─── Theme registry ──────────────────────────────────────────────────

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    layers: {
      space:  { lightFill: '#5b5f9a', darkFill: '#3a3d6b', background: '#15172e', stroke: '#0a0b1c', label: '#9ea4cf' },
      sky:    { lightFill: '#bcdcef', darkFill: '#7eb3d4', background: '#2a4860', stroke: '#163040', label: '#a8c4d8' },
      ground: { lightFill: '#a8c48f', darkFill: '#6b8e5a', background: '#1f2a17', stroke: '#2d3b25', label: '#a4b89a' },
    },
    players: {
      p1: { fill: '#0f1830', border: '#1e2a48', accent: '#a8b8d8', textOnLight: '#c8d2e8' },
      p2: { fill: '#fff4dc', border: '#ebd9b8', accent: '#ffd884', textOnLight: '#1a1a1a' },
    },
  },
  twilight: {
    id: 'twilight',
    name: 'Twilight',
    layers: {
      space:  { lightFill: '#5e4e8a', darkFill: '#3d2f5f', background: '#180f2a', stroke: '#0a0716', label: '#c5b8e5' },
      sky:    { lightFill: '#9b8ec5', darkFill: '#6e5fa1', background: '#2c2150', stroke: '#150e2a', label: '#b8a8d8' },
      ground: { lightFill: '#7b6a92', darkFill: '#544668', background: '#22182f', stroke: '#100a18', label: '#a89cc0' },
    },
    players: {
      p1: { fill: '#1a0a2a', border: '#3d2360', accent: '#c8a8e8', textOnLight: '#e0d4f0' },
      p2: { fill: '#fce8d0', border: '#e8c89a', accent: '#ffd5a0', textOnLight: '#28162f' },
    },
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    layers: {
      space:  { lightFill: '#3d6e6f', darkFill: '#2a4f50', background: '#0c2225', stroke: '#061113', label: '#a0e0c8' },
      sky:    { lightFill: '#7ed4be', darkFill: '#4ea893', background: '#1a4040', stroke: '#0a2424', label: '#b0e8d0' },
      ground: { lightFill: '#88c46a', darkFill: '#56843e', background: '#102818', stroke: '#08160c', label: '#a8d098' },
    },
    players: {
      p1: { fill: '#0a1820', border: '#1e3848', accent: '#5fd5c7', textOnLight: '#c8e8e0' },
      p2: { fill: '#ffe8a8', border: '#e0c878', accent: '#f0a85c', textOnLight: '#1a1408' },
    },
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    layers: {
      space:  { lightFill: '#4b6c8e', darkFill: '#324c6c', background: '#0e1c2c', stroke: '#050b15', label: '#a8c4e0' },
      sky:    { lightFill: '#b4d4e8', darkFill: '#7ea8c8', background: '#243e58', stroke: '#0c1c2c', label: '#bcd4e8' },
      ground: { lightFill: '#a4b8c8', darkFill: '#7088a0', background: '#1a242e', stroke: '#0a1218', label: '#b0c0d0' },
    },
    players: {
      p1: { fill: '#0a1828', border: '#243a52', accent: '#88b4d8', textOnLight: '#c8dceb' },
      p2: { fill: '#f0f4f8', border: '#cdd5dd', accent: '#dbe8f2', textOnLight: '#0a1828' },
    },
  },
};

export const DEFAULT_THEME: ThemeId = 'classic';

const STORAGE_KEY = '3phor.theme.v1';

export function loadThemeId(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && raw in THEMES) return raw as ThemeId;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function saveThemeId(id: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

// Applies a theme by writing CSS variables to :root. Board.tsx and other
// components reference these via var(--slate-fill) etc., so this single
// call propagates through the whole UI without per-component plumbing.
export function applyThemeToCssVars(id: ThemeId): void {
  if (typeof document === 'undefined') return;
  const t = THEMES[id];
  if (!t) return;
  const r = document.documentElement.style;
  r.setProperty('--slate-fill', t.players.p1.fill);
  r.setProperty('--slate-border', t.players.p1.border);
  r.setProperty('--slate-accent', t.players.p1.accent);
  r.setProperty('--slate-text', t.players.p1.textOnLight);
  r.setProperty('--ivory-fill', t.players.p2.fill);
  r.setProperty('--ivory-border', t.players.p2.border);
  r.setProperty('--ivory-dark-text', t.players.p2.textOnLight);
}
