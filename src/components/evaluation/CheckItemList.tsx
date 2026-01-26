import React, { useState, useRef } from 'react';
import { CheckCircle2, Circle, Edit2, Link } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { TrelloCheckItem } from '../../types/trello-types';
import { updateCheckItem } from '../../lib/trello-api';
import { LinkPreviewPopover } from './LinkPreviewPopover';

interface CheckItemListProps {
    cardId: string;
    checkItems: TrelloCheckItem[]; // items -> checkItems に変更
    filterMode: 'all' | 'complete' | 'incomplete'; // 追加
    onItemUpdate: () => void;
}

export const CheckItemList: React.FC<CheckItemListProps> = ({ cardId, checkItems, filterMode, onItemUpdate }) => {
    // 編集状態
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 絵文字マスタを取得
    const emojiMasters = useLiveQuery(() => db.emojiMasters.orderBy('order').toArray(), []);

    // リンクプレビュー状態
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewPos, setPreviewPos] = useState<{ x: number, y: number } | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);



    // フィルタリング
    const filteredItems = checkItems.filter((item) => {
        if (filterMode === 'all') return true;
        if (filterMode === 'complete') return item.state === 'complete';
        if (filterMode === 'incomplete') return item.state === 'incomplete';
        return true;
    });

    // posでソート
    const sortedItems = [...filteredItems].sort((a, b) => a.pos - b.pos);

    // リンク処理: テキスト内のURLを検出し、aタグに変換
    const renderTextWithLinks = (text: string) => {
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
                        className="text-cyan-600 hover:text-cyan-500 hover:underline z-10 relative"
                        onMouseEnter={(e) => handleLinkMouseEnter(e, part)}
                        onMouseLeave={handleLinkMouseLeave}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    // リンクホバー処理
    const handleLinkMouseEnter = (e: React.MouseEvent, url: string) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        const rect = e.currentTarget.getBoundingClientRect();

        // 少し遅延させて表示（誤爆防止）
        hoverTimeoutRef.current = setTimeout(() => {
            setPreviewUrl(url);
            setPreviewPos({ x: rect.left, y: rect.bottom });
        }, 300);
    };

    const handleLinkMouseLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        // プレビュー自体にマウスが乗る猶予を与えるため、少し遅延して消す
        hoverTimeoutRef.current = setTimeout(() => {
            setPreviewUrl(null);
            setPreviewPos(null);
        }, 300);
    };

    const handlePreviewMouseEnter = () => {
        // プレビューに乗ったら消さない
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };

    const handlePreviewMouseLeave = () => {
        // プレビューから離れたら消す
        hoverTimeoutRef.current = setTimeout(() => {
            setPreviewUrl(null);
            setPreviewPos(null);
        }, 300);
    };



    const startEditing = (item: TrelloCheckItem) => {
        setEditingId(item.id);
        setEditName(item.name);
    };

    // 絵文字を先頭に追加
    const addEmojiToText = (emoji: string) => {
        setEditName(prev => `${emoji} ${prev}`);
        textareaRef.current?.focus();
    };

    // URLを末尾に追加(半角スペース付き)
    const pasteUrlToEnd = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setEditName(prev => `${prev} ${text}`);
            textareaRef.current?.focus();
        } catch (err) {
            console.error('Failed to read clipboard:', err);
        }
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const currentId = editingId; // capture for closure

        if (updatingIds.has(currentId)) return;
        setUpdatingIds(prev => new Set(prev).add(currentId));

        try {
            await updateCheckItem(cardId, currentId, { name: editName });
            setEditingId(null);
            onItemUpdate();
        } catch (error) {
            console.error('Failed to update item name:', error);
            alert('更新に失敗しました');
        } finally {
            setUpdatingIds(prev => {
                const next = new Set(prev);
                next.delete(currentId);
                return next;
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            setEditingId(null);
        }
    };

    // ガード節
    if (!checkItems) return null;

    if (sortedItems.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                {filterMode === 'complete' && '達成した項目はありません'}
                {filterMode === 'incomplete' && '未達成の項目はありません'}
                {filterMode === 'all' && '項目がありません'}
            </div>
        );
    }

    return (
        <>
            <ul className="space-y-4">
                {sortedItems.map((item) => (
                    <li
                        key={item.id}
                        className="group relative flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                        {/* 状態アイコン（読み取り専用） */}
                        <div className="mt-0.5 text-slate-400">
                            {item.state === 'complete' ? (
                                <CheckCircle2 className="text-green-500" size={20} />
                            ) : (
                                <Circle size={20} />
                            )}
                        </div>

                        {/* テキストコンテンツ または 編集フォーム */}
                        <div className="flex-1 min-w-0">
                            {editingId === item.id ? (
                                <div className="flex flex-col gap-2">
                                    {/* 絵文字ボタン群 */}
                                    <div className="flex flex-wrap gap-1">
                                        {emojiMasters?.map((em) => (
                                            <button
                                                key={em.id}
                                                onClick={() => addEmojiToText(em.emoji)}
                                                className="px-2 py-1 text-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-sm transition-all"
                                                title={`先頭に ${em.emoji} を追加`}
                                            >
                                                {em.emoji}
                                            </button>
                                        ))}
                                        <button
                                            onClick={pasteUrlToEnd}
                                            className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-sm transition-all flex items-center gap-1 text-slate-700 dark:text-slate-300"
                                            title="クリップボードのURLを末尾に貼り付け"
                                        >
                                            <Link size={12} />
                                            URL貼付
                                        </button>
                                    </div>
                                    <textarea
                                        ref={textareaRef}
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        autoFocus
                                        rows={Math.max(2, editName.split('\n').length)}
                                        className="w-full bg-white dark:bg-slate-900 border border-cyan-500 rounded px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none resize-none"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={saveEdit}
                                            disabled={updatingIds.has(item.id)}
                                            className="px-3 py-1 bg-cyan-500 text-white text-xs rounded hover:bg-cyan-600 disabled:opacity-50"
                                        >
                                            保存
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="px-3 py-1 bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs rounded hover:bg-slate-400 dark:hover:bg-slate-500"
                                        >
                                            キャンセル
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className={`text-sm leading-relaxed break-words ${item.state === 'complete' ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}
                                    onDoubleClick={() => startEditing(item)}
                                >
                                    {renderTextWithLinks(item.name)}
                                </div>
                            )}

                            {/* クイックアクションバー (行ホバー時のみ表示) */}
                            {!editingId && (
                                <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-900/90 p-1 rounded-md shadow-sm border border-slate-100 dark:border-slate-700">
                                    {/* 編集ボタン */}
                                    <button
                                        onClick={() => startEditing(item)}
                                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-cyan-500 transition-colors"
                                        title="編集"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {/* Link Preview Popover */}
            {previewUrl && previewPos && (
                <LinkPreviewPopover
                    url={previewUrl}
                    position={previewPos}
                    onMouseEnter={handlePreviewMouseEnter}
                    onMouseLeave={handlePreviewMouseLeave}
                />
            )}
        </>
    );
};
