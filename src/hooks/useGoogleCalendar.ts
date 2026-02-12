import { useSettings } from '../contexts/SettingsContext';
import { useMaster } from '../contexts/MasterContext';
import { WorkLog, db } from '../db';
import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';

// Google Calendar API Types (Simplified)
export interface GCalEvent {
    summary: string;
    description: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    id?: string;
}

export interface ImportEvent {
    id: string;
    summary: string;
    startAt: number;
    endAt: number;
    deptId: string;
    wtId: string;
    detail: string;
    description: string;
}

// Token Response from useGoogleLogin (Implicit)
// Note: @react-oauth/google handles the response type internally.

export const useGoogleCalendar = () => {
    const { settings, updateSettings } = useSettings();
    const { departments, workTypes, detailTasks } = useMaster();
    const [isSyncing, setIsSyncing] = useState(false);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            console.log("[OAuth] Login success", tokenResponse);
            // tokenResponse matches the implicit flow response structure mostly, 
            // but @react-oauth/google wraps it. 
            // Actually useGoogleLogin with default flow (implicit) returns an object with access_token.

            const expiresIn = tokenResponse.expires_in || 3599; // Default to 1 hour if missing

            const currentSettings = await db.settings.get('config');
            await updateSettings({
                calendar: {
                    ...(currentSettings?.calendar || { connected: false, eventTitleTemplate: '' }),
                    connected: true,
                    accessToken: tokenResponse.access_token,
                    refreshToken: undefined, // No refresh token in implicit flow
                    tokenExpiresAt: Date.now() + (expiresIn * 1000),
                    codeVerifier: undefined,
                }
            });
            console.log("[OAuth] Token saved. Connected.");
        },
        onError: (error) => {
            console.error("[OAuth] Login Failed", error);
            alert("ログインに失敗しました。");
        },
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file',
        // flow: 'implicit', // default is implicit
    });

    // Check expiration on mount/updates
    if (settings?.calendar.connected && settings.calendar.tokenExpiresAt) {
        if (Date.now() > settings.calendar.tokenExpiresAt) {
            console.warn("[OAuth] Token expired (detected on mount/update). Disconnecting session.");
            // Keep tokenExpiresAt for UI to show "Session Expired" banner
            updateSettings({
                calendar: {
                    ...settings.calendar,
                    connected: false,
                    accessToken: undefined,
                    refreshToken: undefined,
                }
            });
        }
    }

    // Resolve a valid access token. (No Auto-Refresh, Strict Timeout)
    const resolveValidAccessToken = async (): Promise<string | undefined> => {
        if (!settings?.calendar.connected || !settings?.calendar.accessToken) {
            return undefined;
        }

        const expiresAt = settings.calendar.tokenExpiresAt || 0;
        const isExpired = Date.now() > expiresAt;

        if (isExpired) {
            console.warn("[OAuth] Token expired during action. Disconnecting.");
            await updateSettings({
                calendar: {
                    ...settings.calendar,
                    connected: false,
                    accessToken: undefined,
                    refreshToken: undefined,
                    // Keep tokenExpiresAt so UI knows it EXPIRED rather than just disconnected
                }
            });
            throw new Error("AUTH_EXPIRED");
        }

        return settings.calendar.accessToken;
    };

    const handleAuthError = async (res: Response) => {
        if (res.status === 401) {
            console.warn("[OAuth] 401 Unauthorized. Disconnecting session.");
            await updateSettings({
                calendar: {
                    ...(settings?.calendar || { connected: false, eventTitleTemplate: '' }),
                    connected: false,
                    accessToken: undefined,
                    refreshToken: undefined,
                    // Treat 401 as expired/invalid so we show the re-login banner? 
                    // Or maybe we should set a flag? 
                    // For now, let's treat it largely the same, maybe keep tokenExpiresAt if we want "Expired" message, 
                    // or clear it if we want "Disconnected". User wants "Session Expired" banner.
                    // Let's assume 401 means token became invalid (effectively expired).
                    // But if we don't touch tokenExpiresAt, it might be in the future?
                    // Let's force it to be 'expired' conceptually for the UI.
                    // Actually, if we leave tokenExpiresAt as is (if future) and connected=false, 
                    // the UI check `Date.now() > tokenExpiresAt` might fail if it's still technically 'valid' time-wise but revoked.
                    // So let's set tokenExpiresAt to 1 (past) to force "Expired" banner.
                    tokenExpiresAt: 1
                }
            });
            return true;
        }
        return false;
    };

    const constructEventData = (log: WorkLog) => {
        const deptName = departments.find(d => d.id === log.departmentId)?.name || '';
        const wtName = workTypes.find(w => w.id === log.workTypeId)?.name || '';
        let dNamesArr = log.detailTaskNames || [];
        if (dNamesArr.length === 0 && log.detailTaskIds.length > 0) {
            dNamesArr = log.detailTaskIds
                .map(did => detailTasks.find(d => d.id === did)?.name)
                .filter(Boolean) as string[];
        }
        const detailNamesStr = dNamesArr.join(' ');
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

    const listEvents = async (start: Date, end: Date): Promise<GCalEvent[]> => {
        const token = await resolveValidAccessToken();
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

            if (await handleAuthError(res)) return [];
            if (!res.ok) return [];
            const data = await res.json();
            return data.items || [];
        } catch (e) {
            console.error("List events failed", e);
            return [];
        }
    };

    const syncLog = async (log: WorkLog, forceOverwrite = false): Promise<{ status: 'CREATED' | 'UPDATED' | 'COLLISION_ERROR', currentEvent?: GCalEvent, collisionEvents?: GCalEvent[] }> => {
        setIsSyncing(true);
        const token = await resolveValidAccessToken();

        if (!token) {
            setIsSyncing(false);
            throw new Error("AUTH_EXPIRED"); // Changed from specific message to Error Code for handling
        }

        try {
            const eventBody = constructEventData(log);
            const calendarId = 'primary';

            if (!forceOverwrite) {
                // ... (collision check omitted for brevity, assuming no changes needed inside) ...
                const s = new Date(log.startAt);
                const e = new Date(log.endAt || Date.now());
                const collisions = await listEvents(s, e);

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

            if (log.calendar?.eventId) {
                try {
                    const updateRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${log.calendar.eventId}`, {
                        method: 'PUT',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(eventBody)
                    });

                    if (await handleAuthError(updateRes)) {
                        setIsSyncing(false);
                        // Stop execution, do not return Collision Error, let the caller handle AUTH_EXPIRED if needed (though handleAuthError sets connected=false)
                        // But wait, handleAuthError returns true if handled.
                        // We should probably throw here too to be consistent with loop breaking?
                        throw new Error("AUTH_EXPIRED");
                    }

                    if (updateRes.ok) {
                        await db.workLogs.update(log.id, {
                            calendar: { ...log.calendar, lastSyncedAt: Date.now() }
                        });
                        setIsSyncing(false);
                        return { status: 'UPDATED' };
                    }
                } catch (e: any) {
                    if (e.message === "AUTH_EXPIRED") throw e;
                    // otherwise ignore update fail, try create
                }
            }

            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventBody)
            });

            if (await handleAuthError(res)) throw new Error("AUTH_EXPIRED");
            if (!res.ok) throw new Error("Failed to create event");
            const created = await res.json();

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
                detail = detail.replace(dName, "").trim();
            }

            if (matches.length >= 2) {
                const wName = matches[1] as string;
                const wt = workTypes.find(w => w.name === wName && w.enabled);
                if (wt) {
                    wtId = wt.id;
                    detail = detail.replace(wName, "").trim();
                }
            }
        }

        return { deptId, wtId, detail };
    };

    const fetchEventsForImport = async (date: Date): Promise<ImportEvent[]> => {
        const token = await resolveValidAccessToken();
        if (!token) return [];

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const events = await listEvents(startOfDay, endOfDay);

        return events
            .filter(e => !!e.start.dateTime)
            .map(e => {
                const { deptId, wtId, detail } = parseEventSummary(e.summary);
                return {
                    id: e.id || '',
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
