import Dexie, { Table } from 'dexie';

export interface Department {
    id: string;
    name: string;
    order: number;
    enabled: boolean;
}

export interface WorkType {
    id: string;
    name: string;
    order: number;
    enabled: boolean;
}

export interface DetailTask {
    id: string;
    workTypeId: string;
    name: string;
    order: number;
    enabled: boolean;
}

export interface RecentDetailTask {
    id: string;
    name: string;
    workTypeId: string;
    lastUsedAt: number;
}

export interface Partner {
    id: string;
    name: string;
    order: number;
    enabled: boolean;
}

export interface Location {
    id: string;
    name: string;
    order: number;
    enabled: boolean;
}

export type LogStatus = 'running' | 'done' | 'canceled';

export interface WorkLog {
    id: string;
    status: LogStatus;
    createdAt: number;
    updatedAt: number;
    timezone: string;
    dateKey: string; // YYYY-MM-DD in selected timezone

    departmentId: string;
    workTypeId: string;
    detailTaskIds: string[]; // Array of IDs (historical)
    detailTaskNames?: string[]; // Array of names (new, for non-volatile aggregation)

    note: string;
    startAt: number; // Timestamp
    endAt?: number;  // Timestamp

    durationSec: number; // Calculated duration

    // Google Calendar Sync Info
    calendar?: {
        synced: boolean;
        eventId?: string;
        lastSyncedAt?: number;
        lastSyncedHash?: string;
    };
}

export interface Settings {
    key: string; // 'config'
    timezone: string;
    rounding: number; // 0 (none), 1, 5, 10, 15
    weekStartsOnMonday: boolean;
    afterMeasurement: 'stay' | 'navigate'; // New setting
    calendar: {
        connected: boolean;
        accessToken?: string;
        refreshToken?: string;
        tokenExpiresAt?: number; // timestamp in ms
        codeVerifier?: string; // PKCE verifier
        selectedCalendarId?: string;
        eventTitleTemplate: string;
        lastSyncTime?: number;
    };
}

class AppDatabase extends Dexie {
    departments!: Table<Department, string>;
    workTypes!: Table<WorkType, string>;
    detailTasks!: Table<DetailTask, string>;
    recentDetailTasks!: Table<RecentDetailTask, string>;
    partners!: Table<Partner, string>;
    locations!: Table<Location, string>;
    workLogs!: Table<WorkLog, string>;
    settings!: Table<Settings, string>;

    constructor() {
        super('TimeTrackerDB');

        this.version(1).stores({
            departments: 'id, &name, order, enabled',
            workTypes: 'id, &name, order, enabled',
            detailTasks: 'id, workTypeId, name, order, enabled',
            workLogs: 'id, status, dateKey, departmentId, workTypeId, startAt, endAt',
            settings: 'key'
        });

        this.version(2).stores({
            recentDetailTasks: 'id, name, workTypeId, lastUsedAt',
            workLogs: 'id, status, dateKey, departmentId, workTypeId, startAt, endAt' // Re-listing is required by Dexie for updated stores
        });

        this.version(3).stores({
            partners: 'id, &name, order, enabled'
        });

        this.version(4).stores({
            locations: 'id, &name, order, enabled'
        });
    }
}

export const db = new AppDatabase();

// Initial data population
db.on('populate', async () => {
    await db.departments.bulkAdd([
        { id: 'dept-1', name: '【人材開発】', order: 1, enabled: true },
        { id: 'dept-2', name: '【全体共通】', order: 2, enabled: true },
        { id: 'dept-3', name: '【採用】', order: 3, enabled: true },
        { id: 'dept-4', name: '【PR】', order: 4, enabled: true },
        { id: 'dept-5', name: '【SNS】', order: 5, enabled: true },
        { id: 'dept-6', name: '【HP】', order: 6, enabled: true },
        { id: 'dept-7', name: '【ChatGPT】', order: 7, enabled: true },
        { id: 'dept-8', name: '【講座開発】', order: 8, enabled: true },
        { id: 'dept-9', name: '【広告開拓】', order: 9, enabled: true },
        { id: 'dept-10', name: '【イベント】', order: 10, enabled: true },
        { id: 'dept-11', name: '【HR】', order: 11, enabled: true },
        { id: 'dept-12', name: '【MA】', order: 12, enabled: true },
        { id: 'dept-13', name: '【インタビュー】', order: 13, enabled: true },
        { id: 'dept-14', name: '【営業事務】', order: 14, enabled: true },
    ]);

    await db.workTypes.bulkAdd([
        { id: 'wt-1', name: '【社内MTG】', order: 1, enabled: true },
        { id: 'wt-2', name: '【社内メッセージ】', order: 2, enabled: true },
        { id: 'wt-3', name: '【社内メッセージ確認】', order: 3, enabled: true },
        { id: 'wt-4', name: '【社内資料確認】', order: 4, enabled: true },
    ]);

    // Default Settings
    await db.settings.add({
        key: 'config',
        timezone: 'Asia/Tokyo',
        rounding: 1, // Default 1 min
        weekStartsOnMonday: true,
        calendar: {
            connected: false,
            eventTitleTemplate: '【{Department}】 {WorkType}'
        }
    });
});
