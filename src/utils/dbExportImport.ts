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
    'dailyMetrics',
    'crossFormulas',
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
            backup.tables[name] = await db.table(name).toArray();
        }
    });

    // 2. Export LocalStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            backup.localStorage[key] = localStorage.getItem(key) || '';
        }
    }

    return JSON.stringify(backup, null, 2);
};

export const importAllData = async (jsonString: string): Promise<void> => {
    const backup: BackupData = JSON.parse(jsonString);

    // 1. Import DB Tables
    await db.transaction('rw', TABLE_NAMES.map(name => db.table(name)), async () => {
        for (const name of TABLE_NAMES) {
            if (backup.tables[name]) {
                await db.table(name).clear();
                await db.table(name).bulkAdd(backup.tables[name]);
            }
        }
    });

    // 2. Import LocalStorage
    if (backup.localStorage) {
        for (const key in backup.localStorage) {
            localStorage.setItem(key, backup.localStorage[key]);
        }
    }
};
