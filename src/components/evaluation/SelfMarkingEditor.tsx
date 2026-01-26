import React, { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import type { TrelloChecklist } from '../../types/trello-types';

interface SelfMarkingEditorProps {
    checklist: TrelloChecklist | null;
}

export const SelfMarkingEditor: React.FC<SelfMarkingEditorProps> = ({
    checklist,
}) => {
    const [showEmojiManager, setShowEmojiManager] = useState(false);

    if (!checklist) {
        return (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
                役職を選択してください
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    自己マーキング
                </h3>
                <button
                    onClick={() => setShowEmojiManager(!showEmojiManager)}
                    className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                    {showEmojiManager ? '閉じる' : '絵文字管理'}
                </button>
            </div>

            {/* 絵文字マスタ管理 */}
            {showEmojiManager && <EmojiMasterManager />}

            {/* 現在のチェックリスト名を表示（読み取り専用） */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    {checklist.name}
                </p>
            </div>
        </div>
    );
};

// 絵文字マスタ管理コンポーネント
const EmojiMasterManager: React.FC = () => {
    const [newEmoji, setNewEmoji] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editEmoji, setEditEmoji] = useState('');
    const emojiMasters = useLiveQuery(() => db.emojiMasters.orderBy('order').toArray(), []);

    const handleAdd = async () => {
        if (!newEmoji.trim()) return;

        const maxOrder = emojiMasters?.reduce((max, em) => Math.max(max, em.order), 0) || 0;
        await db.emojiMasters.add({
            id: uuidv4(),
            emoji: newEmoji.trim(),
            order: maxOrder + 1,
        });
        setNewEmoji('');
    };

    const handleDelete = async (id: string) => {
        await db.emojiMasters.delete(id);
    };

    const startEdit = (id: string, currentEmoji: string) => {
        setEditingId(id);
        setEditEmoji(currentEmoji);
    };

    const saveEdit = async () => {
        if (!editingId || !editEmoji.trim()) return;
        await db.emojiMasters.update(editingId, { emoji: editEmoji.trim() });
        setEditingId(null);
        setEditEmoji('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditEmoji('');
    };

    // 順番を上に移動
    const moveUp = async (id: string, currentOrder: number) => {
        if (!emojiMasters) return;
        const targetIndex = emojiMasters.findIndex(em => em.id === id);
        if (targetIndex <= 0) return;

        const prevEmoji = emojiMasters[targetIndex - 1];
        await db.emojiMasters.update(id, { order: prevEmoji.order });
        await db.emojiMasters.update(prevEmoji.id, { order: currentOrder });
    };

    // 順番を下に移動
    const moveDown = async (id: string, currentOrder: number) => {
        if (!emojiMasters) return;
        const targetIndex = emojiMasters.findIndex(em => em.id === id);
        if (targetIndex < 0 || targetIndex >= emojiMasters.length - 1) return;

        const nextEmoji = emojiMasters[targetIndex + 1];
        await db.emojiMasters.update(id, { order: nextEmoji.order });
        await db.emojiMasters.update(nextEmoji.id, { order: currentOrder });
    };

    return (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                絵文字マスタ管理
            </h4>

            {/* 追加 */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newEmoji}
                    onChange={(e) => setNewEmoji(e.target.value)}
                    placeholder="絵文字1文字"
                    maxLength={2}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 text-center text-xl"
                />
                <button
                    onClick={handleAdd}
                    disabled={!newEmoji.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                    <Plus size={16} />
                    追加
                </button>
            </div>

            {/* 一覧 */}
            <div className="space-y-2">
                {emojiMasters?.map((em) => (
                    <div
                        key={em.id}
                        className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                        <GripVertical size={16} className="text-slate-400 cursor-move" />

                        {editingId === em.id ? (
                            <>
                                <input
                                    type="text"
                                    value={editEmoji}
                                    onChange={(e) => setEditEmoji(e.target.value)}
                                    maxLength={2}
                                    autoFocus
                                    className="w-12 px-2 py-1 bg-white dark:bg-slate-900 border border-cyan-500 rounded text-center text-xl"
                                />
                                <button
                                    onClick={saveEdit}
                                    className="px-2 py-1 text-xs bg-cyan-500 text-white rounded hover:bg-cyan-600"
                                >
                                    保存
                                </button>
                                <button
                                    onClick={cancelEdit}
                                    className="px-2 py-1 text-xs bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-400 dark:hover:bg-slate-500"
                                >
                                    キャンセル
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => startEdit(em.id, em.emoji)}
                                    className="text-2xl hover:scale-110 transition-transform"
                                    title="クリックして編集"
                                >
                                    {em.emoji}
                                </button>
                                <span className="flex-1 text-sm text-slate-600 dark:text-slate-400">
                                    順序: {em.order}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => moveUp(em.id, em.order)}
                                        disabled={emojiMasters?.indexOf(em) === 0}
                                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        onClick={() => moveDown(em.id, em.order)}
                                        disabled={emojiMasters?.indexOf(em) === emojiMasters.length - 1}
                                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        ↓
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleDelete(em.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
                ※絵文字をクリックして編集、↑↓ボタンで順番を変更できます
            </p>
        </div>
    );
};
