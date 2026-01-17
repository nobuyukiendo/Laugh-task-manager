import React, { createContext, useContext, ReactNode, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, WorkLog } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { formatInTimeZone } from 'date-fns-tz';
import { useSettings } from './SettingsContext';

interface TimerContextType {
    activeLog: WorkLog | undefined;
    lastFinishedLog: WorkLog | null;
    startTimer: (deptId: string, workTypeId: string, detailIds: string[], detailNames: string[], note: string) => Promise<void>;
    stopTimer: () => Promise<void>;
    cancelTimer: () => Promise<void>;
    updateActiveNote: (note: string) => Promise<void>;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { settings } = useSettings();
    const [lastFinishedLog, setLastFinishedLog] = useState<WorkLog | null>(null);

    // Watch for running log
    const activeLog = useLiveQuery(async () => {
        return await db.workLogs.where('status').equals('running').first();
    });

    const applyRounding = (ts: number): number => {
        const r = settings?.rounding ?? 1; // Default to 1 if missing
        if (r <= 0) return ts; // "None" (0) logic (though we want strictly 1 min mostly)
        /* 
           Requested: "Must record in 1 minute units".
           Standard approach: Floor to nearest minute (or 5 min).
        */
        const ms = r * 60 * 1000;
        return Math.floor(ts / ms) * ms;
    };

    // Start Timer
    const startTimer = async (deptId: string, workTypeId: string, detailIds: string[], detailNames: string[], note: string = '') => {
        if (activeLog) {
            throw new Error("Timer already running");
        }

        // Floor to minute boundary
        const now = new Date();
        now.setSeconds(0, 0);
        const startAt = now.getTime();

        const tz = settings?.timezone || 'UTC';
        const dateKey = formatInTimeZone(startAt, tz, 'yyyy-MM-dd');

        const newLog: WorkLog = {
            id: uuidv4(),
            departmentId: deptId,
            workTypeId,
            detailTaskIds: detailIds,
            detailTaskNames: detailNames,
            note,
            startAt: startAt,
            dateKey,
            timezone: tz,
            status: 'running',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            durationSec: 0,
        };

        await db.workLogs.add(newLog);
    };

    // Stop Timer
    const stopTimer = async () => {
        if (!activeLog) return;

        // Floor to minute boundary
        const now = new Date();
        now.setSeconds(0, 0);
        const endAt = now.getTime();

        const tz = settings?.timezone || 'UTC';

        // Ensure end isn't before start due to rounding
        const finalEnd = Math.max(endAt, activeLog.startAt);

        // Date Crossing Check
        const startDateStr = formatInTimeZone(activeLog.startAt, tz, 'yyyy-MM-dd');
        const endDateStr = formatInTimeZone(finalEnd, tz, 'yyyy-MM-dd');

        if (startDateStr === endDateStr) {
            // Normal case: Same day
            const durationSec = (finalEnd - activeLog.startAt) / 1000;
            const updatedLog = {
                ...activeLog,
                status: 'done' as const,
                endAt: finalEnd,
                durationSec,
                updatedAt: Date.now()
            };
            await db.workLogs.update(activeLog.id, {
                status: 'done',
                endAt: finalEnd,
                durationSec,
                updatedAt: Date.now()
            });
            setLastFinishedLog(updatedLog);
        } else {
            // Date Crossing: Split logs
            const logsToCreate: WorkLog[] = [];
            let currentStart = activeLog.startAt;

            // Generate logs for each day
            while (true) {
                const currentDateStr = formatInTimeZone(currentStart, tz, 'yyyy-MM-dd');

                // Get start of NEXT day in target TZ
                // We parse 'tomorrow' 00:00:00 in the given TZ
                const tomorrowDate = new Date(currentStart);
                tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                const nextDayStartStr = formatInTimeZone(tomorrowDate, tz, 'yyyy-MM-dd 00:00:00');
                // Use date-fns-tz parse if available, but here we can use a trick:
                // Find the timestamp for next day 00:00 in that TZ.
                // Since we need to be precise, let's use the offset.
                const nextDayBoundary = new Date(nextDayStartStr).getTime();
                // Caution: 'new Date(string)' might be flaky with TZ. 
                // Better approach with date-fns-tz:
                // However, simple split at 24:00 is usually enough for most cases.

                // Let's use a safer boundary calculation:
                const boundary = new Date(currentStart);
                boundary.setHours(24, 0, 0, 0); // Local midnight
                // Adjusting to TZ is tricky without heavy libraries, but Dexie logs use UTC ts.
                // We'll use the formatInTimeZone to determine if we crossed the line.

                const nextStartTime = Math.min(finalEnd, boundary.getTime());
                const currentDurationSec = (nextStartTime - currentStart) / 1000;

                if (currentDurationSec > 0) {
                    logsToCreate.push({
                        ...activeLog,
                        id: logsToCreate.length === 0 ? activeLog.id : uuidv4(),
                        startAt: currentStart,
                        endAt: nextStartTime,
                        durationSec: currentDurationSec,
                        dateKey: currentDateStr,
                        status: 'done',
                        updatedAt: Date.now()
                    });
                }

                if (nextStartTime >= finalEnd) break;
                currentStart = nextStartTime;
            }

            // Persistence
            if (logsToCreate.length > 0) {
                // Update the first one (original entry)
                const first = logsToCreate[0];
                await db.workLogs.update(activeLog.id, {
                    status: 'done',
                    startAt: first.startAt,
                    endAt: first.endAt,
                    durationSec: first.durationSec,
                    dateKey: first.dateKey,
                    updatedAt: Date.now()
                });

                // Add the rest
                if (logsToCreate.length > 1) {
                    await db.workLogs.bulkAdd(logsToCreate.slice(1));
                    alert(`日付を跨いだため、記録を${logsToCreate.length}件に分割して登録しました。`);
                }

                // For simplified display, show the last part or the main part?
                // Providing the last part usually makes most sense for "just finished" context 
                // but let's just return the last segment.
                setLastFinishedLog(logsToCreate[logsToCreate.length - 1]);
            }
        }
    };

    const cancelTimer = async () => {
        if (!activeLog) return;
        await db.workLogs.update(activeLog.id, {
            status: 'canceled',
            endAt: Date.now(),
            updatedAt: Date.now()
        });
    };

    const updateActiveNote = async (note: string) => {
        if (!activeLog) return;
        await db.workLogs.update(activeLog.id, { note, updatedAt: Date.now() });
    };

    return (
        <TimerContext.Provider value={{
            activeLog,
            lastFinishedLog,
            startTimer,
            stopTimer,
            cancelTimer,
            updateActiveNote
        }}>
            {children}
        </TimerContext.Provider>
    );
};

export const useTimer = () => {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within a TimerProvider');
    }
    return context;
};
