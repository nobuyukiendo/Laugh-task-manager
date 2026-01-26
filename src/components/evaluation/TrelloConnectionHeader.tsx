import React, { useState, useEffect } from 'react';
import { Link2, Link2Off, ExternalLink, Loader2, Bookmark, Key, Info, Check, Save, XCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import {
    initTrelloAuth,
    getTrelloToken,
    clearTrelloToken,
    isTrelloTokenValid,
    getTrelloApiKey,
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
    // 状態管理
    const [isConnected, setIsConnected] = useState(false);
    const [cardUrl, setCardUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [cardName, setCardName] = useState('');

    // API Key設定用の状態
    const [inputApiKey, setInputApiKey] = useState(() => localStorage.getItem('trello.apiKey') || '');
    const [tokenMode, setTokenMode] = useState<'persist' | 'session'>(() =>
        (localStorage.getItem('trello.tokenMode') as 'persist' | 'session') || 'persist'
    );
    const [isApiKeySaved, setIsApiKeySaved] = useState(false);

    // 有効なAPI Keyの解決
    const activeApiKey = getTrelloApiKey();
    const isEnvApiKey = !!import.meta.env.VITE_TRELLO_API_KEY;

    // 保存したカードを取得
    const savedCards = useLiveQuery(() => db.savedCards.orderBy('createdAt').reverse().toArray(), []);

    // 初期化:トークンの有効性チェック
    useEffect(() => {
        setIsConnected(isTrelloTokenValid());

        const interval = setInterval(() => {
            const newState = isTrelloTokenValid();
            if (newState !== isConnected) {
                setIsConnected(newState);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isConnected]);

    // API Keyを保存
    const handleSaveApiKey = () => {
        if (!inputApiKey.trim()) return;
        localStorage.setItem('trello.apiKey', inputApiKey.trim());
        localStorage.setItem('trello.tokenMode', tokenMode);
        setIsApiKeySaved(true);
        setTimeout(() => setIsApiKeySaved(false), 2000);
        setError(null);
    };

    // API Key設定をクリア
    const handleClearApiKey = () => {
        localStorage.removeItem('trello.apiKey');
        localStorage.removeItem('trello.tokenMode');
        setInputApiKey('');
        handleDisconnect(); // Keyを消すなら連携も解除
    };

    const handleConnect = () => {
        try {
            setError(null);
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

    const handleSelectSavedCard = (url: string) => {
        setCardUrl(url);
    };

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

    const handleDeleteSavedCard = async (id: string) => {
        await db.savedCards.delete(id);
    };

    // セクションの開閉状態
    const [isConfigExpanded, setIsConfigExpanded] = useState(() => {
        const saved = localStorage.getItem('trello.configExpanded');
        return saved === null ? true : saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('trello.configExpanded', String(isConfigExpanded));
    }, [isConfigExpanded]);

    return (
        <div className="space-y-6">
            {/* Trello API設定 */}
            <div className={`rounded-[1.5rem] border transition-all overflow-hidden ${!activeApiKey ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'}`}>
                <button
                    onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Key className={!activeApiKey ? 'text-amber-500' : 'text-slate-400'} size={20} />
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            Trello API設定
                        </h3>
                        {isEnvApiKey && (
                            <span className="text-[10px] font-black bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                                ENV優先
                            </span>
                        )}
                    </div>
                    {isConfigExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </button>

                {isConfigExpanded && (
                    <div className="p-5 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-300">
                        {!isEnvApiKey && (
                            <div>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={inputApiKey}
                                        onChange={(e) => setInputApiKey(e.target.value)}
                                        placeholder="Trello API Key を入力"
                                        className="flex-1 px-4 py-2 bg-white dark:bg-white border border-slate-300 dark:border-slate-400 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all font-bold"
                                    />
                                    <button
                                        onClick={handleSaveApiKey}
                                        disabled={!inputApiKey.trim()}
                                        className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:text-cyan-600 transition-colors disabled:opacity-30"
                                        title="保存"
                                    >
                                        {isApiKeySaved ? <Check size={20} className="text-green-500" /> : <Save size={20} />}
                                    </button>
                                    <button
                                        onClick={handleClearApiKey}
                                        className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:text-red-500 transition-colors"
                                        title="クリア"
                                    >
                                        <XCircle size={20} />
                                    </button>
                                </div>
                                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 leading-relaxed">
                                    <Info size={12} />
                                    <a href="https://trello.com/app-key" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline">Trello APIキー取得場所</a>
                                    <span>にて取得したキーを各自で入力してください。</span>
                                </p>
                            </div>
                        )}

                        <div className="flex items-center gap-6">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">トークンの保存方式:</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="tokenMode"
                                        checked={tokenMode === 'persist'}
                                        onChange={() => setTokenMode('persist')}
                                        className="w-4 h-4 text-cyan-500 border-slate-300 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                        この端末に保存
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="tokenMode"
                                        checked={tokenMode === 'session'}
                                        onChange={() => setTokenMode('session')}
                                        className="w-4 h-4 text-cyan-500 border-slate-300 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                        今回のみ
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 連携状態 */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    {isConnected ? (
                        <>
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                <Link2 className="text-green-500" size={24} />
                            </div>
                            <div>
                                <span className="block text-sm font-black text-slate-900 dark:text-white">
                                    Trello連携済み
                                </span>
                                <span className="block text-[10px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
                                    Connected
                                </span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <Link2Off className="text-slate-400" size={24} />
                            </div>
                            <div>
                                <span className="block text-sm font-bold text-slate-500">
                                    未連携
                                </span>
                                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    Disconnected
                                </span>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex gap-2">
                    {isConnected ? (
                        <button
                            onClick={handleDisconnect}
                            className="px-5 py-2.5 text-xs font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all border border-transparent hover:border-red-200 dark:hover:border-red-800"
                        >
                            連携を解除する
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            disabled={!activeApiKey}
                            className="px-6 py-2.5 text-xs font-black text-white bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed transform active:scale-95"
                        >
                            Trelloと連携を開始
                        </button>
                    )}
                </div>
            </div>

            {/* エラー表示（警告として表示） */}
            {error && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3">
                    <XCircle className="text-amber-500 shrink-0" size={18} />
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{error}</p>
                </div>
            )}

            {/* カードURL入力 */}
            {isConnected && (
                <div className="space-y-4 p-6 bg-slate-50 dark:bg-slate-800/20 rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
                    <div className="space-y-4">
                        <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            Trelloカードのロード
                        </label>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={cardUrl}
                                onChange={(e) => setCardUrl(e.target.value)}
                                placeholder="https://trello.com/c/..."
                                className="flex-1 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleLoadCard}
                                disabled={isLoading || !cardUrl.trim()}
                                className="px-8 py-3 text-sm font-black text-white bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 rounded-2xl transition-all shadow-lg disabled:opacity-50 flex items-center gap-2 active:scale-95"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : '読み込み'}
                            </button>
                        </div>
                    </div>

                    {/* よく使うカード */}
                    {savedCards && savedCards.length > 0 && (
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-3">
                                <Bookmark size={14} className="text-slate-400" />
                                <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">よく使うカード</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {savedCards.map((card) => (
                                    <div
                                        key={card.id}
                                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-cyan-200 dark:hover:border-cyan-800 transition-all group"
                                    >
                                        <button
                                            onClick={() => handleSelectSavedCard(card.url)}
                                            className="flex-1 text-left text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 truncate"
                                        >
                                            {card.name}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSavedCard(card.id)}
                                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* カード情報表示 */}
            {currentCard && (
                <div className="p-6 bg-gradient-to-br from-cyan-500/10 to-purple-600/10 dark:from-cyan-500/5 dark:to-purple-600/5 border border-cyan-200 dark:border-cyan-800 rounded-[2rem] animate-in zoom-in-95 duration-300">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white truncate lg:whitespace-normal">
                                {currentCard.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 bg-white/50 dark:bg-slate-800/50 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                    {currentCard.shortLink}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={() => setShowSaveDialog(true)}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-xs font-black text-cyan-600 dark:text-cyan-400 rounded-xl shadow-sm border border-cyan-100 dark:border-cyan-900/50 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all"
                            >
                                <Bookmark size={14} />
                                保存
                            </button>
                            <a
                                href={currentCard.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-xs font-black text-purple-600 dark:text-purple-400 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                            >
                                <ExternalLink size={14} />
                                開く
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* 保存ダイアログ */}
            {showSaveDialog && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 font-['Zen_Maru_Gothic']">
                            このカードを保存
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-bold">
                            次回からURLを入力せずに読み込めます。
                        </p>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                                    管理用の名前
                                </label>
                                <input
                                    type="text"
                                    value={cardName}
                                    onChange={(e) => setCardName(e.target.value)}
                                    placeholder="例: 2025年Q1 役職評価"
                                    autoFocus
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setShowSaveDialog(false);
                                        setCardName('');
                                    }}
                                    className="flex-1 py-4 text-sm font-black text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
                                >
                                    戻る
                                </button>
                                <button
                                    onClick={handleSaveCard}
                                    disabled={!cardName.trim()}
                                    className="flex-[2] py-4 text-sm font-black text-white bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl shadow-xl shadow-cyan-500/20 disabled:opacity-50 active:scale-95 transition-all"
                                >
                                    登録する
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
