// Recovery-codes client helpers — thin wrappers around the two Edge
// Functions that handle generation and consumption.

import { supabase } from './supabase';

export type GenerateResult =
  | { ok: true; codes: string[] }
  | { ok: false; message: string };

export async function generateRecoveryCodes(): Promise<GenerateResult> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('generate-recovery-codes', {
    body: {},
  });
  if (error) return { ok: false, message: error.message };
  if (!data || data.ok === false) {
    return { ok: false, message: data?.detail ?? data?.error ?? "Couldn't generate codes." };
  }
  return { ok: true, codes: data.codes as string[] };
}

export type UseResult =
  | { ok: true; actionLink: string }
  | { ok: false; message: string };

export async function useRecoveryCode(email: string, code: string): Promise<UseResult> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('use-recovery-code', {
    body: {
      email,
      code,
      redirect_to: window.location.origin,
    },
  });
  if (error) return { ok: false, message: error.message };
  if (!data || data.ok === false) {
    const reason = data?.error;
    const friendly =
      reason === 'invalid-code'
        ? "That code didn't match. Codes are single-use and case-insensitive — double-check and try another."
        : data?.detail ?? data?.error ?? 'Recovery failed.';
    return { ok: false, message: friendly };
  }
  return { ok: true, actionLink: data.action_link as string };
}

// Counts how many unused codes the signed-in user has left, so the UI
// can show "8/8 active" or "3/8 active" without exposing the hashes.
export async function countRemainingCodes(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase
    .from('recovery_codes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('used_at', null);
  return count ?? 0;
}
