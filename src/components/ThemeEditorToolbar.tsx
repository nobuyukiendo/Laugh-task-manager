import React, { useEffect, useState } from 'react';
import { useTheme, ThemeRoleColors } from '../contexts/ThemeContext';
import { X, Pipette, Check } from 'lucide-react';

export const ThemeEditorToolbar: React.FC = () => {
    const {
        isEditing,
        saveEditing,
        cancelEditing,
        editingColors,
        updateEditingColor,
        isEyeDropperActive,
        setEyeDropperActive
    } = useTheme();

    const [focusedRole, setFocusedRole] = useState<keyof ThemeRoleColors | null>(null);

    // Listen to Eye Dropper auto-focus event
    useEffect(() => {
        const handleRoleSelect = (e: CustomEvent<{ role: keyof ThemeRoleColors }>) => {
            setFocusedRole(e.detail.role);
        };
        window.addEventListener('theme-role-selected' as any, handleRoleSelect as any);
        return () => window.removeEventListener('theme-role-selected' as any, handleRoleSelect as any);
    }, []);

    if (!isEditing || !editingColors) return null;

    const roleLabels: Record<keyof ThemeRoleColors, string> = {
        primary: 'メイン (Cyan)',
        accent: 'アクセント (Pink)',
        base: 'ベース (Slate)',
        bg: '背景色',
        surface: 'サーフェス',
        text: '文字色'
    };

    return (
        <div
            className="fixed z-[9999] top-4 right-4 flex flex-col items-end gap-2"
            data-no-eye-dropper="true"
            style={{ pointerEvents: 'auto' }}
        >
            {/* Status Bar */}
            <div className="bg-slate-900/95 backdrop-blur text-white px-4 py-2 rounded-full shadow-xl border-2 border-red-500 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-bold text-sm">カラー編集中</span>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button
                    onClick={() => setEyeDropperActive(!isEyeDropperActive)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${isEyeDropperActive
                            ? 'bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                >
                    <Pipette size={14} />
                    スポイト {isEyeDropperActive ? 'ON' : 'OFF'}
                </button>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button onClick={saveEditing} className="p-1.5 hover:bg-green-500/20 text-green-400 rounded-full transition-colors" title="保存して終了">
                    <Check size={18} />
                </button>
                <button onClick={cancelEditing} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-full transition-colors" title="キャンセル">
                    <X size={18} />
                </button>
            </div>

            {/* Color Palette */}
            <div className="bg-white/95 backdrop-blur border border-slate-300 p-2 rounded-xl shadow-2xl w-64 max-h-[80vh] overflow-y-auto">
                <div className="space-y-1">
                    {(Object.entries(roleLabels) as [keyof ThemeRoleColors, string][]).map(([role, label]) => {
                        const isFocused = focusedRole === role;
                        return (
                            <div
                                key={role}
                                className={`group p-2 rounded-lg transition-all cursor-pointer ${isFocused ? 'bg-cyan-50 ring-2 ring-cyan-500' : 'hover:bg-slate-50'
                                    }`}
                                onClick={() => setFocusedRole(role)}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-600">{label}</span>
                                    {isFocused && <span className="text-[10px] text-cyan-600 font-bold">選択中</span>}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={editingColors[role]}
                                        onChange={(e) => updateEditingColor(role, e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                                    />
                                    <input
                                        type="text"
                                        value={editingColors[role]}
                                        onChange={(e) => updateEditingColor(role, e.target.value)}
                                        className="flex-1 min-w-0 bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-700"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Instructions Overlay if Eye Dropper is ON */}
            {isEyeDropperActive && (
                <div className="bg-cyan-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none mt-1 animate-bounce">
                    画面上の変更したい場所をクリック
                </div>
            )}
        </div>
    );
};
