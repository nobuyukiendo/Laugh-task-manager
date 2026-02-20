import { ThemeRoleColors } from '../contexts/ThemeContext';

export const PRESET_LIGHT: ThemeRoleColors = {
    primary: '#06b6d4',    // cyan-500
    accent: '#ec4899',     // pink-500
    bg: '#f8fafc',         // slate-50
    surface: '#ffffff',    // white
    text: '#0f172a',       // slate-900
    subText: '#64748b',    // slate-500
    border: '#e2e8f0',     // slate-200
    inputBg: '#f8fafc',    // slate-50
    inputText: '#0f172a',  // slate-900
    buttonBg: '#f1f5f9',   // slate-100
    buttonText: '#475569', // slate-600
    icon: '#64748b',       // slate-500
    badgeDept: '#f1f5f9',  // light gray
    badgeWorkType: '#64748b', // same as subText (slate-500)
    badgeDetail: '#f1f5f9', // same as work type or dept
    base: '#64748b',       // slate-500 (Legacy)
};

export const PRESET_DARK: ThemeRoleColors = {
    primary: '#22d3ee',    // cyan-400
    accent: '#f472b6',     // pink-400
    bg: '#020617',         // slate-950
    surface: '#0f172a',    // slate-900
    text: '#f8fafc',       // slate-50
    subText: '#94a3b8',    // slate-400
    border: '#334155',     // slate-700
    inputBg: '#1e293b',    // slate-800
    inputText: '#f8fafc',  // slate-50
    buttonBg: '#1e293b',   // slate-800
    buttonText: '#94a3b8', // slate-400
    icon: '#94a3b8',       // slate-400
    badgeDept: '#1e293b',  // slate-800
    badgeWorkType: '#94a3b8', // same as subText (slate-400)
    badgeDetail: '#1e293b', // same as dept
    base: '#94a3b8',       // slate-400 (Legacy)
};
