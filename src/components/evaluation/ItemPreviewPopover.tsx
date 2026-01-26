import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Copy, Pin, PinOff, X } from 'lucide-react';
import type { TrelloCheckItem, TrelloCard, TrelloAttachment } from '../../types/trello-types';
import { getTrelloToken } from '../../lib/trello-auth';

/**
 * URLを抽出
 */
function extractUrls(text: string): Array<{ url: string; isTrelloCard: boolean; cardShortLink?: string }> {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex) || [];

    return matches.map((url) => {
        const trelloMatch = url.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
        return {
            url,
            isTrelloCard: !!trelloMatch,
            cardShortLink: trelloMatch ? trelloMatch[1] : undefined,
        };
    });
}

/**
 * カードプレビューのキャッシュ
 */
const cardPreviewCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10分

interface ItemPreviewPopoverProps {
    checkItem: TrelloCheckItem;
    cardId: string;
    onClose: () => void;
}

export const ItemPreviewPopover: React.FC<ItemPreviewPopoverProps> = ({
    checkItem,
    cardId,
    onClose,
}) => {
    const [isPinned, setIsPinned] = useState(false);
    const [cardPreviews, setCardPreviews] = useState<Map<string, any>>(new Map());
    const [isLoadingPreviews, setIsLoadingPreviews] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const urls = extractUrls(checkItem.name);
    const trelloCardUrls = urls.filter((u) => u.isTrelloCard);

    // 遅延フェッチ（300-500ms後）
    useEffect(() => {
        if (trelloCardUrls.length === 0) return;

        timeoutRef.current = setTimeout(async () => {
            setIsLoadingPreviews(true);
            const token = getTrelloToken();
            if (!token) {
                setIsLoadingPreviews(false);
                return;
            }

            const previews = new Map<string, any>();

            for (const urlInfo of trelloCardUrls) {
                if (!urlInfo.cardShortLink) continue;

                // キャッシュチェック
                const cached = cardPreviewCache.get(urlInfo.cardShortLink);
                if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                    previews.set(urlInfo.cardShortLink, cached.data);
                    continue;
                }

                // フェッチ
                try {
                    const { getCardPreview } = await import('../../lib/trello-api');
                    const preview = await getCardPreview(urlInfo.cardShortLink, token);
                    previews.set(urlInfo.cardShortLink, preview);
                    cardPreviewCache.set(urlInfo.cardShortLink, {
                        data: preview,
                        timestamp: Date.now(),
                    });
                } catch (err) {
                    console.error('カードプレビュー取得エラー:', err);
                }
            }

            setCardPreviews(previews);
            setIsLoadingPreviews(false);
        }, 400); // 400ms遅延

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [checkItem.id]);

    // 外側クリックで閉じる（ピン留めされていない場合）
    useEffect(() => {
        if (isPinned) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isPinned, onClose]);

    // Escキーで閉じる
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div
            ref={popoverRef}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl shadow-2xl p-4 max-h-96 overflow-auto"
            style={{ minWidth: '400px', maxWidth: '600px' }}
        >
            {/* ヘッダー */}
            <div className="flex items-start justify-between mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                    項目詳細
                </h4>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPinned(!isPinned)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title={isPinned ? 'ピン留め解除' : 'ピン留め'}
                    >
                        {isPinned ? (
                            <PinOff size={16} className="text-cyan-500" />
                        ) : (
                            <Pin size={16} className="text-slate-400" />
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X size={16} className="text-slate-400" />
                    </button>
                </div>
            </div>

            {/* 項目全文 */}
            <div className="mb-4">
                <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                    {checkItem.name}
                </p>
            </div>

            {/* リンク一覧 */}
            {urls.length > 0 && (
                <div className="space-y-2 mb-4">
                    <h5 className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                        リンク
                    </h5>
                    {urls.map((urlInfo, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                        >
                            <a
                                href={urlInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline truncate"
                            >
                                {urlInfo.url}
                            </a>
                            <button
                                onClick={() => copyToClipboard(urlInfo.url)}
                                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                title="リンクコピー"
                            >
                                <Copy size={14} className="text-slate-500" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Trelloカードプレビュー */}
            {trelloCardUrls.length > 0 && (
                <div className="space-y-3">
                    <h5 className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                        カードプレビュー
                    </h5>
                    {isLoadingPreviews && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">読み込み中...</p>
                    )}
                    {Array.from(cardPreviews.entries()).map(([shortLink, preview]) => (
                        <div
                            key={shortLink}
                            className="p-3 bg-gradient-to-br from-cyan-50 to-purple-50 dark:from-cyan-900/20 dark:to-purple-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg"
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <h6 className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                    {preview.card.name}
                                </h6>
                                <a
                                    href={preview.card.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0"
                                >
                                    <ExternalLink size={14} className="text-cyan-600 dark:text-cyan-400" />
                                </a>
                            </div>
                            {preview.card.desc && (
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                                    {preview.card.desc}
                                </p>
                            )}
                            {preview.attachments.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                        添付ファイル（最新3件）
                                    </p>
                                    {preview.attachments.map((att: TrelloAttachment) => (
                                        <div
                                            key={att.id}
                                            className="flex items-center gap-2 text-xs"
                                        >
                                            <a
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-cyan-600 dark:text-cyan-400 hover:underline truncate"
                                            >
                                                {att.name}
                                            </a>
                                            <button
                                                onClick={() => copyToClipboard(att.url)}
                                                className="flex-shrink-0 p-1 rounded hover:bg-white/50 dark:hover:bg-slate-800/50"
                                                title="リンクコピー"
                                            >
                                                <Copy size={12} className="text-slate-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
