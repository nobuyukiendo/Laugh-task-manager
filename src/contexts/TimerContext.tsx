import React, { createContext, useContext, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, WorkLog } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { formatInTimeZone } from 'date-fns-tz';
import { useSettings } from './SettingsContext';

interface TimerContextType {
    activeLog: WorkLog | undefined;
    startTimer: (deptId: string, workTypeId: string, detailIds: string[], note: string) => Promise<void>;
    stopTimer: () => Promise<void>;
    cancelTimer: () => Promise<void>;
    updateActiveNote: (note: string) => Promise<void>;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { settings } = useSettings();

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

    const startTimer = async (deptId: string, workTypeId: string, detailIds: string[], note: string) => {
        if (activeLog) {
            throw new Error("Timer already running");
        }

        const exactNow = Date.now();
        const startAt = applyRounding(exactNow);

        const tz = settings?.timezone || 'UTC';
        const dateKey = formatInTimeZone(startAt, tz, 'yyyy-MM-dd');

        const newLog: WorkLog = {
            id: uuidv4(),
            departmentId: deptId,
            workTypeId,
            detailTaskIds: detailIds,
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

    const stopTimer = async () => {
        if (!activeLog) return;

        const exactNow = Date.now();
        const endAt = applyRounding(exactNow);

        // Ensure end isn't before start due to rounding
        const finalEnd = Math.max(endAt, activeLog.startAt);
        const durationSec = (finalEnd - activeLog.startAt) / 1000;

        await db.workLogs.update(activeLog.id, {
            status: 'done',
            endAt: finalEnd,
            durationSec,
            updatedAt: Date.now()
        });
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
