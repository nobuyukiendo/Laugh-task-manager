import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '../lib/storage';
import { TrackerItem, TrackerLog } from '../lib/types';

export const useTracker = () => {
    const [items, setItems] = useState<TrackerItem[]>([]);
    const [activeLog, setActiveLog] = useState<TrackerLog | null>(null);
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    // Load initial data
    useEffect(() => {
        setItems(Storage.getItems());
        const logs = Storage.getLogs();
        const active = logs.find(log => log.endTime === null);
        if (active) {
            setActiveLog(active);
        }
    }, []);

    // Timer for active log
    useEffect(() => {
        let interval: any;
        if (activeLog) {
            // Calculate initial elapsed time
            setElapsedTime(Date.now() - activeLog.startTime);

            interval = setInterval(() => {
                setElapsedTime(Date.now() - activeLog.startTime);
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [activeLog]);

    const addItem = useCallback((name: string) => {
        const newItem: TrackerItem = {
            id: uuidv4(),
            name,
            totalDuration: 0,
            createdAt: Date.now(),
        };
        Storage.addItem(newItem);
        setItems(prev => [...prev, newItem]);
    }, []);

    const deleteItem = useCallback((id: string) => {
        if (activeLog && activeLog.itemId === id) {
            alert("Cannot delete item while it is active.");
            return;
        }
        Storage.deleteItem(id);
        setItems(prev => prev.filter(item => item.id !== id));
    }, [activeLog]);

    const startTracking = useCallback((itemId: string) => {
        if (activeLog) {
            // Prevent multiple active tasks (or auto-stop capability could be added here)
            return;
        }

        const newLog: TrackerLog = {
            id: uuidv4(),
            itemId,
            startTime: Date.now(),
            endTime: null,
            duration: 0,
        };

        Storage.addLog(newLog);
        setActiveLog(newLog);
    }, [activeLog]);

    const stopTracking = useCallback(() => {
        if (!activeLog) return;

        const endTime = Date.now();
        const duration = endTime - activeLog.startTime;

        const updatedLog: TrackerLog = {
            ...activeLog,
            endTime,
            duration,
        };

        Storage.updateLog(updatedLog);

        // Update item total duration
        const items = Storage.getItems();
        const itemIndex = items.findIndex(i => i.id === activeLog.itemId);
        if (itemIndex > -1) {
            items[itemIndex].totalDuration += duration;
            Storage.saveItems(items);
            setItems(items);
        }

        setActiveLog(null);
    }, [activeLog]);

    return {
        items,
        activeLog,
        elapsedTime,
        addItem,
        deleteItem,
        startTracking,
        stopTracking
    };
};
