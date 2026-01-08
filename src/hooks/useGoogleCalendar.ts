import { useSettings } from '../contexts/SettingsContext';
import { useMaster } from '../contexts/MasterContext';
import { WorkLog, db } from '../db';
import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';

// Google Calendar API Types (Simplified)
interface GCalEvent {
    summary: string;
    description: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    id?: string;
}

export const useGoogleCalendar = () => {
    const { settings, updateSettings } = useSettings();
    const { departments, workTypes, detailTasks } = useMaster();
    const [isSyncing, setIsSyncing] = useState(false);

    const login = useGoogleLogin({
        scope: 'https://www.googleapis.com/auth/calendar.events',
        flow: 'implicit', // Get access_token directly
        onSuccess: (tokenResponse) => {
            console.log("Login Success", tokenResponse);
            updateSettings({
                calendar: {
                    // safe spread with default fallback FIRST
                    ...(settings?.calendar || { eventTitleTemplate: '' }),
                    connected: true,
                    accessToken: tokenResponse.access_token,
                }
            });
        },
        onError: error => console.error(error)
    });

    // Helper to get access token (simple refresh logic is tricky without backend, assuming valid for now)
    // In a real app, we'd handle token refresh or use the Google Identity Services clearer.
    const getAccessToken = () => settings?.calendar.accessToken;

    const handleAuthError = (res: Response) => {
        if (res.status === 401) {
            updateSettings({
                calendar: {
                    eventTitleTemplate: '', // Fallback for required field
                    ...settings?.calendar,
                    connected: false,
                    accessToken: undefined
                }
            });
            alert("接続がタイムアウトしました。設定から再接続してください。");
            return true;
        }
        return false;
    };

    const constructEventData = (log: WorkLog) => {
        // Resolve Names
        const deptName = departments.find(d => d.id === log.departmentId)?.name || '';
        const wtName = workTypes.find(w => w.id === log.workTypeId)?.name || '';
        // Resolve Detail Names (including non-master)
        let dNamesArr = log.detailTaskNames || [];
        if (dNamesArr.length === 0 && log.detailTaskIds.length > 0) {
            dNamesArr = log.detailTaskIds
                .map(did => detailTasks.find(d => d.id === did)?.name)
                .filter(Boolean) as string[];
        }
        const detailNamesStr = dNamesArr.join(' ');
        // Request: "連結(区切り文字なし)" -> No separators literally.

        // Strict "No Separator" Construction:
        // [Dept][WorkType][Details][Note]
        // But Dept/WT might be better as [Dept] if it implies brackets? 
        // "表示名の連結(区切り文字なし)" implies "DevelopmentCodingFeatureAImplemented".
        // Let's stick to simple concatenation.

        // Actually, let's use brackets for clarity if not forbidden, but user said "concatenated display names without separators". 
        // "部門名作業種別名詳細タスク名メモ"
        const title = `${deptName}${wtName}${detailNamesStr}${log.note || ''}`;

        const descParts = [];
        if (detailNamesStr) descParts.push(detailNamesStr);
        if (log.note) descParts.push(log.note);
        const description = descParts.join('\n');

        return {
            summary: title,
            description,
            start: { dateTime: new Date(log.startAt).toISOString() },
            end: { dateTime: new Date(log.endAt || Date.now()).toISOString() }
        };
    };



    /**
     * Syncs a log. 
     * If already synced (has eventId), it checks existence.
     * If exists, it returns a special object indicating "CONFLICT" or "UPDATE_NEEDED" so UI can prompt.
     * But hooks usually run logic.
     * 
     * Refined Logic:
     * This function will TRY to Create or Update blindly if `force` is true.
     * If `force` represents "User confirmed overwrite", we update.
     * 
     * But we need a way to "Check" first.
     */
    /**
     * Lists events in a given time range.
     */
    const listEvents = async (start: Date, end: Date): Promise<GCalEvent[]> => {
        const token = getAccessToken();
        if (!token) return [];

        try {
            const params = new URLSearchParams({
                timeMin: start.toISOString(),
                timeMax: end.toISOString(),
                singleEvents: 'true',
            });

            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (handleAuthError(res)) return [];
            if (!res.ok) return [];
            const data = await res.json();
            return data.items || [];
        } catch (e) {
            console.error("List events failed", e);
            return [];
        }
    };

    /**
     * Syncs a log. 
     * Now checks for TIME COLLISIONS.
     */
    const syncLog = async (log: WorkLog, forceOverwrite = false): Promise<{ status: 'CREATED' | 'UPDATED' | 'COLLISION_ERROR', currentEvent?: GCalEvent, collisionEvents?: GCalEvent[] }> => {
        setIsSyncing(true);
        const token = getAccessToken();

        if (!token) {
            setIsSyncing(false);
            throw new Error("Google Calendar未連携です");
        }

        try {
            const eventBody = constructEventData(log);
            const calendarId = 'primary';

            // Check for Time Collisions first
            // Only if NOT forceOverwrite (if user already confirmed, ignore collisions)
            if (!forceOverwrite) {
                const s = new Date(log.startAt);
                const e = new Date(log.endAt || Date.now());
                const collisions = await listEvents(s, e);

                // Filter out:
                // 1. Self (if updating)
                // 2. All-day events (events without dateTime)
                const realCollisions = collisions.filter(c => {
                    const isSelf = log.calendar?.eventId ? c.id === log.calendar.eventId : false;
                    const isAllDay = !c.start.dateTime;
                    return !isSelf && !isAllDay;
                });

                if (realCollisions.length > 0) {
                    const exactMatch = realCollisions.find(c => {
                        return new Date(c.start.dateTime!).getTime() === s.getTime() &&
                            new Date(c.end.dateTime!).getTime() === e.getTime();
                    });

                    if (exactMatch) {
                        log.calendar = { ...(log.calendar || { synced: false }), eventId: exactMatch.id };
                    } else {
                        setIsSyncing(false);
                        return { status: 'COLLISION_ERROR', collisionEvents: realCollisions };
                    }
                }
            }

            // Proceed to Create or Update
            // Check Update vs Create
            if (log.calendar?.eventId) {
                // ... Update logic ...
                // Note: We used to check 'checkEventState' here.
                // If we assume ID validity or just try update:
                // Let's try update. If 404, create new.

                try {
                    const updateRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${log.calendar.eventId}`, {
                        method: 'PUT',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(eventBody)
                    });

                    if (handleAuthError(updateRes)) {
                        setIsSyncing(false);
                        return { status: 'COLLISION_ERROR' }; // or another status to stop
                    }

                    if (updateRes.status === 404) {
                        // Gone, create new
                        // fall through to create logic below? or duplicate?
                        // Let's explicitly create.
                    } else if (updateRes.ok) {
                        // Success update
                        await db.workLogs.update(log.id, {
                            calendar: { ...log.calendar, lastSyncedAt: Date.now() }
                        });
                        setIsSyncing(false);
                        return { status: 'UPDATED' };
                    }
                } catch (e) {
                    // ignore update fail, try create
                }
            }

            // Create New
            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventBody)
            });

            if (handleAuthError(res)) throw new Error("Authentication failed");
            if (!res.ok) throw new Error("Failed to create event");
            const created = await res.json();

            // Save ID
            await db.workLogs.update(log.id, {
                calendar: {
                    synced: true,
                    eventId: created.id,
                    lastSyncedAt: Date.now()
                }
            });

            setIsSyncing(false);
            return { status: 'CREATED' };

        } catch (e: any) {
            setIsSyncing(false);
            console.error(e);
            throw e;
        }
    };

    const parseEventSummary = (summary: string) => {
        const matches = summary.match(/【[^】]+】/g) || [];
        let deptId = '';
        let wtId = '';
        let detail = summary;

        if (matches.length >= 1) {
            const dName = matches[0] as string;
            const dept = departments.find(d => d.name === dName && d.enabled);
            if (dept) {
                deptId = dept.id;
                // Remove the match from detail string
                detail = detail.replace(dName, "").trim();
            }

            if (matches.length >= 2) {
                const wName = matches[1] as string;
                const wt = workTypes.find(w => w.name === wName && w.enabled);
                if (wt) {
                    wtId = wt.id;
                    // Remove the second match
                    detail = detail.replace(wName, "").trim();
                }
            }
        }

        return { deptId, wtId, detail };
    };

    const fetchEventsForImport = async (date: Date): Promise<any[]> => {
        const token = getAccessToken();
        if (!token) return [];

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const events = await listEvents(startOfDay, endOfDay);

        // Filter out all-day events for now (they don't have duration)
        // or handle them as 24h? User usually wants time-specific ones.
        return events
            .filter(e => !!e.start.dateTime)
            .map(e => {
                const { deptId, wtId, detail } = parseEventSummary(e.summary);
                return {
                    id: e.id,
                    summary: e.summary,
                    startAt: new Date(e.start.dateTime!).getTime(),
                    endAt: new Date(e.end.dateTime!).getTime(),
                    deptId,
                    wtId,
                    detail,
                    description: e.description
                };
            });
    };

    return { syncLog, isSyncing, login, fetchEventsForImport };
};
