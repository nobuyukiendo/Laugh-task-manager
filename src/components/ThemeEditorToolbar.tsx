import React, { useEffect, useState } from 'react';
import { useTheme, ThemeRoleColors } from '../contexts/ThemeContext';
import { X, Check, Palette, Wand2, Layers, RotateCcw, Pipette } from 'lucide-react';
import { generateTheme } from '../utils/themeGenerator';
import { PRESET_LIGHT, PRESET_DARK } from '../theme/presets';

export const ThemeEditorToolbar: React.FC = () => {
    const {
        isEditing,
        startEditing,
        saveEditing,
        cancelEditing,
        editingColors,
        updateEditingColor,
        isEyeDropperActive,
        setEyeDropperActive,
        activeThemeId
    } = useTheme();

    const [focusedRole, setFocusedRole] = useState<keyof ThemeRoleColors | null>(null);
    const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
    const [editMode, setEditMode] = useState<'simple' | 'detailed'>('detailed');
    const [baseColorInput, setBaseColorInput] = useState<string>('#000000');

    // Sync base color input with primary or bg when starting
    useEffect(() => {
        if (editingColors) {
            setBaseColorInput(editingColors.bg || '#f8fafc');
        }
    }, [isEditing, editingColors]);

    // Listen to Eye Dropper selected event
    useEffect(() => {
        const handleRoleSelect = (e: CustomEvent<{ role: keyof ThemeRoleColors }>) => {
            const role = e.detail.role;
            setFocusedRole(role);

            // Switch to detailed if in simple mode
            if (editMode === 'simple') setEditMode('detailed');

            // Auto-scroll to the selected role item
            setTimeout(() => {
                const element = document.getElementById(`theme-editor-role-${role}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        };
        window.addEventListener('theme-role-selected' as any, handleRoleSelect as any);
        return () => window.removeEventListener('theme-role-selected' as any, handleRoleSelect as any);
    }, [editMode]);

    // Hover Highlighter Logic
    useEffect(() => {
        if (!isEyeDropperActive) {
            setHighlightRect(null);
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-no-eye-dropper]')) {
                setHighlightRect(null);
                return;
            }
            const roleElement = target.closest('[data-theme-role]');
            if (roleElement) {
                setHighlightRect(roleElement.getBoundingClientRect());
            } else {
                setHighlightRect(null);
            }
        };

        const handleScroll = () => setHighlightRect(null);

        document.addEventListener('mousemove', handleMouseMove, { capture: true });
        window.addEventListener('scroll', handleScroll, { capture: true });
        return () => {
            document.removeEventListener('mousemove', handleMouseMove, { capture: true });
            window.removeEventListener('scroll', handleScroll, { capture: true });
        };
    }, [isEyeDropperActive]);


    if (!isEditing || !editingColors) {
        if (activeThemeId !== 'custom') return null;
        return (
            <div
                className="fixed z-[9999] top-4 right-4 animate-in fade-in slide-in-from-right-4"
                data-no-eye-dropper="true"
            >
                <button
                    onClick={startEditing}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-full shadow-lg hover:shadow-cyan-500/20 transition-all font-bold group"
                >
                    <Palette size={18} className="group-hover:rotate-12 transition-transform" />
                    テーマを編集
                </button>
            </div>
        );
    }

    const handleAutoGenerate = () => {
        if (!confirm('現在の設定を上書きして、ベース色からパレットを自動生成しますか？')) return;

        // Mode argument is ignored by new logic in favor of base color brightness, but we pass valid type.
        const generated = generateTheme(baseColorInput, 'light');

        // Apply all
        (Object.entries(generated) as [keyof ThemeRoleColors, string][]).forEach(([key, val]) => {
            updateEditingColor(key as keyof ThemeRoleColors, val);
        });
    };

    const handleLoadPreset = (preset: 'light' | 'dark') => {
        if (!confirm(`デフォルトの${preset === 'light' ? 'Light' : 'Dark'}テーマを読み込みますか？`)) return;
        const targetPreset = preset === 'light' ? PRESET_LIGHT : PRESET_DARK;
        (Object.entries(targetPreset) as [keyof ThemeRoleColors, string][]).forEach(([key, val]) => {
            updateEditingColor(key as keyof ThemeRoleColors, val);
        });
    };

    const groups = [
        {
            title: '基本カラー',
            roles: [
                { key: 'primary', label: 'プライマリ' },
                { key: 'accent', label: 'アクセント' },
                { key: 'icon', label: 'アイコン' },
            ]
        },
        {
            title: '背景・ベース',
            roles: [
                { key: 'bg', label: '背景 (Main)' },
                { key: 'surface', label: 'サーフェス (Card)' },
                { key: 'border', label: '枠線 (Border)' },
            ]
        },
        {
            title: '文字・バッジ',
            roles: [
                { key: 'text', label: '基本文字 (Main)' },
                { key: 'subText', label: '補足文字 (Sub)' },
                { key: 'badgeDept', label: '履歴:部門名' },
                { key: 'badgeWorkType', label: '履歴:作業種別' },
                { key: 'badgeDetail', label: '履歴:作業詳細' },
            ]
        },
        {
            title: '入力欄・ボタン',
            roles: [
                { key: 'inputBg', label: '入力欄背景' },
                { key: 'inputText', label: '入力欄文字' },
                { key: 'buttonBg', label: 'ボタン背景' },
                { key: 'buttonText', label: 'ボタン文字' },
            ]
        }
    ];

    return (
        <div
            className="fixed z-[9999] top-4 right-4 flex flex-col items-end gap-2"
            data-no-eye-dropper="true"
            style={{ pointerEvents: 'auto' }}
        >
            {/* Highlighter Overlay */}
            {highlightRect && isEyeDropperActive && (
                <div
                    className="fixed pointer-events-none z-[10000] border-2 border-cyan-500 bg-cyan-500/20 rounded animate-pulse"
                    style={{
                        top: highlightRect.top,
                        left: highlightRect.left,
                        width: highlightRect.width,
                        height: highlightRect.height,
                    }}
                />
            )}

            {/* Status Bar */}
            <div className="bg-slate-900/95 backdrop-blur text-white px-4 py-2 rounded-full shadow-xl border-2 border-cyan-500 flex items-center gap-3">
                <div className="flex items-center gap-2 mr-2">
                    <Palette size={16} className="text-cyan-400" />
                    <span className="font-bold text-sm">テーマ編集</span>
                </div>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button
                    onClick={saveEditing}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-full text-xs font-bold transition-colors"
                    title="保存して終了"
                >
                    <Check size={14} /> 保存
                </button>
                <button
                    onClick={cancelEditing}
                    className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-full transition-colors"
                    title="キャンセル"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Main Panel */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-300 dark:border-slate-700 p-3 rounded-xl shadow-2xl w-72 max-h-[80vh] overflow-y-auto flex flex-col gap-4">

                {/* Mode Tabs */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setEditMode('simple')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${editMode === 'simple'
                            ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        <Wand2 size={14} /> 簡易
                    </button>
                    <button
                        onClick={() => setEditMode('detailed')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${editMode === 'detailed'
                            ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        <Layers size={14} /> 詳細
                    </button>
                </div>

                {/* Simple Mode UI */}
                {editMode === 'simple' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">背景色を選択 (Background)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={baseColorInput}
                                    onChange={(e) => setBaseColorInput(e.target.value)}
                                    className="w-12 h-12 rounded cursor-pointer border-0 p-0"
                                />
                                <div className="flex-1">
                                    <div className="text-xs font-mono mb-1">{baseColorInput}</div>
                                    <div className="text-[10px] text-slate-400">
                                        この色を元に全配色を<br />自動生成します
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleAutoGenerate}
                            className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Wand2 size={16} /> 自動生成を適用
                        </button>
                        <p className="text-[10px] text-center text-slate-400">
                            ※適用後、詳細タブで微調整できます
                        </p>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">プリセットから読込</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleLoadPreset('light')}
                                    className="flex items-center justify-center gap-1.5 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                                >
                                    <RotateCcw size={12} /> Light
                                </button>
                                <button
                                    onClick={() => handleLoadPreset('dark')}
                                    className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors"
                                >
                                    <RotateCcw size={12} /> Dark
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detailed Mode UI */}
                {editMode === 'detailed' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <button
                            onClick={() => setEyeDropperActive(!isEyeDropperActive)}
                            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border ${isEyeDropperActive
                                ? 'bg-cyan-500 border-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            <Pipette size={14} />
                            スポイト {isEyeDropperActive ? 'ON (クリックで選択)' : 'OFF'}
                        </button>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                            {groups.map((group, groupIndex) => (
                                <div key={groupIndex}>
                                    <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">
                                        {group.title}
                                    </h3>
                                    <div className="space-y-1">
                                        {group.roles.map((item) => {
                                            const role = item.key as keyof ThemeRoleColors;
                                            const isFocused = focusedRole === role;
                                            const colorValue = editingColors[role] || '#000000';

                                            return (
                                                <div
                                                    key={role}
                                                    id={`theme-editor-role-${role}`}
                                                    className={`group p-2 rounded-lg transition-all cursor-pointer border ${isFocused
                                                        ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500 ring-1 ring-cyan-500'
                                                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                                                        }`}
                                                    onClick={() => {
                                                        setFocusedRole(role);
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className={`text-xs font-bold ${isFocused ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                                            {item.label}
                                                        </span>
                                                        {isFocused && <span className="text-[10px] text-cyan-600 font-bold">選択中</span>}
                                                    </div>
                                                    <div className="flex gap-2 items-center">
                                                        <div className="relative w-8 h-8 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-200 dark:ring-slate-700 shrink-0">
                                                            <input
                                                                type="color"
                                                                value={colorValue}
                                                                onChange={(e) => updateEditingColor(role, e.target.value)}
                                                                className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer p-0 border-0"
                                                            />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={colorValue}
                                                            onChange={(e) => updateEditingColor(role, e.target.value)}
                                                            className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-700 dark:text-slate-200 uppercase"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Instructions Overlay if Eye Dropper is ON */}
            {isEyeDropperActive && (
                <div className="bg-cyan-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none mt-1 animate-bounce">
                    画面上の変更したい場所をクリック
                    <br /><span className="text-[10px] opacity-80">(枠線が表示される場所のみ選択可能)</span>
                </div>
            )}
        </div>
    );
};
