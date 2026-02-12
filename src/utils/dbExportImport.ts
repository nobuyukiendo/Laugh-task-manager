import { db } from '../db';


// Define the structure of the backup file
export interface BackupData {
    version: number; // DB version or App version
    timestamp: number;
    tables: {
        [tableName: string]: any[];
    };
}

// EXCLUDE_TABLES removed as it was unused and we decided to include everything.
// However, overwriting auth tokens might break current session if tokens are different. But data load is "Emergency Restore".
// User Requirements: "PCで使っていたアプリのデータを...ロードして完全に復元できる"
// "Google Login -> Load Button -> Overwrite Local".
// If we overwrite local `settings` with PC's settings, the `accessToken` might be old or invalid for the current session on Phone (if session-based).
// BUT new session token is in memory/settings?
// If we overwrite `settings` table, we lose the *current* valid token used to fetch the backup!
// CRITICAL: Restore process uses *current* token to fetch backup.
// If we overwrite `settings`, we might lose that token (if it's stored in DB).
// Actually, `useGoogleCalendar` stores token in `settings` table.
// So we must BE CAREFUL not to overwrite the *current* connection info with the *backup* connection info (which might be expired/different).
// Strategy:
// 1. Export: Include everything.
// 2. Import:
//    - Backup current `settings.calendar` (auth info).
//    - Clear DB.
//    - Import all tables.
//    - Restore `settings.calendar` (to keep current session alive).
//    Wait, user said "Fully Overwrite".
//    If I overwrite, the user is logged out?
//    "Re-login is fine" might be acceptable, but better UX is to keep the session.
//    Let's exclude `settings` from overwrite, OR merge it.
//    Actually, user said: "Cache clear -> Data Loss -> Restore".
//    In that case, `settings` are gone anyway.
//    But in "Phone Migration":
//    Phone has simple settings. PC has rich data.
//    We probably want to keep the *current* device's Auth state active.
//    Let's preserve `calendar` auth part of settings during import.

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
];

export const exportAllData = async (): Promise<string> => {
    const backup: BackupData = {
        version: 1,
        timestamp: Date.now(),
        tables: {}
    };

    await db.transaction('r', TABLE_NAMES.map(name => db.table(name)), async () => {
        for (const name of TABLE_NAMES) {
            const rows = await db.table(name).toArray();
            backup.tables[name] = rows;
        }
    });

    return JSON.stringify(backup);
};

export const importAllData = async (jsonString: string): Promise<void> => {
    const backup: BackupData = JSON.parse(jsonString);

    // 1. Capture current Auth state to preserve it
    const currentSettings = await db.settings.get('config');
    const currentAuth = currentSettings?.calendar;

    // 2. Clear and Import
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
        // We trust the *current* sessions over the backup's potentially expired session.
        if (currentAuth) {
            const importedSettings = await db.settings.get('config');
            if (importedSettings) {
                await db.settings.update('config', {
                    calendar: {
                        ...importedSettings.calendar, // Keep imported template settings etc.
                        connected: true, // Force connected if we were connected
                        accessToken: currentAuth.accessToken,
                        tokenExpiresAt: currentAuth.tokenExpiresAt,
                        refreshToken: currentAuth.refreshToken
                    }
                });
            } else {
                // If backup didn't have settings (weird), recreate basic
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
};
