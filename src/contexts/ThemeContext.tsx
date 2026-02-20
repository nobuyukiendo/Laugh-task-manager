import React, { createContext, useContext, useEffect, useState } from 'react';

// Define the colors managed by the theme
export interface ThemeRoleColors {
    primary: string;    // Brand/Action (Cyan)
    accent: string;     // Highlight (Pink)
    bg: string;         // App Background
    surface: string;    // Card/Sidebar Background
    text: string;       // Main Text
    subText: string;    // Secondary Text (Label/Date)
    border: string;     // Borders/Dividers
    inputBg: string;    // Input Field Background
    inputText: string;  // Input Field Text
    buttonBg: string;   // Secondary Button Background
    buttonText: string; // Secondary Button Text
    icon: string;       // Default Icon Color
    badgeDept: string;    // Department Badge in History
    badgeWorkType: string; // Work Type Badge in History
    badgeDetail: string;   // Detailed Task Badge in History
    base: string;       // Legacy Base (Slate) - Keeps strictly for unmigrated gray scales if any
}

export type ThemeType = 'light' | 'dark' | 'custom';

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
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

import { PRESET_LIGHT, PRESET_DARK } from '../theme/presets';

// Helper: get luminance from hex color (0 to 1)
function getLuminance(hex: string): number {
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
    if (cleanHex.length !== 6) return 1; // Fallback to light if invalid

    const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
    const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
    const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

    const a = [r, g, b].map(v => {
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// Helper: apply all CSS variables to :root
function applyColorsToRoot(colors: ThemeRoleColors) {
    const root = document.documentElement;
    root.style.setProperty('--color-primary-base', colors.primary);
    root.style.setProperty('--color-accent-base', colors.accent);
    root.style.setProperty('--color-base-base', colors.base);
    root.style.setProperty('--color-bg-base', colors.bg);
    root.style.setProperty('--color-surface-base', colors.surface);
    root.style.setProperty('--color-text-base', colors.text);

    // New 12-param roles
    root.style.setProperty('--color-text-sub', colors.subText || colors.base);
    root.style.setProperty('--color-border-base', colors.border || colors.base);
    root.style.setProperty('--color-input-bg', colors.inputBg || colors.bg); // Fallback to bg if missing
    root.style.setProperty('--color-input-text', colors.inputText || colors.text);
    root.style.setProperty('--color-button-bg', colors.buttonBg || colors.base);
    root.style.setProperty('--color-button-text', colors.buttonText || colors.text);
    root.style.setProperty('--color-icon-base', colors.icon || colors.accent);
    root.style.setProperty('--color-badge-dept', colors.badgeDept || colors.surface);
    root.style.setProperty('--color-badge-worktype', colors.badgeWorkType || colors.inputBg);
    root.style.setProperty('--color-badge-detail', colors.badgeDetail || colors.inputBg);

    // Also update legacy variables directly
    root.style.setProperty('--bg-primary', colors.bg);
    root.style.setProperty('--text-primary', colors.text);
    root.style.setProperty('--card-bg', colors.surface);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Persistent State
    const [activeThemeId, setActiveThemeId] = useState<ThemeType>(() => {
        const saved = localStorage.getItem('theme_activeId');
        if (saved === 'custom1' || saved === 'custom2') return 'custom';
        return (saved as ThemeType) || 'light';
    });

    const [customThemeData, setCustomThemeData] = useState<Record<string, ThemeRoleColors>>(() => {
        const saved = localStorage.getItem('theme_customData');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Migration: Take custom1 as default custom if available, else custom2, else preset
                const migratedCustom = parsed.custom || parsed.custom1 || parsed.custom2 || PRESET_LIGHT;
                return {
                    custom: { ...PRESET_LIGHT, ...migratedCustom }
                };
            } catch (e) {
                console.error('Failed to parse saved theme data', e);
            }
        }
        return {
            custom: { ...PRESET_LIGHT }
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

    const [isDark, setIsDark] = useState(activeThemeId === 'dark');

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
            colors = customThemeData.custom || PRESET_LIGHT;
        }

        // Apply CSS Variables via inline style (highest specificity, overrides all CSS rules)
        applyColorsToRoot(colors);

        // Calculate and Toggle .dark class for Tailwind dark: utilities
        let shouldBeDark = activeThemeId === 'dark';
        if (activeThemeId === 'custom') {
            const luminance = getLuminance(colors.bg || colors.surface);
            shouldBeDark = luminance < 0.5;
        }

        setIsDark(shouldBeDark);

        if (shouldBeDark) {
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
        const current = customThemeData.custom || PRESET_LIGHT;
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
        return customThemeData.custom || PRESET_LIGHT;
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
        document.addEventListener('mousedown', handleGlobalClick, { capture: true }); // Also capture mousedown to prevent focus/active states
        return () => {
            document.removeEventListener('click', handleGlobalClick, { capture: true });
            document.removeEventListener('mousedown', handleGlobalClick, { capture: true });
        };
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
            getCurrentColors,
            isDark
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
