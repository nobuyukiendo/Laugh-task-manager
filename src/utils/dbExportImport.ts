import { db } from '../db';


// Define the structure of the backup file
export interface BackupData {
    version: number; // DB version or App version
    timestamp: number;
    tables: {
        [tableName: string]: any[];
    };
    localStorage: {
        [key: string]: string;
    };
}

// List of all table names in db
const TABLE_NAMES = [
    'departments',
    'workTypes',
    'detailTasks',
    'recentDetailTasks',
    'partners',
    'locations',
    'workLogs',
    'settings',
    'emojiMasters',
    'savedCards',
    'links',
    'linkIcons',
    'memoCards',
    'scheduleCards',
    'metricMasters',
    'metricHistories',
];

export const exportAllData = async (): Promise<string> => {
    const backup: BackupData = {
        version: 1,
        timestamp: Date.now(),
        tables: {},
        localStorage: {}
    };

    // 1. Export DB Tables
    await db.transaction('r', TABLE_NAMES.map(name => db.table(name)), async () => {
        for (const name of TABLE_NAMES) {
            const rows = await db.table(name).toArray();
            backup.tables[name] = rows;
        }
    });

    // 2. Export LocalStorage
    // We explicitly list prefixes and keys to back up to avoid polluting the backup with random extension data.
    const STORAGE_PREFIXES = [
        'weeklyReportEditorial_',
        'trello.'
    ];
    const STORAGE_KEYS = [
        'dailyComments',
        'deptColorMapping',
        'dashboardPeriod',
        'defaultDeptId',
        'links_form_expanded',
        'app_theme',
        'position_order',
        'last_selected_position',
        'theme_activeId',
        'theme_customData'
    ];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const shouldBackup =
            STORAGE_KEYS.includes(key) ||
            STORAGE_PREFIXES.some(prefix => key.startsWith(prefix));

        if (shouldBackup) {
            const value = localStorage.getItem(key);
            if (value !== null) {
                backup.localStorage[key] = value;
            }
        }
    }

    return JSON.stringify(backup);
};

export const importAllData = async (jsonString: string): Promise<void> => {
    const backup: BackupData = JSON.parse(jsonString);

    // 1. Capture current Auth state to preserve it
    const currentSettings = await db.settings.get('config');
    const currentAuth = currentSettings?.calendar;

    // 2. Clear and Import DB
    await db.transaction('rw', TABLE_NAMES.map(name => db.table(name)), async () => {
        // Clear all tables
        for (const name of TABLE_NAMES) {
            await db.table(name).clear();
        }

        // Bulk Add
        for (const name of TABLE_NAMES) {
            if (backup.tables[name]) {
                await db.table(name).bulkAdd(backup.tables[name]);
            }
        }

        // 3. Restore Auth State if it existed (Override imported auth)
        if (currentAuth) {
            const importedSettings = await db.settings.get('config');
            if (importedSettings) {
                await db.settings.update('config', {
                    calendar: {
                        ...importedSettings.calendar,
                        connected: true,
                        accessToken: currentAuth.accessToken,
                        tokenExpiresAt: currentAuth.tokenExpiresAt,
                        refreshToken: currentAuth.refreshToken
                    }
                });
            } else {
                await db.settings.add({
                    key: 'config',
                    timezone: 'Asia/Tokyo',
                    rounding: 1,
                    weekStartsOnMonday: true,
                    afterMeasurement: 'stay',
                    calendar: currentAuth
                });
            }
        }
    });

    // 3. Import LocalStorage
    if (backup.localStorage) {
        Object.entries(backup.localStorage).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
    }
};
