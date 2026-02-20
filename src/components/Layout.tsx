import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Sun, Moon, Timer, History, BarChart2, Settings, Menu, X, Database, HelpCircle, ClipboardCheck, ExternalLink, StickyNote, Calendar, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

import { ThemeEditorToolbar } from './ThemeEditorToolbar';

export const Layout: React.FC = () => {
    const { activeThemeId, setTheme } = useTheme();

    // Simple toggle for the header button (cycles Light/Dark, ignores custom for this button or switches to nearest?)
    // User Requirement: "Reviewing existing one-button toggle... maintain current behavior"
    // Current behavior: Toggles Light/Dark.
    // If Custom is active, what should it do? Probably switch to the "other" base or just default to Light/Dark.
    // Let's make it toggle Light <-> Dark.
    const toggleTheme = () => {
        setTheme(activeThemeId === 'dark' ? 'light' : 'dark');
    };

    const isDark = activeThemeId === 'dark'; // Or custom dark? Simplicity: depends on ID for now.

    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    const navItems = [
        { path: '/', label: '計測', icon: Timer },
        { path: '/schedule', label: 'スケジュール', icon: Calendar },
        { path: '/memo', label: 'メモ', icon: StickyNote },
        { path: '/timeline', label: '履歴', icon: History },
        { path: '/dashboard', label: '集計', icon: BarChart2 },
        { path: '/evaluation', label: '評価（Trello）', icon: ClipboardCheck },
        { path: '/links', label: 'リンク', icon: ExternalLink },
        { path: '/settings', label: '設定', icon: Settings },
        { path: '/master', label: 'マスタ', icon: Database },
        { path: '/help', label: 'ヘルプ', icon: HelpCircle },
    ];

    return (
        <div
            className="min-h-screen transition-colors duration-300 bg-background text-main-text"
            data-theme-role="bg"
        >
            <ThemeEditorToolbar />
            {/* Mobile Header */}
            <div
                className="md:hidden fixed top-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-40 flex items-center justify-between px-4 shadow-sm"
                data-theme-role="surface"
            >
                <div className="flex items-center gap-4">
                    <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-icon hover:opacity-80 rounded-full transition-colors z-50" data-theme-role="icon">
                        <Menu size={24} />
                    </button>
                    <span
                        className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 font-['Zen_Maru_Gothic']"
                        data-theme-role="primary"
                    >
                        タスク管理表
                    </span>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full bg-button-bg text-button-text transition-colors border border-border"
                    data-theme-role="buttonBg"
                >
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            {/* Sidebar Overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 bottom-0 w-72 bg-surface border-r border-slate-200 dark:border-slate-800 z-[100] transition-transform duration-300 ease-out shadow-2xl md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
                data-theme-role="surface"
            >
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
                    <span
                        className="font-bold text-xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 font-['Zen_Maru_Gothic']"
                        data-theme-role="primary"
                    >
                        タスク管理表
                    </span>
                    <button onClick={() => setMobileOpen(false)} className="md:hidden p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <nav className="p-4 space-y-2">
                    {navItems.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            target={item.path === '/evaluation' ? '_blank' : undefined}
                            rel={item.path === '/evaluation' ? 'noopener noreferrer' : undefined}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-medium ${location.pathname === item.path
                                ? 'bg-cyan-50 dark:bg-cyan-900/10 text-primary shadow-sm'
                                : 'text-sub-text hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-main-text'
                                }`}
                            data-theme-role={location.pathname === item.path ? "primary" : "subText"}
                        >
                            <item.icon size={20} strokeWidth={2} />
                            <span className="font-['Zen_Maru_Gothic']">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="absolute bottom-4 left-4 right-4 md:flex hidden">
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-button-bg text-button-text hover:opacity-90 transition-colors font-medium border border-border"
                        data-theme-role="buttonBg"
                    >
                        {isDark ? <><Sun size={18} /> Light Mode</> : <><Moon size={18} /> Dark Mode</>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main
                className={`transition-all duration-300 md:ml-72 min-h-screen`}
            >
                <div className="max-w-3xl mx-auto px-4 py-8 pt-20 md:pt-16 md:px-12 w-full">
                    <DataRecoveryBanner />
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

const DataRecoveryBanner: React.FC = () => {
    const logCount = useLiveQuery(async () => {
        return await db.workLogs.count();
    });

    // Don't show if loading or if there is data
    if (typeof logCount === 'undefined' || logCount > 0) return null;

    return (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
                <AlertTriangle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
                <div className="space-y-1">
                    <p className="font-bold text-blue-800 dark:text-blue-200 text-sm">
                        データがありません
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                        初回利用の方はそのままお使いください。<br />
                        もしデータが消えてしまった場合は、Google Driveから復元できます。
                    </p>
                    <Link
                        to="/settings"
                        className="inline-block mt-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        → 設定画面で復元する
                    </Link>
                </div>
            </div>
        </div>
    );
};
