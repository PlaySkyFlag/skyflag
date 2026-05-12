// In-app feedback submission. The form lives in src/FeedbackModal.tsx;
// this module owns the submit + auto-capture logic so the modal stays
// pure UI.
//
// Auto-captured context (so the owner doesn't have to ask "what URL?
// what browser?"):
//   - user_id from the current Supabase session (or null for guests)
//   - current_url from window.location.href
//   - user_agent from navigator.userAgent
//   - viewport dimensions from window.innerWidth/innerHeight
//
// RLS (migration 025) enforces that a signed-in submission's user_id
// matches auth.uid(), so even if a malicious client tampers with the
// id field server-side the row is rejected.

import { supabase } from './supabase';

export type FeedbackCategory = 'bug' | 'confusion' | 'feature' | 'praise' | 'other';

export type FeedbackResult =
  | { ok: true }
  | { ok: false; message: string };

export async function submitFeedback(
  category: FeedbackCategory,
  message: string,
  userId: string | null,
): Promise<FeedbackResult> {
  if (!supabase) {
    return { ok: false, message: 'Backend not configured — feedback unavailable.' };
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: 'Feedback message is empty.' };
  }
  if (trimmed.length > 5000) {
    return { ok: false, message: 'Message is too long (max 5000 characters).' };
  }

  const row = {
    user_id: userId,
    category,
    message: trimmed,
    current_url: typeof window !== 'undefined' ? window.location.href : null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    viewport_width: typeof window !== 'undefined' ? window.innerWidth : null,
    viewport_height: typeof window !== 'undefined' ? window.innerHeight : null,
  };

  const { error } = await supabase.from('feedback').insert(row);
  if (error) {
    // RLS rejection on mismatched user_id surfaces as a generic
    // "new row violates row-level security policy" — rephrase for
    // humans. Anything else passes through with the raw message.
    if (/row-level security/i.test(error.message)) {
      return { ok: false, message: 'Sign-in state changed — try again.' };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

// Label / description metadata for the category dropdown in the UI.
// Keeping it here so the UI module stays focused on layout.
export const CATEGORY_LABELS: Record<FeedbackCategory, { label: string; description: string }> = {
  bug: {
    label: '🐞 Bug',
    description: 'Something broke or did the wrong thing',
  },
  confusion: {
    label: '🤔 Confusion',
    description: "I'm not sure what's supposed to happen here",
  },
  feature: {
    label: '✨ Feature idea',
    description: 'Something that would make the game better',
  },
  praise: {
    label: '🙌 Praise',
    description: 'You did something well — fuel for the team',
  },
  other: {
    label: '💬 Other',
    description: "Doesn't fit the above",
  },
};
