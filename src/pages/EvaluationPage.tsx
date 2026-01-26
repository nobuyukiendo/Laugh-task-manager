import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { TrelloPanel } from '../components/evaluation/TrelloPanel';
import { WeeklyReportPanel } from '../components/evaluation/WeeklyReportPanel';
import { handleAuthReturn } from '../lib/trello-auth';

export const EvaluationPage: React.FC = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [authError, setAuthError] = useState<string | null>(null);

    // 初期化：認証後のtoken処理
    useEffect(() => {
        try {
            // Trelloからのリダイレクト時、URLが #/evaluation&token=... になっているため
            // HashRouterが正しくルーティングできない
            // これを #/evaluation?token=... に修正する
            const currentHash = window.location.hash;
            if (currentHash.includes('&token=')) {
                // &token= を ?token= に置換
                const fixedHash = currentHash.replace('&token=', '?token=');
                window.location.hash = fixedHash;
                // URLが変わるため、次のレンダリングでhandleAuthReturnが実行される
                return;
            }

            const tokenProcessed = handleAuthReturn();
            if (tokenProcessed) {
                // token処理成功
                console.log('Trello token processed successfully');
            }
        } catch (error) {
            console.error('Trello auth error:', error);
            setAuthError('認証処理中にエラーが発生しました。再度連携してください。');
        }
    }, []);

    return (
        <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
            {/* ヘッダー */}
            <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-[1920px] mx-auto px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="戻る"
                    >
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 font-['Zen_Maru_Gothic']">
                        評価（Trello）
                    </h1>
                </div>
            </header>

            {/* 認証エラー表示 */}
            {authError && (
                <div className="max-w-[1920px] mx-auto p-4">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <p className="text-sm text-red-600 dark:text-red-400">{authError}</p>
                    </div>
                </div>
            )}

            {/* メインコンテンツ：2カラムレイアウト */}
            <main className="max-w-[1920px] mx-auto p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-88px)]">
                    {/* 左パネル：Trello */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-auto">
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">
                                Trello評価カード
                            </h2>
                            <TrelloPanel />
                        </div>
                    </div>

                    {/* 右パネル：週報 */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-auto">
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">
                                週報一覧
                            </h2>
                            <WeeklyReportPanel />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
