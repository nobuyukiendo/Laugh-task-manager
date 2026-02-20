import React, { createContext, useContext, useEffect, useState } from 'react';

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
    customThemeData: Record<string, ThemeRoleColors>;

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

// Helper: apply all CSS variables to :root
function applyColorsToRoot(colors: ThemeRoleColors) {
    const root = document.documentElement;
    root.style.setProperty('--color-primary-base', colors.primary);
    root.style.setProperty('--color-accent-base', colors.accent);
    root.style.setProperty('--color-base-base', colors.base);
    root.style.setProperty('--color-bg-base', colors.bg);
    root.style.setProperty('--color-surface-base', colors.surface);
    root.style.setProperty('--color-text-base', colors.text);

    // Also update legacy variables directly
    root.style.setProperty('--bg-primary', colors.bg);
    root.style.setProperty('--text-primary', colors.text);
    root.style.setProperty('--card-bg', colors.surface);
}

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
    const [isEyeDropperActive, setIsEyeDropperActive] = useState(false);

    // Wrapper to also handle disabling eye dropper when turning off
    const setEyeDropperActive = (active: boolean) => {
        setIsEyeDropperActive(active);
    };

    // Effect: Apply Theme to :root
    useEffect(() => {
        const root = document.documentElement;
        let colors: ThemeRoleColors;

        // Determine source colors
        if (isEditing && editingColors) {
            colors = editingColors;
        } else if (activeThemeId === 'light') {
            colors = PRESET_LIGHT;
        } else if (activeThemeId === 'dark') {
            colors = PRESET_DARK;
        } else {
            colors = customThemeData[activeThemeId] || PRESET_LIGHT;
        }

        // Apply CSS Variables via inline style (highest specificity, overrides all CSS rules)
        applyColorsToRoot(colors);

        // Toggle .dark class for Tailwind dark: utilities
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
        setIsEyeDropperActive(false);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditingColors(null);
        setIsEyeDropperActive(false);
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
            const target = e.target as HTMLElement;

            // CRITICAL: Check if click is inside a no-eye-dropper zone FIRST
            // This allows toolbar buttons (save, cancel, toggle) to work normally
            if (target.closest('[data-no-eye-dropper]')) {
                // Do NOT prevent default - let the click go through normally
                return;
            }

            // For all other clicks: prevent navigation/interaction and pick the role
            e.preventDefault();
            e.stopPropagation();

            // Find closest element with data-theme-role
            const roleElement = target.closest('[data-theme-role]');

            if (roleElement) {
                const role = roleElement.getAttribute('data-theme-role') as keyof ThemeRoleColors;
                if (role) {
                    window.dispatchEvent(new CustomEvent('theme-role-selected', { detail: { role } }));
                }
            }
        };

        // Use capture to intercept before React handlers
        document.addEventListener('click', handleGlobalClick, { capture: true });
        return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
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
