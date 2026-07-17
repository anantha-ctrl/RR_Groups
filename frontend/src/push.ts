import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function enablePushNotifications(userId: string) {
  if (!VAPID_PUBLIC_KEY) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  // Never auto-prompt on load — Chrome blocks apps that repeatedly request
  // permission without a user gesture. Only proceed if the user has already
  // granted it (call requestPushPermission() from a button to opt in).
  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'endpoint' },
    );
  } catch {
    // Push is best-effort — ignore failures (unsupported browser, denied permission, etc.)
  }
}

/**
 * Ask the user for notification permission. MUST be called from a user gesture
 * (e.g. a button click), never on page load. On grant, subscribes the device.
 * Returns the resulting permission state.
 */
export async function requestPushPermission(userId: string): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') {
    await enablePushNotifications(userId);
    return 'granted';
  }
  if (Notification.permission === 'denied') return 'denied';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await enablePushNotifications(userId);
  return permission;
}
