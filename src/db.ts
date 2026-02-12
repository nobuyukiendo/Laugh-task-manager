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
        lastBackupAt?: number;
    };
}

export interface EmojiMaster {
    id: string;
    emoji: string; // 絵文字1文字
    order: number;
}

export interface SavedCard {
    id: string;
    name: string;      // カード名(ユーザーが入力)
    url: string;       // TrelloカードURL
    createdAt: number; // 作成日時
}

export interface Link {
    id: string;
    name: string;  // ボタン名
    url: string;   // リンク先URL
    order: number; // 表示順序
    icon?: string; // 追加: アイコン用の絵文字など
}

export interface LinkIcon {
    id: string;
    emoji: string;
    order: number;
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
    emojiMasters!: Table<EmojiMaster, string>;
    savedCards!: Table<SavedCard, string>;
    links!: Table<Link, string>;
    linkIcons!: Table<LinkIcon, string>;
    memoCards!: Table<MemoCard, string>;
    scheduleCards!: Table<ScheduleCard, string>;

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

        this.version(5).stores({
            emojiMasters: 'id, emoji, order'
        });

        this.version(6).stores({
            savedCards: 'id, name, url, createdAt'
        });

        this.version(7).stores({
            links: 'id, name, url, order'
        });

        this.version(8).stores({
            links: 'id, name, url, order, icon'
        });

        this.version(9).stores({
            linkIcons: 'id, emoji, order'
        });

        this.version(10).stores({
            memoCards: 'id, order, targetDate',
            scheduleCards: 'id, status, order'
        });

        this.version(11).stores({
            scheduleCards: 'id, status, order, isLocked'
        });
    }
}

export const db = new AppDatabase();

export interface MemoCard {
    id: string;
    title: string;
    body: string;
    targetDate?: string; // YYYY-MM-DD
    dueDate?: string;    // YYYY-MM-DD
    order: number;
    createdAt: number;
    updatedAt: number;
}

export interface ScheduleCard {
    id: string;
    title: string;
    deptId: string;
    workTypeId: string;
    detailTask: string;
    status: 'todo' | 'doing' | 'done';
    order: number;
    createdAt: number;
    updatedAt: number;
    runCount: number;
    lastStartedAt?: number;
    lastEndedAt?: number;
    lastHistoryId?: string;
    isLocked?: boolean;
}

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
        afterMeasurement: 'stay',
        calendar: {
            connected: false,
            eventTitleTemplate: '【{Department}】 {WorkType}'
        }
    });

    // Default Emoji Masters
    await db.emojiMasters.bulkAdd([
        { id: 'emoji-1', emoji: '✅', order: 1 },
        { id: 'emoji-2', emoji: '👀', order: 2 },
        { id: 'emoji-3', emoji: '🚧', order: 3 },
    ]);
});
