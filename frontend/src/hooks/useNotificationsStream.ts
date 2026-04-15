import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';
import type {
    Notification,
    NotificationsResponse,
    UnreadCountResponse
} from '../services/notifications';

function normalizeNotification(notification: Notification): Notification {
    const rawData = notification.data as unknown;
    let data: Record<string, unknown> = {};

    if (typeof rawData === 'string') {
        try {
            const parsed = JSON.parse(rawData);
            if (parsed && typeof parsed === 'object')
                data = parsed as Record<string, unknown>;
        } catch {
            data = {};
        }
    } else if (rawData && typeof rawData === 'object') {
        data = rawData as Record<string, unknown>;
    }

    return {
        ...notification,
        data: {
            actor_username:
                (data.actor_username as string | undefined) ||
                (data.actorUsername as string | undefined),
            actor_id:
                (data.actor_id as number | undefined) ??
                (data.actorId as number | undefined),
            post_id:
                (data.post_id as number | undefined) ??
                (data.postId as number | undefined),
            comment_id:
                (data.comment_id as number | undefined) ??
                (data.commentId as number | undefined),
            message:
                (data.message as string | undefined) ||
                (data.messageText as string | undefined)
        }
    };
}

function buildStreamUrl(token: string) {
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/notifications/stream`);
    url.searchParams.set('access_token', token);
    return url.toString();
}

export function useNotificationsStream() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const sourceRef = useRef<EventSource | null>(null);
    const tokenRef = useRef<string | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
    );

    useEffect(() => {
        if (!user) {
            sourceRef.current?.close();
            sourceRef.current = null;
            tokenRef.current = null;
            return;
        }

        let disposed = false;

        const closeSource = () => {
            if (sourceRef.current) {
                sourceRef.current.close();
                sourceRef.current = null;
            }
        };

        const handleNotification = (event: MessageEvent<string>) => {
            try {
                const payload = JSON.parse(event.data) as {
                    notification?: Notification;
                };
                const notification = payload.notification
                    ? normalizeNotification(payload.notification)
                    : null;
                if (!notification) return;

                queryClient.setQueryData<UnreadCountResponse>(
                    ['notifications', 'unread'],
                    (old) => ({ count: (old?.count || 0) + 1 })
                );

                queryClient.setQueryData<NotificationsResponse>(
                    ['notifications', 'list'],
                    (old) => {
                        if (!old) return old;
                        const notifications = [
                            notification,
                            ...old.notifications.filter(
                                (item) => item.id !== notification.id
                            )
                        ];
                        return { ...old, notifications };
                    }
                );

                window.dispatchEvent(
                    new CustomEvent<Notification>('notifications:new', {
                        detail: notification
                    })
                );
            } catch {
                // Ignore malformed payloads and let the stream continue.
            }
        };

        const scheduleReconnect = () => {
            if (disposed) return;
            if (reconnectTimerRef.current)
                clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => {
                if (!disposed) connect();
            }, 5000);
        };

        function connect() {
            const token = sessionStorage.getItem('access_token');
            if (!token || disposed) return;

            if (sourceRef.current && tokenRef.current === token) {
                return;
            }

            closeSource();
            tokenRef.current = token;

            const source = new EventSource(buildStreamUrl(token));
            sourceRef.current = source;

            source.addEventListener(
                'notification',
                handleNotification as EventListener
            );
            source.onerror = () => {
                closeSource();
                scheduleReconnect();
            };
        }

        connect();

        const tokenWatcher = setInterval(() => {
            const currentToken = sessionStorage.getItem('access_token');
            if (currentToken && currentToken !== tokenRef.current) {
                connect();
            }
        }, 10000);

        return () => {
            disposed = true;
            clearInterval(tokenWatcher);
            if (reconnectTimerRef.current)
                clearTimeout(reconnectTimerRef.current);
            closeSource();
        };
    }, [queryClient, user]);
}
