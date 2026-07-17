import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Notification, Profile } from './types';

// How often the badge re-checks the backend for new/updated notifications.
const POLL_MS = 20000;

export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const activeRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!activeRef.current) return;
    const list = (data ?? []) as Notification[];
    setItems(list);
    setUnread(list.filter((n) => !n.read).length);
  }, [userId]);

  useEffect(() => {
    activeRef.current = true;
    if (!userId) {
      setItems([]);
      setUnread(0);
      return;
    }
    refresh();
    // Poll so the badge stays in near-real-time sync across the app.
    const timer = setInterval(refresh, POLL_MS);
    // Refresh immediately when the tab regains focus.
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      activeRef.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [userId, refresh]);

  return { items, unread, refresh };
}

export function useAgents() {
  const [agents, setAgents] = useState<Profile[]>([]);
  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'agent')
      .then(({ data }: { data: unknown }) => setAgents(((data as Profile[]) ?? []) as Profile[]));
  }, []);
  return agents;
}
