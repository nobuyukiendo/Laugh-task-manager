import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ExternalLink } from 'lucide-react';
import { getCard } from '../../lib/trello-api';
import type { TrelloCard } from '../../types/trello-types';

interface LinkPreviewPopoverProps {
    url: string;
    position: { x: number; y: number } | null;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

export const LinkPreviewPopover: React.FC<LinkPreviewPopoverProps> = ({
    url,
    position,
    onMouseEnter,
    onMouseLeave
}) => {
    const [cardData, setCardData] = useState<TrelloCard | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Trelloカードかどうか判定
    const trelloMatch = url.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
    const isTrelloCard = !!trelloMatch;
    const shortLink = trelloMatch ? trelloMatch[1] : null;

    useEffect(() => {
        if (!position || !isTrelloCard || !shortLink) return;

        let mounted = true;
        setLoading(true);
        setError(null);

        getCard(shortLink)
            .then(data => {
                if (mounted) setCardData(data);
            })
            .catch(err => {
                if (mounted) setError('カード情報の取得に失敗しました');
                console.error(err);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => { mounted = false; };
    }, [url, position, isTrelloCard, shortLink]);

    // Description内のURLをリンク化
    const renderDescriptionWithLinks = (text: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);

        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                return (
                    <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 hover:text-cyan-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    if (!position) return null;

    // 画面からはみ出さないように位置調整
    const POPUP_WIDTH = 400; // w-96 = 24rem = 384px -> approx 400
    const POPUP_HEIGHT = 400;

    let left = position.x;
    let top = position.y + 20; // 少し下に

    if (left + POPUP_WIDTH > window.innerWidth) {
        left = window.innerWidth - POPUP_WIDTH - 20;
    }
    if (top + POPUP_HEIGHT > window.innerHeight) {
        top = position.y - POPUP_HEIGHT - 10; // 上に表示
    }

    const content = (
        <div
            className="fixed z-50 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-96 max-w-[90vw] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            style={{ left, top }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate flex-1 mr-2">
                    {url}
                </span>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 hover:text-cyan-500 p-1 rounded hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                    title="別タブで開く"
                >
                    <ExternalLink size={14} />
                </a>
            </div>

            {/* Content area: Scrollable */}
            <div className="p-4 overflow-y-auto max-h-[400px]">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-slate-400" />
                    </div>
                ) : error ? (
                    <div className="text-red-500 text-sm text-center py-4">{error}</div>
                ) : isTrelloCard && cardData ? (
                    <div className="space-y-3">
                        {/* Labels */}
                        {cardData.labels && cardData.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {cardData.labels.map(label => (
                                    <span
                                        key={label.id}
                                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white opacity-90"
                                        style={{ backgroundColor: label.color === 'sky' ? '#0ea5e9' : label.color }} // 簡易マッピング
                                    >
                                        {label.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-tight">
                            {cardData.name}
                        </h3>

                        {/* Description - Simple text display with links */}
                        {cardData.desc ? (
                            <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                                {renderDescriptionWithLinks(cardData.desc)}
                            </div>
                        ) : (
                            <div className="text-slate-400 italic text-sm">説明はありません</div>
                        )}
                    </div>
                ) : (
                    <div className="text-slate-500 text-sm">
                        {/* 一般的なリンクプレビュー（今回は簡易的にアイコンとドメイン） */}
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                            <ExternalLink size={32} className="text-slate-300" />
                            <p>外部サイトへのリンクです</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(content, document.body);
};
