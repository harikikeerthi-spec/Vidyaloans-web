import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { staffProfileApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface Activity {
  id: string;
  type: string;
  msg: string;
  icon: string;
  color: string;
  actorName?: string;
  actorEmail?: string;
  createdAt?: string;
  time?: string;
}

export interface ActivityLogOptions {
  limit?: number;
  pollInterval?: number;
  autoRefresh?: boolean;
  enableWebSocket?: boolean;
  staffId?: string;
}

// Helper function to format relative time
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return 'Just now';

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString('en-IN');
  } catch {
    return 'Recently';
  }
}

export const useActivityLog = (options: ActivityLogOptions = {}) => {
  const {
    limit = 15,
    pollInterval = 30000,
    autoRefresh = true,
    enableWebSocket = true,
    staffId,
  } = options;

  const { token, user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);

  // Fetch activities from backend
  const fetchActivities = useCallback(async () => {
    const activeToken = token || (typeof window !== "undefined" ? (localStorage.getItem("staffAccessToken") || localStorage.getItem("adminAccessToken")) : null);
    if (!activeToken) return;

    const now = Date.now();
    if (now - lastFetchRef.current < 1000) return; // Debounce

    try {
      setLoading(true);
      setError(null);
      const res: any = await staffProfileApi.getDashboardActivities(limit, staffId);
      const items: Activity[] = Array.isArray(res) ? res : (res?.data ?? []);

      setActivities(items.map((a: Activity) => ({
        ...a,
        time: a.createdAt ? formatRelativeTime(a.createdAt) : 'Just now'
      })));

      setLastUpdated(new Date());
      lastFetchRef.current = now;
    } catch (err: any) {
      if (err?.message?.includes('Invalid or expired token') || err?.message?.includes('401')) {
        console.warn('[useActivityLog] Session expired while fetching activities.');
      } else {
        console.error('[useActivityLog] Failed to fetch activities:', err);
      }
      setError(err?.message || 'Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  }, [limit, staffId, token]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enableWebSocket || !token) return;

    const baseApiUrl = typeof window !== 'undefined' && (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
      ? 'http://localhost:5000'
      : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));

    const socketUrl = baseApiUrl.endsWith('/api')
      ? baseApiUrl.replace('/api', '/chat')
      : `${baseApiUrl.replace(/\/$/, '')}/chat`;

    const socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[useActivityLog] WebSocket connected');
      setIsConnected(true);
    });

    socket.on('staff_activity', (newActivity: Activity) => {
      if (user?.role === 'staff') {
        const myEmail = (user?.email || '').toLowerCase();
        const myId = (user?.id || '').toLowerCase();
        const actEmail = ((newActivity as any).actorEmail || newActivity.actorName || '').toLowerCase();
        const actId = ((newActivity as any).initiatedBy || '').toLowerCase();

        const isMine = (myEmail && actEmail.includes(myEmail)) || (myId && actId === myId);
        if (!isMine) return; // Skip activities of other staff members!
      }

      console.log('[useActivityLog] Received staff activity:', newActivity);
      const formatted: Activity = {
        ...newActivity,
        id: newActivity.id || `act-${Date.now()}-${Math.random()}`,
        time: formatRelativeTime(newActivity.createdAt || new Date().toISOString()),
        createdAt: newActivity.createdAt || new Date().toISOString(),
      };

      setActivities((prev) => [formatted, ...prev].slice(0, limit));
    });

    socket.on('disconnect', () => {
      console.log('[useActivityLog] WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error: any) => {
      console.error('[useActivityLog] WebSocket connection error:', error);
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [enableWebSocket, limit]);

  // Log a new activity
  const logActivity = useCallback(async (
    type: string,
    msg: string,
    icon: string,
    color: string
  ) => {
    try {
      await staffProfileApi.logActivity({ type, msg, icon, color });
      // Refresh activities after logging
      await fetchActivities();
    } catch (err) {
      console.error('[useActivityLog] Failed to log activity:', err);
    }
  }, [fetchActivities]);

  // Add activity to local state immediately (for optimistic updates)
  const addActivityOptimistic = useCallback((
    type: string,
    msg: string,
    icon: string,
    color: string,
    actorName?: string
  ) => {
    const newActivity: Activity = {
      id: `act-${Date.now()}-${Math.random()}`,
      type,
      msg,
      icon,
      color,
      actorName: actorName || 'Staff',
      createdAt: new Date().toISOString(),
      time: 'Just now'
    };

    setActivities(prev => [newActivity, ...prev].slice(0, limit));

    // Also log it on the backend asynchronously
    logActivity(type, msg, icon, color).catch(console.error);
  }, [limit, logActivity]);

  // Set up auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;

    // Initial fetch
    fetchActivities();

    // Set up polling interval
    pollIntervalRef.current = setInterval(fetchActivities, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchActivities, autoRefresh, pollInterval]);

  return {
    activities,
    loading,
    error,
    lastUpdated,
    isConnected,
    fetchActivities,
    logActivity,
    addActivityOptimistic
  };
};

export default useActivityLog;
