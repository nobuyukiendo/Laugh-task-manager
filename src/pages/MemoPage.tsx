import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, MemoCard } from '../db';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, Calendar, CheckSquare, GripVertical, Check, X, FileText, ChevronRight } from 'lucide-react';
import { useMaster } from '../contexts/MasterContext';
import { SmartDetailInput } from '../components/SmartDetailInput';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Helper Hook for Auto-Resize Textarea ---
const useAutoResizeTextArea = (value: string | undefined) => {
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Reset height to auto to get the correct scrollHeight for shrinking
        element.style.height = 'auto';
        element.style.height = `${element.scrollHeight}px`;
    }, [value]);

    return ref;
};

// --- Sortable Item Component with Quick Edit ---
interface SortableMemoItemProps {
    memo: MemoCard;
    onEdit: (memo: MemoCard) => void;
    onDelete: (id: string) => void;
    onTaskify: (memo: MemoCard) => void;
    onQuickEditSave: (id: string, newBody: string) => void;
}

const SortableMemoItem: React.FC<SortableMemoItemProps> = ({ memo, onEdit, onDelete, onTaskify, onQuickEditSave }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: memo.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1
    };

    const [isQuickEditing, setIsQuickEditing] = useState(false);
    const [quickEditBody, setQuickEditBody] = useState(memo.body);
    const quickEditRef = useAutoResizeTextArea(isQuickEditing ? quickEditBody : undefined);

    // Sync body when memo updates externally
    useEffect(() => {
        setQuickEditBody(memo.body);
    }, [memo.body]);

    const handleQuickSave = () => {
        if (quickEditBody !== memo.body) {
            onQuickEditSave(memo.id, quickEditBody);
        }
        setIsQuickEditing(false);
    };

    const handleCancelQuickEdit = () => {
        setQuickEditBody(memo.body);
        setIsQuickEditing(false);
    };

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            layoutId={memo.id}
            onClick={() => onEdit(memo)}
            className="bg-surface rounded-2xl shadow-sm border border-border p-4 hover:shadow-md transition-all relative group flex flex-col h-full"
            data-theme-role="surface"
        >
            {/* Action Buttons Row */}
            <div className="flex justify-between items-start mb-2">
                {/* Drag Handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1.5 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing touch-none"
                    title="ドラッグして並び替え"
                >
                    <GripVertical size={16} />
                </button>

                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onTaskify(memo); }} className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="タスク化">
                        <CheckSquare size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(memo); }} className="p-1.5 text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg" title="編集">
                        <Edit2 size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(memo.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="削除">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Title */}
            <h3
                className="font-bold text-lg text-main-text mb-2 leading-relaxed px-1"
                data-theme-role="text"
            >
                {memo.title || <span className="text-sub-text italic" data-theme-role="subText">無題</span>}
            </h3>

            {/* Quick Edit Body Area */}
            {isQuickEditing ? (
                <div className="flex-1 flex flex-col gap-2">
                    <textarea
                        ref={quickEditRef}
                        value={quickEditBody}
                        onChange={(e) => setQuickEditBody(e.target.value)}
                        className="w-full bg-indigo-50 dark:bg-slate-200 border border-indigo-200 dark:border-slate-600 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none resize-none overflow-hidden min-h-[5rem]"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) handleQuickSave();
                            if (e.key === 'Escape') handleCancelQuickEdit();
                        }}
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={handleCancelQuickEdit} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                            <X size={16} />
                        </button>
                        <button onClick={handleQuickSave} className="p-1 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded">
                            <Check size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => setIsQuickEditing(true)} // Enable quick edit on click
                    className="flex-1 text-main-text text-sm whitespace-pre-wrap min-h-[4rem] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded p-1 -m-1 transition-colors"
                    data-theme-role="text"
                    title="クリックして簡易編集"
                >
                    {memo.body || <span className="text-sub-text" data-theme-role="subText">メモの内容を入力...</span>}
                </div>
            )}

            {/* Dates */}
            {(memo.targetDate || memo.dueDate) && (
                <div className="flex flex-wrap gap-2 text-xs pt-4 mt-auto border-t border-slate-100 dark:border-slate-700/50">
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
        </motion.div>
    );
};


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

    // Auto-resize for Modal
    const modalBodyRef = useAutoResizeTextArea(isModalOpen ? formData.body : undefined);

    // Taskify State
    const [isTaskifyModalOpen, setIsTaskifyModalOpen] = useState(false);
    const [taskifyTarget, setTaskifyTarget] = useState<MemoCard | null>(null);
    const [taskifyData, setTaskifyData] = useState<{ deptId: string; workTypeId: string; detailTask: string; saveToMaster: boolean }>({
        deptId: '',
        workTypeId: '',
        detailTask: '',
        saveToMaster: false
    });

    const [isDailyMemoModalOpen, setIsDailyMemoModalOpen] = useState(false);
    const navigate = useNavigate();

    // Master Data for Taskify
    const masterContext = useMaster();
    const { departments, workTypes } = masterContext;

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    const handleQuickEditSave = async (id: string, newBody: string) => {
        await db.memoCards.update(id, {
            body: newBody,
            updatedAt: Date.now()
        });
    };

    const handleDelete = async (id: string) => {
        if (confirm('このメモを削除しますか？')) {
            await db.memoCards.delete(id);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id && memos) {
            const oldIndex = memos.findIndex((m) => m.id === active.id);
            const newIndex = memos.findIndex((m) => m.id === over?.id);

            const newMemos = arrayMove(memos, oldIndex, newIndex);

            // Optimistic update (UI flickers less)
            // But we need to update DB.
            // Update orders in DB
            await db.transaction('rw', db.memoCards, async () => {
                for (let i = 0; i < newMemos.length; i++) {
                    await db.memoCards.update(newMemos[i].id, { order: i + 1 });
                }
            });
        }
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
            runCount: 0,
            isLocked: false
        });

        alert('スケジュールに追加しました');
        setIsTaskifyModalOpen(false);
        setTaskifyTarget(null);
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h1
                    className="text-2xl font-bold font-['Zen_Maru_Gothic'] text-main-text"
                    data-theme-role="text"
                >
                    メモ
                </h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsDailyMemoModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-slate-600 dark:text-slate-300 rounded-xl shadow-sm hover:shadow-md transition-all font-medium"
                        data-theme-role="surface"
                    >
                        <FileText size={18} />
                        日次メモを確認
                    </button>
                    <button
                        onClick={() => { setEditingMemo(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl shadow-lg hover:shadow-cyan-500/20 transition-all font-medium"
                    >
                        <Plus size={20} />
                        新規メモ
                    </button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={memos?.map(m => m.id) || []}
                    strategy={rectSortingStrategy}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {memos?.map((memo) => (
                            <SortableMemoItem
                                key={memo.id}
                                memo={memo}
                                onEdit={(m) => { setEditingMemo(m); setIsModalOpen(true); }}
                                onDelete={handleDelete}
                                onTaskify={openTaskify}
                                onQuickEditSave={handleQuickEditSave}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div
                        className="bg-surface rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-border"
                        data-theme-role="surface"
                    >
                        <h2
                            className="text-xl font-bold mb-4 text-main-text"
                            data-theme-role="text"
                        >
                            {editingMemo ? 'メモを編集' : '新規メモ'}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">タイトル</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-input-bg text-input-text border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                    data-theme-role="inputBg"
                                    placeholder="タイトル（任意）"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">本文</label>
                                <textarea
                                    ref={modalBodyRef}
                                    value={formData.body}
                                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                                    className="w-full bg-input-bg text-input-text border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 min-h-[150px] resize-none overflow-hidden"
                                    data-theme-role="inputBg"
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
                                        className="w-full bg-input-bg text-input-text border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                        data-theme-role="inputBg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">期限</label>
                                    <input
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        className="w-full bg-input-bg text-input-text border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                        data-theme-role="inputBg"
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
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface dark:bg-slate-900 border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[85vh] overflow-y-auto" data-theme-role="surface">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">
                            メモをスケジュールに追加
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">部門</label>
                                <select
                                    value={taskifyData.deptId}
                                    onChange={(e) => setTaskifyData({ ...taskifyData, deptId: e.target.value })}
                                    className={`w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 ${!taskifyData.deptId ? 'text-sub-text/50' : 'text-input-text'}`}
                                    data-theme-role="inputBg"
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
                                    className={`w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 ${!taskifyData.workTypeId ? 'text-sub-text/50' : 'text-input-text'}`}
                                    data-theme-role="inputBg"
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
                        <div className="flex justify-end gap-3 mt-8 pb-2">
                            <button onClick={() => setIsTaskifyModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">キャンセル</button>
                            <button onClick={handleTaskify} className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium shadow-md hover:shadow-green-500/25 transition-all">追加する</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Daily Comments Modal */}
            {isDailyMemoModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[85vh] flex flex-col" data-theme-role="surface">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-main-text flex items-center gap-2">
                                <FileText size={20} className="text-cyan-500" />
                                日次メモ一覧（今日の一言）
                            </h2>
                            <button onClick={() => setIsDailyMemoModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                            {(() => {
                                const savedCommentsValue = localStorage.getItem('dailyComments');
                                const savedComments = JSON.parse(savedCommentsValue || '{}');
                                const sortedDates = Object.keys(savedComments).sort((a, b) => b.localeCompare(a));

                                if (sortedDates.length === 0) {
                                    return (
                                        <div className="text-center py-10 text-sub-text">
                                            保存された日次メモはありません。
                                        </div>
                                    );
                                }

                                return sortedDates.map(dateStr => (
                                    <button
                                        key={dateStr}
                                        onClick={() => {
                                            navigate('/dashboard', { state: { targetDate: dateStr, period: 'day' } });
                                        }}
                                        className="w-full text-left p-4 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/40 hover:border-cyan-500/50 hover:bg-cyan-50/10 transition-all group"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="text-xs font-black text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {dateStr}
                                                </div>
                                                <div className="text-sm text-main-text line-clamp-2">
                                                    {savedComments[dateStr]}
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300 group-hover:text-cyan-500 transition-colors mt-1" />
                                        </div>
                                    </button>
                                ));
                            })()}
                        </div>
                        <div className="mt-6 pt-4 border-t border-border text-center">
                            <p className="text-[10px] text-sub-text">項目をクリックすると該当日次の集計画面へ移動します</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
