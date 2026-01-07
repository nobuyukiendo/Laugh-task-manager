import React, { createContext, useContext, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Settings } from '../db';

interface SettingsContextType {
    settings: Settings | undefined;
    updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultSettings: Settings = {
    key: 'config',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rounding: 1,
    weekStartsOnMonday: true,
    calendar: {
        connected: false,
        eventTitleTemplate: ''
    }
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const settings = useLiveQuery(async () => {
        const s = await db.settings.get('config');
        return s;
    });

    const updateSettings = async (part: Partial<Settings>) => {
        // If no settings exist yet, add the default settings first, then update
        if (!settings) {
            await db.settings.add(defaultSettings, 'config');
        }
        await db.settings.update('config', part);
    };

    return (
        <SettingsContext.Provider value={{
            settings,
            updateSettings,
            isLoading: !settings
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
