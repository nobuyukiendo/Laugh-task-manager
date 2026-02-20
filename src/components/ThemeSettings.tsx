import React from 'react';
import { useTheme, ThemeType } from '../contexts/ThemeContext';
import { Palette, Check } from 'lucide-react';

export const ThemeSettings: React.FC = () => {
    const {
        activeThemeId,
        setTheme,
        customThemeData
    } = useTheme();

    const themes: { id: ThemeType; label: string; color: string }[] = [
        { id: 'light', label: 'ライト', color: '#f8fafc' },
        { id: 'dark', label: 'ダーク', color: '#0f172a' },
        { id: 'custom', label: 'カスタム', color: 'linear-gradient(135deg, #06b6d4, #ec4899)' },
    ];

    return (
        <div className="space-y-6">
            <h2
                className="text-xl font-bold text-main-text flex items-center gap-2"
                data-theme-role="text"
            >
                <Palette
                    className="text-primary"
                    data-theme-role="primary"
                />
                テーマ設定
            </h2>

            {/* Theme Selector */}
            <div className="grid grid-cols-3 gap-4">
                {themes.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${activeThemeId === t.id
                            ? 'border-primary bg-surface shadow-md'
                            : 'border-border bg-surface hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        data-theme-role="surface"
                    >
                        <div
                            className="w-12 h-12 rounded-full shadow-sm border border-border"
                            style={{ background: t.color }}
                        />
                        <span
                            className={`font-bold text-sm ${activeThemeId === t.id ? 'text-primary' : 'text-sub-text'}`}
                            data-theme-role={activeThemeId === t.id ? "primary" : "subText"}
                        >
                            {t.label}
                        </span>
                        {activeThemeId === t.id && (
                            <div className="absolute top-2 right-2 text-primary" data-theme-role="primary">
                                <Check size={16} strokeWidth={3} />
                            </div>
                        )}
                    </button>
                ))}
            </div>

            <div
                className="mt-8 bg-surface p-4 rounded-xl border border-border"
                data-theme-role="surface"
            >
                <h3
                    className="text-sm font-bold text-primary mb-2 flex items-center gap-2"
                    data-theme-role="primary"
                >
                    <span className="text-xl">🎨</span>
                    テーマのカスタマイズについて
                </h3>
                <p
                    className="text-sm text-sub-text leading-relaxed"
                    data-theme-role="subText"
                >
                    画面右上の「テーマ編集」ボタンから、選択中のテーマ（カスタム）を自由に編集できます。<br />
                    「簡易モード」ではベース色を選ぶだけで、自動的に美しい配色が生成されます。<br />
                    「詳細モード」ではパーツごとの色を細かく調整したり、画面上の要素をクリックして色を変更できる「スポイト機能」も利用可能です。
                </p>
            </div>
        </div>
    );
};
