
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ScheduleCard } from '../db';
import { useTimer } from '../contexts/TimerContext';
import { useMaster } from '../contexts/MasterContext';
import { format } from 'date-fns';
import { Play, Square, RotateCcw, Trash2, AlertTriangle, Filter, Edit2, Lock, Unlock, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
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
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Sortable Item Wrapper ---
const SortableItem = ({ id, children, disabled }: {
    id: string,
    children: (args: { isDragging: boolean, dragHandleProps: any }) => React.ReactNode,
    disabled?: boolean
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.8 : 1,
        position: 'relative' as const
    };

    return (
        <div ref={setNodeRef} style={style}>
            {children({
                isDragging,
                dragHandleProps: { ...attributes, ...listeners }
            })}
        </div>
    );
};

// ... (in SchedulePage component) ...

// ...
<div className="space-y-3">
    {displayedCards?.map((card) => {
        const isDoing = card.status === 'doing';
        const isDone = card.status === 'done';
        const deptName = getDeptName(card.deptId);
        const workName = getWorkTypeName(card.workTypeId);

        return (
            <SortableItem key={card.id} id={card.id} disabled={isFiltered}>
                {({ isDragging, dragHandleProps }) => (
                    <div
                        className={`
                                                    relative overflow-hidden rounded-2xl border p-4 transition-all
                                                    ${isDoing
                                ? 'bg-white dark:bg-slate-900 border-pink-200 dark:border-pink-900/50 shadow-lg shadow-pink-100 dark:shadow-none ring-1 ring-pink-100 dark:ring-pink-900/30'
                                : isDone
                                    ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
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

                        {/* Button Group */}
                        <div className="flex items-center gap-2 absolute top-4 right-4">

                            {/* Drag Handle - Only show if not filtered */}
                            {!isFiltered && (
                                <div
                                    className="mr-2 cursor-grab p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400"
                                    {...dragHandleProps}
                                >
                                    <GripVertical size={20} />
                                </div>
                            )}

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
                )}
            </SortableItem>
        );
    })}
</div>
                    </SortableContext >
                </DndContext >

    { displayedCards?.length === 0 && (
        <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <p>タスクがありません</p>
            <p className="text-sm mt-2">ユーザー追加またはメモからタスク化してください</p>
        </div>
    )}
            </div >

    {/* Add Modal */ }
{
    isAddModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
    )
}

{/* Edit Modal */ }
{
    isEditModalOpen && (
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
    )
}
        </div >
    );
};
