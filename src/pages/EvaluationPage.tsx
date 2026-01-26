import React, { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { TrelloPanel } from '../components/evaluation/TrelloPanel';
import { WeeklyReportPanel } from '../components/evaluation/WeeklyReportPanel';
import { handleAuthReturn } from '../lib/trello-auth';

export const EvaluationPage: React.FC = () => {
    const { theme } = useTheme();
    const [authError, setAuthError] = useState<string | null>(null);

    // 初期化：認証後のtoken処理
    useEffect(() => {
        try {
            // Trelloからのリダイレクト等の特殊なケースに対応
            // trello-auth.ts の handleAuthReturn が内部でURL解析とクリーンアップを行う
            handleAuthReturn();
        } catch (error) {
            console.error('Trello auth error:', error);
            setAuthError('認証処理中にエラーが発生しました。再度連携を試みてください。');
        }
    }, []);

    return (
        <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
            {/* ヘッダー */}
            <header className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-[1920px] mx-auto px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => window.close()}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="閉じる"
                    >
                        <X size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 font-['Zen_Maru_Gothic']">
                        評価（Trello）
                    </h1>
                </div>
            </header>

            {/* 認証エラー表示（警告レベルとして表示） */}
            {authError && (
                <div className="max-w-[1920px] mx-auto p-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3">
                        <AlertTriangle className="text-amber-500" size={20} />
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{authError}</p>
                    </div>
                </div>
            )}

            {/* メインコンテンツ：2カラムレイアウト */}
            <main className="max-w-[1920px] mx-auto p-4 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto lg:h-[calc(100vh-100px)]">
                    {/* 左パネル：Trello */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-auto">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 font-['Zen_Maru_Gothic']">
                                    Trello評価カード
                                </h2>
                            </div>
                            <TrelloPanel />
                        </div>
                    </div>

                    {/* 右パネル：週報 */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-auto">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 font-['Zen_Maru_Gothic']">
                                    週報一覧
                                </h2>
                            </div>
                            <WeeklyReportPanel />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
