import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/api';

const ANALYTICS_INTERVAL = 30_000;  // 30 s
const NOTIF_INTERVAL     = 15_000;  // 15 s

export function useAnalytics(enabled = true) {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [notifs, setNotifs]   = useState([]);
  const seenIds = useRef(new Set());

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading((p) => (p ? p : true));
      const res = await api.get('/api/dashboard/analytics');
      setData(res);
    } catch (e) {
      console.error('[useAnalytics]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api.get('/api/dashboard/notificaciones');
      if (!Array.isArray(res)) return;
      // Only surface truly new notifications
      const fresh = res.filter((n) => !seenIds.current.has(n.id));
      if (fresh.length) {
        fresh.forEach((n) => seenIds.current.add(n.id));
        setNotifs((prev) => [...prev, ...fresh]);
      }
    } catch (e) {
      console.error('[useAnalytics notifs]', e);
    }
  }, []);

  const dismissNotif = useCallback((id) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchAnalytics();
    fetchNotifs();

    const t1 = setInterval(fetchAnalytics, ANALYTICS_INTERVAL);
    const t2 = setInterval(fetchNotifs, NOTIF_INTERVAL);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [enabled, fetchAnalytics, fetchNotifs]);

  return { data, loading, notifs, dismissNotif, refetch: fetchAnalytics };
}
