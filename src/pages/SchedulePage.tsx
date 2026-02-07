import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ScheduleCard } from '../db';
import { useTimer } from '../contexts/TimerContext';
import { useMaster } from '../contexts/MasterContext';
import { format } from 'date-fns';
import { Play, Square, RotateCcw, Trash2, AlertTriangle, Filter, Edit2, Lock, Unlock, ArrowUp, ArrowDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { SmartDetailInput } from '../components/SmartDetailInput';

export const SchedulePage: React.FC = () => {
    // Contexts
    const { activeLog, startTimer, stopTimer } = useTimer();
    const masterContext = useMaster();
    const { departments, workTypes } = masterContext;

    // State
    const [showCompleted, setShowCompleted] = useState(false);
    const [showLocked, setShowLocked] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newItem, setNewItem] = useState({ deptId: '', workTypeId: '', detailTask: '', saveToMaster: false });

    // Edit State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ScheduleCard | null>(null);
    const [editForm, setEditForm] = useState({ deptId: '', workTypeId: '', detailTask: '', saveToMaster: false });

    // Queries
    const scheduleCards = useLiveQuery(() => db.scheduleCards.orderBy('order').toArray());

    // Helper: Get names
    const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || '未設定';
    const getWorkTypeName = (id: string) => workTypes.find(w => w.id === id)?.name || '未設定';

    // Shared logic for Master Save (Fix 2: Smart Input Logic)
    const processMasterSave = async (detail: string, workType: string, save: boolean) => {
        if (detail) {
            await masterContext.addRecentDetailTask(detail, workType);
            if (save) {
                const exactMaster = masterContext.detailTasks.find(d => d.name === detail);
                if (!exactMaster) {
                    await masterContext.addDetailTask({ name: detail, workTypeId: workType });
                }
            }
        }
    };

    // Actions
    const handleStart = async (card: ScheduleCard) => {
        if (activeLog) {
            alert('現在計測中のタスクがあります。先に終了してください。');
            return;
        }

        try {
            await startTimer(
                card.deptId,
                card.workTypeId,
                [],
                [card.detailTask],
                card.title !== card.detailTask ? card.title : ''
            );

            await db.scheduleCards.update(card.id, {
                status: 'doing',
                lastStartedAt: Date.now(),
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error("Failed to start timer", error);
            alert('計測開始に失敗しました');
        }
    };

    const handleStop = async (card: ScheduleCard) => {
        if (activeLog) {
            await stopTimer();
        }

        await db.scheduleCards.update(card.id, {
            status: 'done',
            lastEndedAt: Date.now(),
            runCount: (card.runCount || 0) + 1,
            updatedAt: Date.now()
        });
    };

    const handleRestart = async (card: ScheduleCard) => {
        if (activeLog) {
            alert('現在計測中のタスクがあります。先に終了してください。');
            return;
        }

        try {
            await startTimer(
                card.deptId,
                card.workTypeId,
                [],
                [card.detailTask],
                card.title !== card.detailTask ? card.title : ''
            );

            await db.scheduleCards.update(card.id, {
                status: 'doing',
                lastStartedAt: Date.now(),
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error("Failed to restart timer", error);
            alert('再開に失敗しました');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('このタスクを削除しますか？')) {
            await db.scheduleCards.delete(id);
        }
    };

    const handleDeleteAllDone = async () => {
        // Find done tasks that are NOT locked
        const doneCards = await db.scheduleCards
            .filter(c => c.status === 'done' && !c.isLocked)
            .toArray();

        const doneCount = doneCards.length;

        if (doneCount === 0) {
            alert('削除対象の完了済みタスクはありません（ロックされたタスクは削除されません）');
            return;
        }

        if (confirm(`完了済み（Done）のタスク${doneCount}件を削除しますか？\n※ロックされたタスクは削除されません。`)) {
            const keys = doneCards.map(c => c.id);
            await db.scheduleCards.bulkDelete(keys);
        }
    };

    const handleToggleLock = async (card: ScheduleCard) => {
        await db.scheduleCards.update(card.id, {
            isLocked: !card.isLocked
        });
    };

    const moveCard = async (index: number, direction: 'up' | 'down') => {
        if (!scheduleCards) return;
        const newCards = [...scheduleCards];

        if (direction === 'up') {
            if (index === 0) return;
            [newCards[index - 1], newCards[index]] = [newCards[index], newCards[index - 1]];
        } else {
            if (index === newCards.length - 1) return;
            [newCards[index], newCards[index + 1]] = [newCards[index + 1], newCards[index]];
        }

        // Update orders in DB
        await db.transaction('rw', db.scheduleCards, async () => {
            for (let i = 0; i < newCards.length; i++) {
                await db.scheduleCards.update(newCards[i].id, { order: i + 1 });
            }
        });
    };


    const handleAddItem = async () => {
        // Fix 3: Relaxed Validation (Only Dept required)
        if (!newItem.deptId) {
            alert('部門は必須です');
            return;
        }
        const count = await db.scheduleCards.count();
        const now = Date.now();
        const detailName = newItem.detailTask;

        await processMasterSave(detailName, newItem.workTypeId, newItem.saveToMaster);

        await db.scheduleCards.add({
            id: uuidv4(),
            title: detailName || '名称未設定',
            deptId: newItem.deptId,
            workTypeId: newItem.workTypeId,
            detailTask: detailName,
            status: 'todo',
            order: count + 1,
            createdAt: now,
            updatedAt: now,
            runCount: 0,
            isLocked: false
        });
        setNewItem({ deptId: '', workTypeId: '', detailTask: '', saveToMaster: false });
        setIsAddModalOpen(false);
    };

    const openEditModal = (card: ScheduleCard) => {
        // Fix 4: Prevent editing 'doing' tasks
        if (card.status === 'doing') return;
        setEditingItem(card);
        setEditForm({
            deptId: card.deptId,
            workTypeId: card.workTypeId,
            detailTask: card.detailTask,
            saveToMaster: false
        });
        setIsEditModalOpen(true);
    };

    const handleEditSave = async () => {
        if (!editingItem) return;
        if (!editForm.deptId) {
            alert('部門は必須です');
            return;
        }
        const detailName = editForm.detailTask;

        await processMasterSave(detailName, editForm.workTypeId, editForm.saveToMaster);

        await db.scheduleCards.update(editingItem.id, {
            deptId: editForm.deptId,
            workTypeId: editForm.workTypeId,
            detailTask: detailName,
            title: detailName || editingItem.title,
            updatedAt: Date.now()
        });

        setIsEditModalOpen(false);
        setEditingItem(null);
    };

    // Filtering
    const displayedCards = scheduleCards?.filter(c => {
        if (c.status === 'done' && !showCompleted && !c.isLocked) return false;
        // Even if showCompleted is false, if Show Locked is true and card is locked, show it?
        // User asked: "完了状態に関わらず、ロックしたタスクのみを表示できるボタン" = "Show Locked Only" or "Include Locked"?
        // Requirement: "Also, button to show ONLY locked tasks regardless of status"
        // Let's interpret "Show Locked" as a toggle: If ON, show ONLY locked tasks.
        // Wait, "ロックしたタスクのみを表示できるボタン" -> "Show Locked Only".
        // But usually filers are additive or exclusive.
        // Let's implement:
        // 1. Show Completed (toggle): Include Done items?
        // 2. Show Locked Only (toggle): If ON, filter list to ONLY locked items.
        //
        // Let's refine the request: "完了状態に関わらず、ロックしたタスクのみを表示できるボタン"
        // -> If clicked, maybe it toggles a mode where only locked tasks are shown?

        if (showLocked && !c.isLocked) return false;

        // Logic:
        // If Show Locked is ON -> Show ONLY locked tasks (regardless of status).
        // If Show Locked is OFF -> Standard view (check Show Completed).

        if (!showLocked) {
            if (c.status === 'done' && !showCompleted) return false;
        }

        return true;
    });

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-['Zen_Maru_Gothic'] text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        スケジュール
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">今日のタスクをボードで管理</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleDeleteAllDone}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title="完了タスクを全削除（ロック済みを除く）"
                    >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">完了削除</span>
                    </button>

                    <button
                        onClick={() => setShowLocked(!showLocked)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showLocked
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                    >
                        {showLocked ? <Lock size={14} /> : <Unlock size={14} />}
                        {showLocked ? 'ロックのみ表示' : 'ロックを表示'}
                    </button>

                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        disabled={showLocked} // Disable conflict
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showCompleted
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                            } ${showLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Filter size={14} />
                        {showCompleted ? '完了を表示' : '完了を隠す'}
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all font-medium"
                    >
                        <Play size={16} fill="currentColor" />
                        タスク追加
                    </button>
                </div>
            </div>

            {/* Warning */}
            {activeLog && !scheduleCards?.some(c => c.status === 'doing') && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="shrink-0" />
                    <div className="text-sm">
                        <span className="font-bold">注意:</span> スケジュール外で計測中のタスクがあります。スケジュールの開始ボタンはロックされています。
                    </div>
                </div>
            )}

            {/* Board / List */}
            <div className="space-y-3">
                {displayedCards?.map((card, index) => {
                    const isDoing = card.status === 'doing';
                    const isDone = card.status === 'done';
                    const deptName = getDeptName(card.deptId);
                    const workName = getWorkTypeName(card.workTypeId);

                    // For reordering: need absolute index in the original list? 
                    // No, usually reordering is done on the full list. 
                    // But here we are filtering. 
                    // If filtered, reordering might be confusing. 
                    // Let's only allow reordering if NOT filtering locked? 
                    // Or just use the card's ID to find index in main array?
                    // "scheduleCards" is the full list ordered by 'order'. 
                    // "displayedCards" is filtered. 
                    // If we reorder displayed cards, it's safer to map back to original index.
                    const originalIndex = scheduleCards?.findIndex(c => c.id === card.id) ?? -1;

                    return (
                        <div
                            key={card.id}
                            className={`
                                relative overflow-hidden rounded-2xl border p-4 transition-all
                                ${isDoing
                                    ? 'bg-white dark:bg-slate-900 border-pink-200 dark:border-pink-900/50 shadow-lg shadow-pink-100 dark:shadow-none ring-1 ring-pink-100 dark:ring-pink-900/30'
                                    : isDone
                                        ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800' // Removed opacity for Restart button visibility context, handled elements individually
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md'
                                }
                            `}
                        >
                            {/* Done State styling wrapper for content excluding buttons */}
                            <div className={`${isDone ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                                {isDoing && <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-pink-500 to-rose-500" />}

                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">
                                                {deptName}
                                            </span>
                                            <span>/</span>
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">
                                                {workName}
                                            </span>
                                            {card.runCount > 0 && (
                                                <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 ml-2">
                                                    <RotateCcw size={10} />
                                                    {card.runCount}回
                                                </span>
                                            )}
                                        </div>
                                        <h3 className={`text-lg font-bold truncate ${isDone ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-800 dark:text-slate-100'}`}>
                                            {card.title || card.detailTask}
                                        </h3>
                                        {card.title !== card.detailTask && (
                                            <div className="text-xs text-slate-400 mt-0.5 truncate">{card.detailTask}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Button Group - Placed outside of invalidating opacity/grayscale wrapper to keep Restart button bright */}
                            <div className="flex items-center gap-2 absolute top-4 right-4">
                                {/* Reorder Buttons (Only visible if not verifying filters strictly? Or always show?) */}
                                {/* If filtering, reordering might jump items around. Let's allow it but be careful. */}
                                <div className="flex flex-col gap-0.5 mr-2">
                                    <button
                                        onClick={() => moveCard(originalIndex, 'up')}
                                        disabled={originalIndex === 0}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                                    >
                                        <ArrowUp size={12} className="text-slate-400" />
                                    </button>
                                    <button
                                        onClick={() => moveCard(originalIndex, 'down')}
                                        disabled={originalIndex === (scheduleCards?.length || 0) - 1}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                                    >
                                        <ArrowDown size={12} className="text-slate-400" />
                                    </button>
                                </div>

                                {/* Lock Button */}
                                <button
                                    onClick={() => handleToggleLock(card)}
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${card.isLocked
                                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                            : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    title={card.isLocked ? "ロック解除" : "ロック"}
                                >
                                    {card.isLocked ? <Lock size={18} /> : <Unlock size={18} />}
                                </button>


                                {/* STATUS BUTTONS */}
                                {isDoing ? (
                                    <button
                                        onClick={() => handleStop(card)}
                                        className="h-10 px-6 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <Square size={16} fill="currentColor" />
                                        完了
                                    </button>
                                ) : isDone ? (
                                    <button
                                        onClick={() => handleRestart(card)}
                                        disabled={!!activeLog}
                                        className="h-10 px-4 rounded-xl bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-300 font-bold border border-cyan-100 dark:border-cyan-800 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RotateCcw size={16} />
                                        再開
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleStart(card)}
                                        disabled={!!activeLog}
                                        className="h-10 px-6 rounded-xl bg-cyan-500 text-white font-bold shadow-md hover:bg-cyan-600 hover:shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                        <Play size={16} fill="currentColor" />
                                        開始
                                    </button>
                                )}

                                {/* Edit Button */}
                                {card.status !== 'doing' && !card.isLocked && (
                                    <button
                                        onClick={() => openEditModal(card)}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                                        title="編集"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                )}
                                {/* Delete Button - Disabled if locked */}
                                {!card.isLocked && (
                                    <button
                                        onClick={() => handleDelete(card.id)}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>


                            {/* Times */}
                            {(card.lastStartedAt || card.lastEndedAt) && (
                                <div className={`mt-3 pt-3 border-t border-slate-50 dark:border-slate-800/50 flex items-center gap-4 text-xs text-slate-400 ${isDone ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                                    {card.lastStartedAt && (
                                        <span className="flex items-center gap-1">
                                            <Play size={10} /> 最終開始: {format(card.lastStartedAt, 'MM/dd HH:mm')}
                                        </span>
                                    )}
                                    {card.lastEndedAt && (
                                        <span className="flex items-center gap-1">
                                            <Square size={10} /> 最終終了: {format(card.lastEndedAt, 'MM/dd HH:mm')}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {displayedCards?.length === 0 && (
                    <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <p>タスクがありません</p>
                        <p className="text-sm mt-2">ユーザー追加またはメモからタスク化してください</p>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            タスクを追加
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-pink-600 dark:text-pink-400 mb-1">部門 <span className="text-red-500">*</span></label>
                                <select
                                    value={newItem.deptId}
                                    onChange={(e) => setNewItem({ ...newItem, deptId: e.target.value })}
                                    className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pink-500/50"
                                >
                                    <option value="">(選択してください)</option>
                                    {departments.filter(d => d.enabled).map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">作業種別 (任意)</label>
                                <select
                                    value={newItem.workTypeId}
                                    onChange={(e) => setNewItem({ ...newItem, workTypeId: e.target.value })}
                                    className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option value="">(未選択)</option>
                                    {workTypes.filter(w => w.enabled).map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <SmartDetailInput
                                    value={newItem.detailTask}
                                    onChange={(val) => setNewItem({ ...newItem, detailTask: val })}
                                    saveToMaster={newItem.saveToMaster}
                                    onSaveToMasterChange={(checked) => setNewItem({ ...newItem, saveToMaster: checked })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">キャンセル</button>
                            <button onClick={handleAddItem} className="px-5 py-2.5 rounded-xl font-bold bg-pink-500 text-white hover:bg-pink-600 shadow-lg shadow-pink-200 dark:shadow-pink-900/20 transition-all">追加</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">タスクを編集</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-pink-600 dark:text-pink-400 mb-1">部門 <span className="text-red-500">*</span></label>
                                <select
                                    value={editForm.deptId}
                                    onChange={(e) => setEditForm({ ...editForm, deptId: e.target.value })}
                                    className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pink-500/50"
                                >
                                    <option value="">(選択してください)</option>
                                    {departments.filter(d => d.enabled).map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">作業種別 (任意)</label>
                                <select
                                    value={editForm.workTypeId}
                                    onChange={(e) => setEditForm({ ...editForm, workTypeId: e.target.value })}
                                    className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option value="">(未選択)</option>
                                    {workTypes.filter(w => w.enabled).map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <SmartDetailInput
                                    value={editForm.detailTask}
                                    onChange={(val) => setEditForm({ ...editForm, detailTask: val })}
                                    saveToMaster={editForm.saveToMaster}
                                    onSaveToMasterChange={(checked) => setEditForm({ ...editForm, saveToMaster: checked })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">キャンセル</button>
                            <button onClick={handleEditSave} className="px-5 py-2.5 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all">保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
