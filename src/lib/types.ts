export interface TrackerItem {
    id: string;
    name: string;
    totalDuration: number; // in milliseconds
    createdAt: number;
}

export interface TrackerLog {
    id: string;
    itemId: string;
    startTime: number;
    endTime: number | null;
    duration: number; // in milliseconds
}

export type Period = 'day' | 'month' | 'year' | 'all';
