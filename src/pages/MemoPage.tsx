import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MemoCard } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, Calendar, ArrowUp, ArrowDown, CheckSquare } from 'lucide-react';
import { useMaster } from '../contexts/MasterContext';
import { SmartDetailInput } from '../components/SmartDetailInput';

export const MemoPage: React.FC = () => {
    // Queries
    const memos = useLiveQuery(() => db.memoCards.orderBy('order').toArray());

    // State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMemo, setEditingMemo] = useState<MemoCard | null>(null);
    const [formData, setFormData] = useState<{ title: string; body: string; targetDate: string; dueDate: string }>({
        title: '',
        body: '',
        targetDate: '',
        dueDate: ''
    });

    // Taskify State
    const [isTaskifyModalOpen, setIsTaskifyModalOpen] = useState(false);
    const [taskifyTarget, setTaskifyTarget] = useState<MemoCard | null>(null);
    const [taskifyData, setTaskifyData] = useState<{ deptId: string; workTypeId: string; detailTask: string; saveToMaster: boolean }>({
        deptId: '',
        workTypeId: '',
        detailTask: '',
        saveToMaster: false
    });

    // Master Data for Taskify
    const masterContext = useMaster();
    const { departments, workTypes } = masterContext;

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isModalOpen && editingMemo) {
            setFormData({
                title: editingMemo.title,
                body: editingMemo.body,
                targetDate: editingMemo.targetDate || '',
                dueDate: editingMemo.dueDate || ''
            });
        } else if (isModalOpen && !editingMemo) {
            setFormData({ title: '', body: '', targetDate: '', dueDate: '' });
        }
    }, [isModalOpen, editingMemo]);

    const handleSave = async () => {
        const now = Date.now();
        if (editingMemo) {
            await db.memoCards.update(editingMemo.id, {
                ...formData,
                updatedAt: now
            });
        } else {
            const count = await db.memoCards.count();
            await db.memoCards.add({
                id: uuidv4(),
                ...formData,
                order: count + 1,
                createdAt: now,
                updatedAt: now
            });
        }
        setIsModalOpen(false);
        setEditingMemo(null);
    };

    const handleDelete = async (id: string) => {
        if (confirm('このメモを削除しますか？')) {
            await db.memoCards.delete(id);
        }
    };

    const handleMove = async (id: string, direction: 'up' | 'down') => {
        if (!memos) return;
        const index = memos.findIndex(m => m.id === id);
        if (index === -1) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === memos.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const targetMemo = memos[targetIndex];
        const currentMemo = memos[index];

        // Swap orders
        await db.memoCards.update(currentMemo.id, { order: targetMemo.order });
        await db.memoCards.update(targetMemo.id, { order: currentMemo.order });
    };

    // --- Taskify Logic ---
    const openTaskify = (memo: MemoCard) => {
        setTaskifyTarget(memo);
        setTaskifyData({
            deptId: '',
            workTypeId: '',
            detailTask: memo.title || memo.body.split('\n')[0] || '', // Default detail task from title or body first line
            saveToMaster: false
        });
        setIsTaskifyModalOpen(true);
    };

    const handleTaskify = async () => {
        if (!taskifyTarget) return;
        // Validation: Only Dept is strictly required per user request (Fix 3), but user originally asked to relax validation in "Add" logic.
        // For Taskify, user said "Fix 3: Schedule/Memo(Taskify)... required is only Dept".
        if (!taskifyData.deptId) {
            alert('部門は必須です');
            return;
        }

        const count = await db.scheduleCards.count();
        const now = Date.now();
        const detailName = taskifyData.detailTask;

        // --- Logic copied from TimerPage for Master/Recent update (Fix 2) ---
        // 1. Always add to Recent if name exists
        if (detailName) {
            await masterContext.addRecentDetailTask(detailName, taskifyData.workTypeId);

            // 2. Conditional Master Save
            if (taskifyData.saveToMaster) {
                // Check if exists
                const exactMaster = masterContext.detailTasks.find(d => d.name === detailName);
                if (!exactMaster) {
                    await masterContext.addDetailTask({
                        name: detailName,
                        workTypeId: taskifyData.workTypeId,
                    });
                }
            }
        }
        // ------------------------------------------------------------------

        await db.scheduleCards.add({
            id: uuidv4(),
            title: taskifyTarget.title || detailName || '名称未設定', // Rule: Use memo title if exists, else detailTask, else default
            deptId: taskifyData.deptId,
            workTypeId: taskifyData.workTypeId,
            detailTask: detailName,
            status: 'todo',
            order: count + 1,
            createdAt: now,
            updatedAt: now,
            runCount: 0
        });

        alert('スケジュールに追加しました');
        setIsTaskifyModalOpen(false);
        setTaskifyTarget(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold font-['Zen_Maru_Gothic'] text-slate-800 dark:text-slate-100">
                    メモ
                </h1>
                <button
                    onClick={() => { setEditingMemo(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl shadow-lg hover:shadow-cyan-500/20 transition-all font-medium"
                >
                    <Plus size={20} />
                    新規メモ
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {memos?.map((memo) => (
                    <div key={memo.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 hover:shadow-md transition-shadow relative group">
                        {/* Action Buttons Row (Above Title) */}
                        <div className="flex justify-end gap-1 mb-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openTaskify(memo)} className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="タスク化">
                                <CheckSquare size={16} />
                            </button>
                            <button onClick={() => { setEditingMemo(memo); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleMove(memo.id, 'up')} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                                <ArrowUp size={16} />
                            </button>
                            <button onClick={() => handleMove(memo.id, 'down')} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                                <ArrowDown size={16} />
                            </button>
                            <button onClick={() => handleDelete(memo.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* Title (Full Width) */}
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-2 leading-relaxed">
                            {memo.title || <span className="text-slate-400 italic">無題</span>}
                        </h3>

                        <p className="text-slate-600 dark:text-slate-400 text-sm whitespace-pre-wrap line-clamp-5 mb-4 min-h-[4rem]">
                            {memo.body}
                        </p>

                        {(memo.targetDate || memo.dueDate) && (
                            <div className="flex flex-wrap gap-2 text-xs pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                {memo.targetDate && (
                                    <div className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 px-2 py-0.5 rounded-full">
                                        <Calendar size={12} />
                                        <span>対象: {memo.targetDate}</span>
                                    </div>
                                )}
                                {memo.dueDate && (
                                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                        <Calendar size={12} />
                                        <span>期限: {memo.dueDate}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">
                            {editingMemo ? 'メモを編集' : '新規メモ'}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">タイトル</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    placeholder="タイトル（任意）"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">本文</label>
                                <textarea
                                    value={formData.body}
                                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                                    className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500/50 min-h-[120px]"
                                    placeholder="メモの内容..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">対象日</label>
                                    <input
                                        type="date"
                                        value={formData.targetDate}
                                        onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                                        className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">期限</label>
                                    <input
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">キャンセル</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium shadow-md hover:shadow-cyan-500/25 transition-all">保存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Taskify Modal */}
            {isTaskifyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">
                            メモをスケジュールに追加
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">部門</label>
                                <select
                                    value={taskifyData.deptId}
                                    onChange={(e) => setTaskifyData({ ...taskifyData, deptId: e.target.value })}
                                    className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500/50"
                                >
                                    <option value="">選択してください</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">作業種別</label>
                                <select
                                    value={taskifyData.workTypeId}
                                    onChange={(e) => setTaskifyData({ ...taskifyData, workTypeId: e.target.value })}
                                    className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500/50"
                                >
                                    <option value="">選択してください</option>
                                    {workTypes.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <SmartDetailInput
                                    value={taskifyData.detailTask}
                                    onChange={(val) => setTaskifyData({ ...taskifyData, detailTask: val })}
                                    saveToMaster={taskifyData.saveToMaster}
                                    onSaveToMasterChange={(checked) => setTaskifyData({ ...taskifyData, saveToMaster: checked })}
                                />
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-500 dark:text-slate-400">
                                <p>元のメモは削除されません。</p>
                                <p>スケジュールカードのタイトルは、メモのタイトルまたは詳細作業が使われます。</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsTaskifyModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">キャンセル</button>
                            <button onClick={handleTaskify} className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium shadow-md hover:shadow-green-500/25 transition-all">追加する</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
