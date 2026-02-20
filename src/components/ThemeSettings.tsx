
import React, { useEffect, useState } from 'react';
import { useTheme, ThemeType, ThemeRoleColors } from '../contexts/ThemeContext';
import { Palette, Check, Pipette, Save, X, RotateCcw } from 'lucide-react';

export const ThemeSettings: React.FC = () => {
    const {
        activeThemeId,
        setTheme,
        isEditing,
        startEditing,
        saveEditing,
        cancelEditing,
        editingColors,
        updateEditingColor,
        isEyeDropperActive,
        setEyeDropperActive,
        getCurrentColors
    } = useTheme();

    // Listen to Eye Dropper auto-focus event
    useEffect(() => {
        const handleRoleSelect = (e: CustomEvent<{ role: keyof ThemeRoleColors }>) => {
            // Highlight the picked role (UI feedback is handled by React state if we set focus or scroll to it)
            // For now, we just ensure it's visible or maybe flash it? 
            // The simple UI below is small enough.
            console.log('Selected role via dropper:', e.detail.role);
            // We could set a "focusedRole" state to highlight the picker.
            setFocusedRole(e.detail.role);
            setTimeout(() => setFocusedRole(null), 2000);
        };
        window.addEventListener('theme-role-selected' as any, handleRoleSelect as any);
        return () => window.removeEventListener('theme-role-selected' as any, handleRoleSelect as any);
    }, []);

    const [focusedRole, setFocusedRole] = useState<keyof ThemeRoleColors | null>(null);

    const themes: { id: ThemeType; label: string; color: string }[] = [
        { id: 'light', label: 'ライト', color: '#f8fafc' },
        { id: 'dark', label: 'ダーク', color: '#0f172a' },
        { id: 'custom1', label: 'カスタム', color: 'linear-gradient(135deg, #06b6d4, #ec4899)' },
    ];

    const roleLabels: Record<keyof ThemeRoleColors, string> = {
        primary: 'メインカラー (Cyan代用)',
        accent: 'アクセント (Pink代用)',
        base: 'ベースカラー (Slate代用)',
        bg: '背景色',
        surface: 'カード・サイドバー',
        text: '文字色'
    };

    const currentColors = getCurrentColors();

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Palette className="text-cyan-500" />
                テーマ設定
            </h2>

            {/* Theme Selector */}
            <div className="grid grid-cols-3 gap-4">
                {themes.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${activeThemeId === t.id
                            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <div
                            className="w-12 h-12 rounded-full shadow-sm border border-slate-200 dark:border-slate-600"
                            style={{ background: t.color }}
                        />
                        <span className={`font-bold text-sm ${activeThemeId === t.id ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`}>
                            {t.label}
                        </span>
                        {activeThemeId === t.id && (
                            <div className="absolute top-2 right-2 text-cyan-500">
                                <Check size={16} strokeWidth={3} />
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* Edit Panel (Only for Custom) */}
            {activeThemeId.startsWith('custom') && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300 mt-4">
                    {!isEditing ? (
                        <button
                            onClick={startEditing}
                            className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Palette size={18} /> 配色を変更する
                        </button>
                    ) : (
                        <div className="bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700 p-4 rounded-xl text-center">
                            <p className="text-cyan-800 dark:text-cyan-200 font-bold mb-2">
                                編集モード中
                            </p>
                            <p className="text-xs text-cyan-700 dark:text-cyan-300">
                                画面右上のツールバーを使って配色を調整してください。
                            </p>
                            <button
                                onClick={cancelEditing}
                                className="mt-3 text-xs underline text-cyan-600 dark:text-cyan-400 hover:text-cyan-800"
                            >
                                編集をキャンセル
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
