import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { authApi } from "@/lib/api";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  link?: string;
  icon?: string;
}

interface UseUserActivityLogOptions {
  userId?: string;
  limit?: number;
  refreshInterval?: number;
  enabled?: boolean;
}

/**
 * Custom hook for real-time user activity logging with WebSocket fallback to polling
 * 
 * Features:
 * - Real-time WebSocket updates (with `user_activity` event)
 * - Auto-polling fallback for reliability
 * - Automatic activity limit management
 * - Error handling and loading states
 * 
 * @param options Hook configuration
 * @returns Activities list, loading state, error state, and manual refresh function
 */
export function useUserActivityLog(options: UseUserActivityLogOptions = {}) {
  const { userId, limit = 10, refreshInterval = 30000, enabled = true } = options;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch activities from backend
  const fetchActivities = useCallback(async () => {
    if (!userId || !enabled) return;
    const token = typeof window !== "undefined" ? (localStorage.getItem("accessToken") || localStorage.getItem("token")) : null;
    if (!token) return;

    try {
      setLoading(true);
      const res: any = await authApi.getDashboardData(userId);

      if (res?.data?.activity) {
        const data = Array.isArray(res.data.activity) ? res.data.activity : [];
        setActivities(data.slice(0, limit));
      }
      setError(null);
    } catch (err: any) {
      if (err?.message?.includes("Invalid or expired token") || err?.message?.includes("401")) {
        console.warn("[useUserActivityLog] Session expired while fetching activities.");
      } else {
        console.error("[useUserActivityLog] Fetch failed:", err);
      }
      setError(err instanceof Error ? err.message : "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [userId, limit, enabled]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enabled || !userId) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const baseApiUrl = typeof window !== "undefined" && (window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1"))
      ? "http://localhost:5000"
      : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000"));

    const socketUrl = baseApiUrl.endsWith("/api")
      ? baseApiUrl.replace("/api", "/chat")
      : `${baseApiUrl.replace(/\/$/, "")}/chat`;

    const socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("[useUserActivityLog] WebSocket connected");
    });

    socket.on("user_activity", (newActivity: Activity) => {
      console.log("[useUserActivityLog] Received activity:", newActivity);
      setActivities((prev) => [newActivity, ...prev].slice(0, limit));
    });

    socket.on("disconnect", () => {
      console.log("[useUserActivityLog] WebSocket disconnected, falling back to polling");
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [userId, limit, enabled]);

  // Setup polling as fallback
  useEffect(() => {
    if (!enabled) return;

    fetchActivities();

    pollIntervalRef.current = setInterval(() => {
      fetchActivities();
    }, refreshInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [userId, limit, refreshInterval, enabled, fetchActivities]);

  return {
    activities,
    loading,
    error,
    refresh: fetchActivities,
  };
}
