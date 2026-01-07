import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Timer, History, BarChart2, Settings, Menu, X, Database } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const Layout: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    const navItems = [
        { path: '/', label: '計測', icon: Timer },
        { path: '/timeline', label: '履歴', icon: History },
        { path: '/dashboard', label: '集計', icon: BarChart2 },
        { path: '/settings', label: '設定', icon: Settings },
        { path: '/master', label: 'マスタ', icon: Database },
    ];

    return (
        <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
            {/* Mobile Header */}
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-40 flex items-center justify-between px-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-50">
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 font-['Zen_Maru_Gothic']">
                        タスク管理表
                    </span>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-cyan-400 transition-colors border border-slate-200 dark:border-slate-700"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            {/* Sidebar Overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
            )}

            {/* Sidebar */}
            <aside
                style={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff' }}
                className={`fixed top-0 left-0 bottom-0 w-72 border-r border-slate-200 dark:border-slate-800 z-[100] transition-transform duration-300 ease-out shadow-2xl md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 font-['Zen_Maru_Gothic']">
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
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-medium ${location.pathname === item.path
                                ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                        >
                            <item.icon size={20} strokeWidth={2} />
                            <span className="font-['Zen_Maru_Gothic']">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="absolute bottom-4 left-4 right-4 md:flex hidden">
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium border border-slate-200 dark:border-slate-700"
                    >
                        {theme === 'dark' ? <><Sun size={18} /> Light Mode</> : <><Moon size={18} /> Dark Mode</>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main
                style={{ backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc' }}
                className={`transition-all duration-300 md:ml-72 min-h-screen`}
            >
                <div className="max-w-3xl mx-auto px-4 py-8 pt-20 md:pt-16 md:px-12 w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
