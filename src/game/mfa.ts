// Two-factor auth wrappers — thin layer on top of Supabase's native
// MFA API. Three concerns split out:
//   * enroll/unenroll — manage the factor itself
//   * verify — confirm enrollment OR step up an active session
//   * status — check whether the current session is at AAL2
//
// The UI keeps a straightforward state machine over these calls; it
// doesn't need to know about challenges or factor IDs beyond what
// these helpers return.

import { supabase } from './supabase';

export type TotpFactor = {
  id: string;
  status: 'unverified' | 'verified';
  friendly_name: string | null;
  created_at: string;
};

export type EnrollData = {
  factorId: string;
  qrCode: string; // data: URI for the QR image
  secret: string; // base32 secret if the user can't scan
  uri: string;
};

export async function listTotpFactors(): Promise<{
  verified: TotpFactor | null;
  unverified: TotpFactor | null;
}> {
  if (!supabase) return { verified: null, unverified: null };
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return { verified: null, unverified: null };
  // The .totp array filters to TOTP factors specifically; .all has
  // both totp and phone factors.
  const totp = data.totp ?? [];
  const verified =
    (totp.find((f) => f.status === 'verified') as TotpFactor | undefined) ?? null;
  const unverified =
    (totp.find((f) => f.status === 'unverified') as TotpFactor | undefined) ?? null;
  return { verified, unverified };
}

// Start a TOTP enrollment. If there's an existing UNVERIFIED factor
// hanging around (user abandoned a previous attempt), we tear it down
// first so the user always sees a fresh QR — Supabase only returns
// the QR + secret on enroll(), not on listFactors(), so a stale
// unverified factor with no QR is unrecoverable.
export async function startTotpEnrollment(): Promise<
  { ok: true; data: EnrollData } | { ok: false; message: string }
> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const existing = await listTotpFactors();
  if (existing.unverified) {
    await supabase.auth.mfa.unenroll({ factorId: existing.unverified.id });
  }
  if (existing.verified) {
    return { ok: false, message: 'Two-factor auth is already enabled.' };
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
  });
  if (error || !data) {
    return { ok: false, message: error?.message ?? 'enroll failed' };
  }
  return {
    ok: true,
    data: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  };
}

// Confirms the user has the secret loaded into their authenticator
// app. Combines challenge + verify so callers don't need to plumb the
// challengeId themselves.
export async function verifyTotpEnrollment(
  factorId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const token = code.replace(/[^0-9]/g, '');
  if (token.length !== 6) {
    return { ok: false, message: 'Code should be 6 digits.' };
  }
  const ch = await supabase.auth.mfa.challenge({ factorId });
  if (ch.error || !ch.data) {
    return { ok: false, message: ch.error?.message ?? 'challenge failed' };
  }
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: ch.data.id,
    code: token,
  });
  if (error) {
    if (/invalid/i.test(error.message)) {
      return { ok: false, message: 'Code didn\'t match — try again.' };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function disableTotp(
  factorId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Used by the post-sign-in flow to detect whether the active session
// needs to be stepped up from AAL1 (password/email/OAuth) to AAL2
// (TOTP confirmed). When `next > current`, the UI should pop the
// challenge form before exposing any account-altering controls.
export async function getAuthenticatorAssuranceLevel(): Promise<{
  current: 'aal1' | 'aal2' | null;
  next: 'aal1' | 'aal2' | null;
}> {
  if (!supabase) return { current: null, next: null };
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    current: (data?.currentLevel as 'aal1' | 'aal2' | null) ?? null,
    next: (data?.nextLevel as 'aal1' | 'aal2' | null) ?? null,
  };
}

// Step-up the current session to AAL2 by completing a TOTP challenge
// against an already-verified factor. Used by the post-sign-in form
// when getAuthenticatorAssuranceLevel reports next='aal2'.
export async function stepUpToAal2(
  factorId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return verifyTotpEnrollment(factorId, code);
}
