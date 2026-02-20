
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
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    {!isEditing ? (
                        <button
                            onClick={startEditing}
                            className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Palette size={18} /> 配色を変更する
                        </button>
                    ) : (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-6 relative overflow-hidden">
                            {/* Eye Dropper Toggle */}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setEyeDropperActive(!isEyeDropperActive)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${isEyeDropperActive
                                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 scale-105'
                                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                        }`}
                                >
                                    <Pipette size={16} />
                                    {isEyeDropperActive ? '要素をクリックして選択中...' : 'スポイトで選択'}
                                </button>
                            </div>

                            {/* Color Pickers */}
                            <div className="space-y-4">
                                {(Object.entries(roleLabels) as [keyof ThemeRoleColors, string][]).map(([role, label]) => (
                                    <div
                                        key={role}
                                        className={`transition-all duration-300 p-3 rounded-xl ${focusedRole === role ? 'bg-cyan-100 dark:bg-cyan-900/30 ring-2 ring-cyan-500 scale-105' : ''}`}
                                    >
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                            {label}
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={editingColors?.[role] || '#000000'}
                                                onChange={(e) => updateEditingColor(role, e.target.value)}
                                                className="w-12 h-12 bg-transparent cursor-pointer rounded-lg border-0 p-0"
                                            />
                                            <input
                                                type="text"
                                                value={editingColors?.[role] || ''}
                                                onChange={(e) => updateEditingColor(role, e.target.value)}
                                                className="flex-1 py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={cancelEditing}
                                    className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <X size={18} /> キャンセル
                                </button>
                                <button
                                    onClick={saveEditing}
                                    className="flex-1 py-3 bg-cyan-500 text-white font-bold rounded-xl hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                                >
                                    <Save size={18} /> 保存する
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
