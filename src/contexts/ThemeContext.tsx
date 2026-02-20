
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../db';
import { useSettings } from './SettingsContext';

// Define the colors managed by the theme
export interface ThemeRoleColors {
    primary: string; // Base for Cyan replacement
    accent: string;  // Base for Pink replacement
    base: string;    // Base for Slate replacement
    bg: string;      // Background
    surface: string; // Cards/Surfaces
    text: string;    // Text
}

export type ThemeType = 'light' | 'dark' | 'custom1' | 'custom2';

interface ThemeContextType {
    activeThemeId: ThemeType;
    setTheme: (theme: ThemeType) => void;

    // Custom Theme Data
    customThemeData: Record<string, ThemeRoleColors>; // Keyed by 'custom1', 'custom2'

    // Editing State
    isEditing: boolean;
    startEditing: () => void;
    saveEditing: () => void;
    cancelEditing: () => void;

    // Live Edit Values
    editingColors: ThemeRoleColors | null;
    updateEditingColor: (role: keyof ThemeRoleColors, value: string) => void;

    // Eye Dropper State
    isEyeDropperActive: boolean;
    setEyeDropperActive: (active: boolean) => void;

    // Helper to get formatted value for UI
    getCurrentColors: () => ThemeRoleColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Default presets
const PRESET_LIGHT: ThemeRoleColors = {
    primary: '#06b6d4', // cyan-500
    accent: '#ec4899',  // pink-500
    base: '#64748b',    // slate-500
    bg: '#f8fafc',      // slate-50
    surface: '#ffffff', // white
    text: '#0f172a',    // slate-900
};

const PRESET_DARK: ThemeRoleColors = {
    primary: '#22d3ee', // cyan-400
    accent: '#f472b6',  // pink-400
    base: '#94a3b8',    // slate-400
    bg: '#0f172a',      // slate-900
    surface: '#1e293b', // slate-800
    text: '#f8fafc',    // slate-50
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Persistent State
    const [activeThemeId, setActiveThemeId] = useState<ThemeType>(() => {
        return (localStorage.getItem('theme_activeId') as ThemeType) || 'light';
    });

    const [customThemeData, setCustomThemeData] = useState<Record<string, ThemeRoleColors>>(() => {
        const saved = localStorage.getItem('theme_customData');
        return saved ? JSON.parse(saved) : {
            custom1: { ...PRESET_LIGHT },
            custom2: { ...PRESET_DARK }
        };
    });

    // Editing Temporary State
    const [isEditing, setIsEditing] = useState(false);
    const [editingColors, setEditingColors] = useState<ThemeRoleColors | null>(null);
    const [isEyeDropperActive, setEyeDropperActive] = useState(false);

    // Effect: Apply Theme to :root
    useEffect(() => {
        const root = document.documentElement;
        let colors = PRESET_LIGHT;

        // Determine source colors
        if (isEditing && editingColors) {
            colors = editingColors;
        } else {
            if (activeThemeId === 'light') colors = PRESET_LIGHT;
            else if (activeThemeId === 'dark') colors = PRESET_DARK;
            else colors = customThemeData[activeThemeId] || PRESET_LIGHT;
        }

        // Apply CSS Variables
        root.style.setProperty('--color-primary-base', colors.primary);
        root.style.setProperty('--color-accent-base', colors.accent);
        root.style.setProperty('--color-base-base', colors.base);
        root.style.setProperty('--color-bg-base', colors.bg);
        root.style.setProperty('--color-surface-base', colors.surface);
        root.style.setProperty('--color-text-base', colors.text);

        // Toggle .dark class for presets and custom base logic (simplification)
        // If background is dark, we should enable dark mode features like white text defaults?
        // For simplicity, we stick to: 'dark' preset = .dark class, others = based on brightness or selection?
        // User requirement: "Live edit".
        // Let's rely on standard .dark class toggling ONLY for 'dark' preset for now?
        // OR: Custom themes might want dark mode features.
        // Strategy: Calculate brightness of 'bg' to decide if we add 'dark' class?
        // Or just map explicit presets. User said: "Theme configuration: Light (fixed), Dark (fixed), Custom1...".
        // If Custom1 is based on Dark, it should have .dark class.
        // Let's try to detect darkness or just force .dark if activeThemeId === 'dark'.
        // Wait, if custom theme is dark-ish, we want tailwind `dark:` classes to fire?
        // Maybe we just let the variables handle it. 
        // BUT `dark:` classes are used extensively.
        // Simple Logic: If Theme is 'dark', use 'dark'. If Theme is 'custom' and bg is dark?
        // Let's assume Custom themes operate in "Light Mode DOM" but with changed colors?
        // No, that breaks `dark:bg-slate-900`.
        // Let's keep it simple: 'dark' preset gets 'dark' class. Others get removed 'dark' class.
        // Unless we add a setting "Base Mode: Light/Dark" for custom themes.
        // For now, let's treat Custom themes as running in "Light Mode" from Tailwind's perspective (no .dark class),
        // BUT they override the variables.
        // HOWEVER, `index.css` defines `.dark` overrides.
        // If we want Custom Theme to work, we need to set variables on `:root` which we are doing.
        // If we add `.dark`, it overrides `:root` variables in `index.css`.
        // So for custom themes, we must NOT have `.dark` class, OR we must set style on `html.dark` too?
        // Actually, style on `html` (root) overrides `.dark` selector specificity if inline style?
        // Inline style has high specificity.
        // So `root.style.setProperty` should win over `.dark` rule in CSS file.
        // So it doesn't matter if `.dark` class is present or not for the variables, 
        // BUT it matters for utility usage like `dark:text-white`.
        // If I make a dark custom theme, I probably want `dark:` utilities to activate?
        // Let's stick to: Light/Custom = No .dark class. Dark = .dark class.
        // IMPORTANT: The user said "Light/Dark are fixed presets".
        // If I select "Dark", I get standard Dark Mode.
        // If I select "Custom", I get Light Mode DOM but with MY colors.

        if (activeThemeId === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Persist
        localStorage.setItem('theme_activeId', activeThemeId);
        localStorage.setItem('theme_customData', JSON.stringify(customThemeData));

    }, [activeThemeId, customThemeData, isEditing, editingColors]);


    // Actions
    const setTheme = (theme: ThemeType) => {
        if (isEditing) {
            if (!confirm('編集中の変更は破棄されます。よろしいですか？')) return;
            cancelEditing();
        }
        setActiveThemeId(theme);
    };

    const startEditing = () => {
        if (activeThemeId === 'light' || activeThemeId === 'dark') return; // Cannot edit presets
        const current = customThemeData[activeThemeId];
        setEditingColors({ ...current });
        setIsEditing(true);
    };

    const updateEditingColor = (role: keyof ThemeRoleColors, value: string) => {
        if (!isEditing || !editingColors) return;
        setEditingColors(prev => prev ? ({ ...prev, [role]: value }) : null);
    };

    const saveEditing = () => {
        if (!isEditing || !editingColors) return;
        setCustomThemeData(prev => ({
            ...prev,
            [activeThemeId]: editingColors
        }));
        setIsEditing(false);
        setEditingColors(null);
        setEyeDropperActive(false);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditingColors(null);
        setEyeDropperActive(false);
    };

    const getCurrentColors = (): ThemeRoleColors => {
        if (isEditing && editingColors) return editingColors;
        if (activeThemeId === 'light') return PRESET_LIGHT;
        if (activeThemeId === 'dark') return PRESET_DARK;
        return customThemeData[activeThemeId] || PRESET_LIGHT;
    };

    // Eye Dropper Global Listener
    useEffect(() => {
        if (!isEyeDropperActive) return;

        const handleGlobalClick = (e: MouseEvent) => {
            // Prevent default action (navigation, etc.)
            e.preventDefault();
            e.stopPropagation();

            // Find closest element with data-theme-role
            const target = e.target as HTMLElement;
            const roleElement = target.closest('[data-theme-role]');

            if (roleElement) {
                const role = roleElement.getAttribute('data-theme-role') as keyof ThemeRoleColors;
                if (role) {
                    // Dispatch event or callback to notify SettingsPage to focus this role
                    // Since Context doesn't easily push "Focus UI" state, we can use a custom event
                    window.dispatchEvent(new CustomEvent('theme-role-selected', { detail: { role } }));
                }
            } else {
                // If clicked nowhere relevant, basic flash or nothing?
            }

            // Turn off dropper after pick? Or keep on?
            // "色選択モードがONの時のみ行う" implies it stays on.
            // Let's keep it on until user toggles off in UI.
        };

        // Use capture to strictly intercept before any react handlers
        window.addEventListener('click', handleGlobalClick, { capture: true });
        return () => window.removeEventListener('click', handleGlobalClick, { capture: true });
    }, [isEyeDropperActive]);

    return (
        <ThemeContext.Provider value={{
            activeThemeId,
            setTheme,
            customThemeData,
            isEditing,
            startEditing,
            saveEditing,
            cancelEditing,
            editingColors,
            updateEditingColor,
            isEyeDropperActive,
            setEyeDropperActive,
            getCurrentColors
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
};
