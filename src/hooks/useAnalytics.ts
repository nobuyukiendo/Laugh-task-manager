import { useState, useMemo, useEffect } from 'react';
import { Storage } from '../lib/storage';
import { TrackerItem, TrackerLog, Period } from '../lib/types';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';

export const useAnalytics = () => {
    const [items, setItems] = useState<TrackerItem[]>([]);
    const [logs, setLogs] = useState<TrackerLog[]>([]);
    const [period, setPeriod] = useState<Period>('day');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    useEffect(() => {
        setItems(Storage.getItems());
        setLogs(Storage.getLogs());
    }, []);

    const stats = useMemo(() => {
        // Filter logs based on period
        const filteredLogs = logs.filter(log => {
            // Ignore active logs (endTime is null) for stats to avoid skewing with partial data, 
            // or we could include if we want real-time stats. Let's exclude for now as duration is final only on stop.
            if (!log.endTime) return false;

            const logDate = new Date(log.startTime);
            switch (period) {
                case 'day':
                    return isSameDay(logDate, selectedDate);
                case 'month':
                    return isSameMonth(logDate, selectedDate);
                case 'year':
                    return isSameYear(logDate, selectedDate);
                case 'all':
                    return true;
                default:
                    return true;
            }
        });

        const totalDuration = filteredLogs.reduce((acc, log) => acc + log.duration, 0);

        const itemStats = items.map(item => {
            const duration = filteredLogs
                .filter(log => log.itemId === item.id)
                .reduce((acc, log) => acc + log.duration, 0);
            return {
                ...item,
                duration,
                percentage: totalDuration > 0 ? (duration / totalDuration) * 100 : 0
            };
        }).sort((a, b) => b.duration - a.duration);

        return {
            totalDuration,
            itemStats,
            filteredLogs // Useful for charts later if we want timeseries
        };
    }, [items, logs, period, selectedDate]);

    return {
        period,
        setPeriod,
        selectedDate,
        setSelectedDate,
        stats
    };
};
