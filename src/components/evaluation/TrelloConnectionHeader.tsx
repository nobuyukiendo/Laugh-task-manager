import React, { useState, useEffect } from 'react';
import { Link2, Link2Off, ExternalLink, Loader2, Bookmark, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import {
    initTrelloAuth,
    getTrelloToken,
    clearTrelloToken,
    isTrelloTokenValid,
} from '../../lib/trello-auth';
import type { TrelloCard } from '../../types/trello-types';

interface TrelloConnectionHeaderProps {
    onCardLoaded: (card: TrelloCard) => void;
    currentCard: TrelloCard | null;
}

export const TrelloConnectionHeader: React.FC<TrelloConnectionHeaderProps> = ({
    onCardLoaded,
    currentCard,
}) => {
    const [isConnected, setIsConnected] = useState(false);
    const [cardUrl, setCardUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [cardName, setCardName] = useState('');

    // 保存したカードを取得
    const savedCards = useLiveQuery(() => db.savedCards.orderBy('createdAt').reverse().toArray(), []);

    // 初期化:トークンの有効性チェック
    useEffect(() => {
        setIsConnected(isTrelloTokenValid());

        // ポップアップからの通知を受け取る(定期的にチェック)
        const interval = setInterval(() => {
            const newState = isTrelloTokenValid();
            if (newState !== isConnected) {
                setIsConnected(newState);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isConnected]);

    const handleConnect = () => {
        try {
            initTrelloAuth('30days');
        } catch (err) {
            setError(err instanceof Error ? err.message : '認証エラーが発生しました');
        }
    };

    const handleDisconnect = () => {
        clearTrelloToken();
        setIsConnected(false);
        setError(null);
    };

    const handleLoadCard = async () => {
        if (!cardUrl.trim()) {
            setError('カードURLを入力してください');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const token = getTrelloToken();
            if (!token) {
                setError('Trelloと連携してください');
                setIsLoading(false);
                return;
            }

            const { getCardByUrl } = await import('../../lib/trello-api');
            const card = await getCardByUrl(cardUrl, token);
            onCardLoaded(card);
        } catch (err: any) {
            if (err.status === 401 || err.status === 403) {
                handleDisconnect();
                setError('認証の有効期限が切れました。再度連携してください。');
            } else {
                setError(err.message || 'カードの読み込みに失敗しました');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // 保存したカードを選択
    const handleSelectSavedCard = (url: string) => {
        setCardUrl(url);
    };

    // カードを保存
    const handleSaveCard = async () => {
        if (!currentCard || !cardName.trim()) return;

        await db.savedCards.add({
            id: uuidv4(),
            name: cardName.trim(),
            url: currentCard.url,
            createdAt: Date.now(),
        });

        setShowSaveDialog(false);
        setCardName('');
    };

    // 保存したカードを削除
    const handleDeleteSavedCard = async (id: string) => {
        await db.savedCards.delete(id);
    };

    return (
        <div className="space-y-4">
            {/* 連携状態 */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    {isConnected ? (
                        <>
                            <Link2 className="text-green-500" size={20} />
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                連携中
                            </span>
                        </>
                    ) : (
                        <>
                            <Link2Off className="text-slate-400" size={20} />
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                未連携
                            </span>
                        </>
                    )}
                </div>

                <div className="flex gap-2">
                    {isConnected ? (
                        <button
                            onClick={handleDisconnect}
                            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            連携解除
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg transition-all shadow-sm"
                        >
                            Trelloと連携する
                        </button>
                    )}
                </div>
            </div>

            {/* カードURL入力 */}
            {isConnected && (
                <div className="space-y-3">
                    {/* よく使うカード */}
                    {savedCards && savedCards.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                よく使うカード
                            </label>
                            <div className="space-y-2">
                                {savedCards.map((card) => (
                                    <div
                                        key={card.id}
                                        className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors"
                                    >
                                        <button
                                            onClick={() => handleSelectSavedCard(card.url)}
                                            className="flex-1 text-left text-sm text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400"
                                        >
                                            {card.name}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSavedCard(card.id)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            title="削除"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        TrelloカードURL
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={cardUrl}
                            onChange={(e) => setCardUrl(e.target.value)}
                            placeholder="https://trello.com/c/..."
                            className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleLoadCard}
                            disabled={isLoading || !cardUrl.trim()}
                            className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    読み込み中...
                                </>
                            ) : (
                                '読み込み'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* エラー表示 */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* カード情報表示 */}
            {currentCard && (
                <div className="p-4 bg-gradient-to-br from-cyan-50 to-purple-50 dark:from-cyan-900/20 dark:to-purple-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {currentCard.name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                ID: {currentCard.shortLink}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSaveDialog(true)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                                title="このカードを保存"
                            >
                                <Bookmark size={14} />
                                保存
                            </button>
                            <a
                                href={currentCard.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                            >
                                <ExternalLink size={14} />
                                Trelloで開く
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* カード保存ダイアログ */}
            {showSaveDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
                            カードを保存
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    カード名
                                </label>
                                <input
                                    type="text"
                                    value={cardName}
                                    onChange={(e) => setCardName(e.target.value)}
                                    placeholder="例: 2025年1月の評価"
                                    autoFocus
                                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => {
                                        setShowSaveDialog(false);
                                        setCardName('');
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleSaveCard}
                                    disabled={!cardName.trim()}
                                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    保存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
