// Avatar upload helpers. Files land in the Supabase Storage 'avatars'
// bucket under a deterministic path of `<user_id>.<ext>` — RLS scopes
// writes to that path so each user can only manage their own.

import { supabase } from './supabase';

// Max upload size before we reject client-side (Supabase has its own
// 50MB default, but we want avatars small for fast page paints).
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function uploadAvatar(userId: string, file: File): Promise<UploadResult> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  if (file.size > MAX_BYTES) {
    return { ok: false, message: 'Image must be under 2 MB. Crop or compress and try again.' };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, message: 'Use a JPG, PNG, or WebP image.' };
  }

  // Derive extension from MIME type so we don't trust the filename.
  const ext = file.type === 'image/jpeg' ? 'jpg'
            : file.type === 'image/png'  ? 'png'
            : 'webp';
  const path = `${userId}.${ext}`;

  // Upload with upsert — replaces the previous avatar at the same path.
  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    });
  if (uploadErr) return { ok: false, message: uploadErr.message };

  // Build the public URL. Cache-bust with a timestamp so the new
  // avatar shows up immediately — without this, the browser would
  // serve the previous one from cache for up to cacheControl seconds.
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  const cacheBustedUrl = `${pub.publicUrl}?t=${Date.now()}`;

  // Persist on the profile row so other clients can resolve it without
  // probing the storage bucket.
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: cacheBustedUrl })
    .eq('id', userId);
  if (updateErr) return { ok: false, message: updateErr.message };

  return { ok: true, url: cacheBustedUrl };
}

export async function removeAvatar(userId: string): Promise<UploadResult> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  // Try all three extensions — we don't know which the user has.
  await supabase.storage.from('avatars').remove([
    `${userId}.jpg`,
    `${userId}.png`,
    `${userId}.webp`,
  ]);
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);
  if (updateErr) return { ok: false, message: updateErr.message };
  return { ok: true, url: '' };
}
