// Web Push helper — registers the service worker, requests notification
// permission, and creates/retrieves the push subscription. Stage 2 will add
// the Supabase storage of the subscription and the Edge Function that
// dispatches the actual notifications.

const SW_PATH = '/sw.js';

// Public VAPID key — safe to expose in client code (the matching private
// key lives only in the Edge Function's secrets). Generated once via
// `npx web-push generate-vapid-keys` and pasted into .env.production.
function getVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  return key && key.length > 0 ? key : null;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Service worker registration — idempotent. Browsers cache the active
// registration and only re-fetch the script if it changed, so calling this
// repeatedly is cheap.
async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_PATH);
  } catch (err) {
    console.error('[push] service worker registration failed', err);
    return null;
  }
}

// VAPID public keys are sent as URL-safe base64; the PushManager API needs
// a Uint8Array. Standard conversion routine.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Std = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Std);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type EnableResult =
  | { ok: true; subscription: PushSubscription }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no-vapid' | 'error'; message?: string };

// Full enable flow — register SW, request permission, subscribe, return
// the resulting PushSubscription. Caller is responsible for sending the
// subscription to the backend (stage 2 will do that automatically).
export async function enablePush(): Promise<EnableResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  const vapid = getVapidPublicKey();
  if (!vapid) {
    return {
      ok: false,
      reason: 'no-vapid',
      message:
        'VAPID public key not configured. Add VITE_VAPID_PUBLIC_KEY to .env.production.',
    };
  }
  const reg = await ensureRegistration();
  if (!reg) return { ok: false, reason: 'error', message: 'service worker registration failed' };

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // Cast through BufferSource — the DOM lib's strict typing of
      // applicationServerKey doesn't accept Uint8Array<ArrayBufferLike>
      // even though the underlying API does.
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      });
    }
    return { ok: true, subscription: sub };
  } catch (err) {
    console.error('[push] subscribe failed', err);
    return { ok: false, reason: 'error', message: String(err) };
  }
}

// Returns the existing subscription if present, without prompting.
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await ensureRegistration();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// Tear-down — used if the user disables push for their account.
export async function disablePush(): Promise<void> {
  const sub = await getExistingSubscription();
  if (sub) await sub.unsubscribe();
}

// Serializes a PushSubscription's keys into the columns we store in
// public.push_subscriptions. Pulls endpoint + p256dh + auth.
export function serializeSubscription(sub: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const json = sub.toJSON();
  const keys = json.keys ?? {};
  return {
    endpoint: json.endpoint as string,
    p256dh: keys.p256dh ?? '',
    auth: keys.auth ?? '',
  };
}
