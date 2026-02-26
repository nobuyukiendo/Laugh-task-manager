import React, { useState } from 'react';
import { useMaster } from '../contexts/MasterContext';
import { Card, Button, Input, Label } from '../components/ui';
import { ArrowLeft, Plus, Edit2, Trash2, Eye, EyeOff, Check, X, GripVertical, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
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
import { CrossFormula, CrossFormulaVariable, db } from '../db';
import { UnregisteredMetricsModal } from '../components/UnregisteredMetricsModal';

type Tab = 'departments' | 'workTypes' | 'detailTasks' | 'partners' | 'locations' | 'metrics' | 'formulas';

export const MasterPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('departments');

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
                    <ArrowLeft size={20} />
                </Button>
                <h1 className="text-2xl font-bold text-main-text">マスタ管理</h1>
            </div>

            <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-lg overflow-x-auto">
                {[
                    { id: 'departments', label: '部門' },
                    { id: 'workTypes', label: '作業種別' },
                    { id: 'detailTasks', label: '詳細作業' },
                    { id: 'partners', label: '相手' },
                    { id: 'locations', label: '場所' },
                    { id: 'metrics', label: 'メトリクス' },
                    { id: 'formulas', label: '計算式' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={clsx(
                            "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-cyan-500/20 text-cyan-400 shadow-sm"
                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <Card>
                {activeTab === 'departments' && <DepartmentEditor />}
                {activeTab === 'workTypes' && <WorkTypeEditor />}
                {activeTab === 'detailTasks' && <DetailTaskEditor />}
                {activeTab === 'partners' && <PartnerEditor />}
                {activeTab === 'locations' && <LocationEditor />}
                {activeTab === 'metrics' && <MetricMasterEditor />}
                {activeTab === 'formulas' && <FormulaEditor />}
            </Card>
        </div>
    );
};

// --- DND Helper ---
const SortableList = ({ items, onReorder, renderItem }: { items: any[], onReorder: (newItems: any[]) => void, renderItem: (item: any, handleProps: any) => React.ReactNode }) => {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex(item => item.id === active.id);
            const newIndex = items.findIndex(item => item.id === over.id);
            onReorder(arrayMove(items, oldIndex, newIndex));
        }
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                    {items.map(item => (
                        <SortableItem key={item.id} id={item.id}>
                            {(handleProps: any) => renderItem(item, handleProps)}
                        </SortableItem>
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
};

const SortableItem = ({ id, children }: { id: string, children: (handleProps: any) => React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1
    };
    return (
        <div ref={setNodeRef} style={style} className="relative">
            {children({ ...attributes, ...listeners })}
        </div>
    );
};

// --- Sub Editors ---

const DepartmentEditor = () => {
    const { departments, addDepartment, updateDepartment, deleteDepartment } = useMaster();
    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) return updateDepartment(item.id, { order: index + 1 });
            return Promise.resolve();
        }));
    };
    return (
        <div className="space-y-6">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl space-y-4 border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">新しい部門を追加</p>
                <div className="flex gap-2">
                    <Input id="new-dept-name" placeholder="部門名 (例: 制作部)" className="flex-1" />
                    <Button onClick={async () => {
                        const input = document.getElementById('new-dept-name') as HTMLInputElement;
                        if (input.value.trim()) {
                            await addDepartment({ name: input.value.trim(), order: departments.length + 1, enabled: true } as any);
                            input.value = '';
                        }
                    }}>追加</Button>
                </div>
            </div>
            <SortableList
                items={departments}
                onReorder={handleReorder}
                renderItem={(item, handleProps) => (
                    <ListItem item={item} dragHandleProps={handleProps} onUpdate={(u) => updateDepartment(item.id, u)} onDelete={() => { if (confirm('削除しますか？')) deleteDepartment(item.id); }} />
                )}
            />
        </div>
    );
};

const WorkTypeEditor = () => {
    const { workTypes, addWorkType, updateWorkType, deleteWorkType } = useMaster();
    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) return updateWorkType(item.id, { order: index + 1 });
            return Promise.resolve();
        }));
    };
    return (
        <div className="space-y-6">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl space-y-4 border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">新しい作業種別を追加</p>
                <div className="flex gap-2">
                    <Input id="new-wt-name" placeholder="作業種別名 (例: 執筆)" className="flex-1" />
                    <Button onClick={async () => {
                        const input = document.getElementById('new-wt-name') as HTMLInputElement;
                        if (input.value.trim()) {
                            await addWorkType({ name: input.value.trim(), order: workTypes.length + 1, enabled: true });
                            input.value = '';
                        }
                    }}>追加</Button>
                </div>
            </div>
            <SortableList
                items={workTypes}
                onReorder={handleReorder}
                renderItem={(item, handleProps) => (
                    <ListItem item={item} dragHandleProps={handleProps} onUpdate={(u) => updateWorkType(item.id, u)} onDelete={() => { if (confirm('削除しますか？')) deleteWorkType(item.id); }} />
                )}
            />
        </div>
    );
};

const DetailTaskEditor = () => {
    const { detailTasks, addDetailTask, updateDetailTask, deleteDetailTask } = useMaster();
    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) return updateDetailTask(item.id, { order: index + 1 });
            return Promise.resolve();
        }));
    };
    return (
        <div className="space-y-6">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl space-y-4 border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">新しい詳細作業を追加</p>
                <div className="flex gap-2">
                    <Input id="new-dt-name" placeholder="作業名" className="flex-1" />
                    <Button onClick={async () => {
                        const input = document.getElementById('new-dt-name') as HTMLInputElement;
                        if (input.value.trim()) {
                            await addDetailTask({ name: input.value.trim(), workTypeId: '', order: detailTasks.length + 1, enabled: true } as any);
                            input.value = '';
                        }
                    }}>追加</Button>
                </div>
            </div>
            <SortableList
                items={detailTasks}
                onReorder={handleReorder}
                renderItem={(item, handleProps) => (
                    <ListItem item={item} dragHandleProps={handleProps} onUpdate={(u) => updateDetailTask(item.id, u)} onDelete={() => { if (confirm('削除しますか？')) deleteDetailTask(item.id); }} />
                )}
            />
        </div>
    );
};

const PartnerEditor = () => {
    const { partners, addPartner, updatePartner, deletePartner } = useMaster();
    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) return updatePartner(item.id, { order: index + 1 });
            return Promise.resolve();
        }));
    };
    return (
        <div className="space-y-6">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl space-y-4 border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">新しい相手を追加</p>
                <div className="flex gap-2">
                    <Input id="new-pt-name" placeholder="名前" className="flex-1" />
                    <Button onClick={async () => {
                        const input = document.getElementById('new-pt-name') as HTMLInputElement;
                        if (input.value.trim()) {
                            await addPartner({ name: input.value.trim(), order: partners.length + 1, enabled: true });
                            input.value = '';
                        }
                    }}>追加</Button>
                </div>
            </div>
            <SortableList
                items={partners}
                onReorder={handleReorder}
                renderItem={(item, handleProps) => (
                    <ListItem item={item} dragHandleProps={handleProps} onUpdate={(u) => updatePartner(item.id, u)} onDelete={() => { if (confirm('削除しますか？')) deletePartner(item.id); }} />
                )}
            />
        </div>
    );
};

const LocationEditor = () => {
    const { locations, addLocation, updateLocation, deleteLocation } = useMaster();
    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) return updateLocation(item.id, { order: index + 1 });
            return Promise.resolve();
        }));
    };
    return (
        <div className="space-y-6">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl space-y-4 border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">新しい場所を追加</p>
                <div className="flex gap-2">
                    <Input id="new-lc-name" placeholder="場所名" className="flex-1" />
                    <Button onClick={async () => {
                        const input = document.getElementById('new-lc-name') as HTMLInputElement;
                        if (input.value.trim()) {
                            await addLocation({ name: input.value.trim(), order: locations.length + 1, enabled: true });
                            input.value = '';
                        }
                    }}>追加</Button>
                </div>
            </div>
            <SortableList
                items={locations}
                onReorder={handleReorder}
                renderItem={(item, handleProps) => (
                    <ListItem item={item} dragHandleProps={handleProps} onUpdate={(u) => updateLocation(item.id, u)} onDelete={() => { if (confirm('削除しますか？')) deleteLocation(item.id); }} />
                )}
            />
        </div>
    );
};

const MetricMasterEditor = () => {
    const { metricMasters, addMetricMaster, updateMetricMaster, deleteMetricMaster } = useMaster();
    const [newName, setNewName] = useState('');
    const [newUnit, setNewUnit] = useState('');
    const [showUnregistered, setShowUnregistered] = useState(false);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await addMetricMaster({ name: newName, defaultUnit: newUnit, order: metricMasters.length + 1, enabled: true } as any);
        setNewName(''); setNewUnit('');
    };

    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) return updateMetricMaster(item.id, { order: index + 1 });
            return Promise.resolve();
        }));
    };

    const handleDelete = async (id: string, name: string) => {
        const count = await db.workLogs.filter(log => log.metrics && log.metrics.some(m => m.name === name)).count();
        const msg = count > 0
            ? `このメトリクスを使用したデータが ${count} 件存在します。削除すると過去の集計ができなくなりますが、本当によろしいですか？`
            : `「${name}」を削除しますか？`;
        if (confirm(msg)) await deleteMetricMaster(id);
    };

    return (
        <div className="space-y-6">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl space-y-4 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">メトリクスマスタ</p>
                    <Button size="sm" variant="ghost" onClick={() => setShowUnregistered(true)} className="text-[10px] h-7 gap-1.5 text-cyan-500 hover:text-cyan-600 hover:bg-cyan-500/10">
                        <PlusCircle size={14} /> マスタ未登録を表示
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input placeholder="名前" value={newName} onChange={e => setNewName(e.target.value)} />
                    <Input placeholder="単位" value={newUnit} onChange={e => setNewUnit(e.target.value)} />
                </div>
                <Button onClick={handleAdd} disabled={!newName.trim()} className="w-full">追加</Button>
            </div>
            <SortableList
                items={metricMasters}
                onReorder={handleReorder}
                renderItem={(item, handleProps) => (
                    <MetricListItem item={item} dragHandleProps={handleProps} onUpdate={(u) => updateMetricMaster(item.id, u)} onDelete={() => handleDelete(item.id, item.name)} />
                )}
            />
            {showUnregistered && <UnregisteredMetricsModal onClose={() => setShowUnregistered(false)} />}
        </div>
    );
};

const FormulaEditor = () => {
    const { crossFormulas, addCrossFormula, updateCrossFormula, deleteCrossFormula } = useMaster();
    const [editing, setEditing] = useState<Partial<CrossFormula> | null>(null);

    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) return updateCrossFormula(item.id, { order: index + 1 });
            return Promise.resolve();
        }));
    };

    if (!editing) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">クロス分析の計算式</p>
                    <Button onClick={() => setEditing({ name: '', expression: '', description: '', resultUnit: '', variables: [] })}>
                        <Plus size={16} className="mr-2" /> 新規追加
                    </Button>
                </div>
                <SortableList
                    items={crossFormulas}
                    onReorder={handleReorder}
                    renderItem={(f: any, handleProps) => (
                        <div className="flex items-center justify-between p-3 rounded-lg border transition-all border-slate-200 dark:border-slate-700/50 bg-surface">
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                <div className="cursor-move p-1 text-slate-400 hover:text-slate-600" {...handleProps}><GripVertical size={18} /></div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-sm text-main-text truncate">{f.name}</h4>
                                    <p className="text-[10px] text-cyan-600 font-mono font-bold">{f.expression}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setEditing(f)}><Edit2 size={16} /></Button>
                                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`「${f.name}」を削除しますか？`)) deleteCrossFormula(f.id); }}><Trash2 size={16} /></Button>
                            </div>
                        </div>
                    )}
                />
                {!crossFormulas.length && <div className="text-center p-8 text-slate-400 text-sm">計算式が登録されていません</div>}
            </div>
        );
    }
    return <FormulaEditForm initial={editing} onSave={async (data) => {
        data.id ? await updateCrossFormula(data.id, data) : await addCrossFormula(data);
        setEditing(null);
    }} onCancel={() => setEditing(null)} />;
};

const ListItem = ({ item, onUpdate, onDelete, dragHandleProps }: { item: any, onUpdate: (p: any) => void, onDelete: () => void, dragHandleProps?: any }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(item.name);
    if (isEditing) {
        return (
            <div className="flex gap-2 p-2 bg-slate-800 rounded-lg">
                <Input value={editName} onChange={e => setEditName(e.target.value)} autoFocus className="h-8 flex-1" />
                <Button size="sm" onClick={() => { onUpdate({ name: editName }); setIsEditing(false); }}><Check size={16} /></Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}><X size={16} /></Button>
            </div>
        );
    }
    return (
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface group">
            <div className="flex items-center gap-2 overflow-hidden flex-1">
                <div className="cursor-move p-1 text-slate-400 hover:text-slate-600" {...dragHandleProps}><GripVertical size={18} /></div>
                <span className={clsx("text-sm font-medium truncate", !item.enabled && "text-slate-500 line-through")}>{item.name}</span>
            </div>
            <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setEditName(item.name); setIsEditing(true); }}><Edit2 size={16} /></Button>
                <Button size="sm" variant="ghost" onClick={() => onUpdate({ enabled: !item.enabled })}>{item.enabled ? <Eye size={16} className="text-cyan-600" /> : <EyeOff size={16} className="text-slate-400" />}</Button>
                <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 size={16} className="text-slate-500 hover:text-rose-500" /></Button>
            </div>
        </div>
    );
};

const MetricListItem = ({ item, onUpdate, onDelete, dragHandleProps }: { item: any, onUpdate: (p: any) => void, onDelete: () => void, dragHandleProps?: any }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(item.name);
    const [editUnit, setEditUnit] = useState(item.defaultUnit);
    if (isEditing) {
        return (
            <div className="flex flex-col gap-2 p-3 bg-slate-800 rounded-lg">
                <div className="flex gap-2"><Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 flex-[2]" /><Input value={editUnit} onChange={e => setEditUnit(e.target.value)} className="h-8 flex-1" /></div>
                <div className="flex justify-end gap-2"><Button size="sm" onClick={() => { onUpdate({ name: editName, defaultUnit: editUnit }); setIsEditing(false); }}><Check size={16} /></Button><Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}><X size={16} /></Button></div>
            </div>
        );
    }
    return (
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-2 overflow-hidden flex-1">
                <div className="cursor-move p-1 text-slate-400 hover:text-slate-600" {...dragHandleProps}><GripVertical size={18} /></div>
                <div className="min-w-0"><p className={clsx("text-sm font-medium truncate", !item.enabled && "text-slate-500 line-through")}>{item.name}</p><p className="text-[10px] text-slate-400">単位: {item.defaultUnit}</p></div>
            </div>
            <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setEditName(item.name); setEditUnit(item.defaultUnit); setIsEditing(true); }}><Edit2 size={16} /></Button>
                <Button size="sm" variant="ghost" onClick={() => onUpdate({ enabled: !item.enabled })}>{!!item.enabled ? <Eye size={16} className="text-cyan-600" /> : <EyeOff size={16} className="text-slate-400" />}</Button>
                <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 size={16} className="text-slate-500 hover:text-rose-500" /></Button>
            </div>
        </div>
    );
};

const FormulaEditForm = ({ initial, onSave, onCancel }: { initial: Partial<CrossFormula>, onSave: (d: any) => Promise<void>, onCancel: () => void }) => {
    const [name, setName] = useState(initial.name || '');
    const [description, setDescription] = useState(initial.description || '');
    const [expression, setExpression] = useState(initial.expression || '');
    const [resultUnit, setResultUnit] = useState(initial.resultUnit || '');
    const [variables, setVariables] = useState<CrossFormulaVariable[]>(initial.variables || []);
    const addVar = () => setVariables([...variables, { varId: String.fromCharCode(65 + variables.length), label: '', metricName: '' }]);
    const updateVar = (i: number, u: Partial<CrossFormulaVariable>) => setVariables(variables.map((v, idx) => idx === i ? { ...v, ...u } : v));
    const removeVar = (i: number) => setVariables(variables.filter((_, idx) => idx !== i));
    return (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-main-text">計算式の編集</h3><Button variant="ghost" size="sm" onClick={onCancel}><X size={20} /></Button></div>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>名前</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="例: CTR" /></div>
                    <div className="space-y-1.5"><Label>結果の単位</Label><Input value={resultUnit} onChange={e => setResultUnit(e.target.value)} placeholder="例: %" /></div>
                </div>
                <div className="space-y-1.5"><Label>数式</Label><Input value={expression} onChange={e => setExpression(e.target.value)} className="font-mono" placeholder="A/B*100" /></div>
                <div className="space-y-1.5"><Label>説明</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center"><Label>変数マッピング</Label><Button size="sm" variant="ghost" onClick={addVar}><Plus size={14} /></Button></div>
                    {variables.map((v, i) => (
                        <div key={i} className="flex gap-2 items-center bg-slate-900/30 p-2 rounded-lg">
                            <span className="font-mono font-bold text-cyan-500 w-6 text-center">{v.varId}</span>
                            <Input value={v.label} onChange={e => updateVar(i, { label: e.target.value })} placeholder="ラベル" className="h-8 text-xs" />
                            <Button size="sm" variant="ghost" onClick={() => removeVar(i)}><Trash2 size={14} /></Button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
                <Button variant="ghost" onClick={onCancel}>キャンセル</Button>
                <Button onClick={() => onSave({ ...initial, name, description, expression, resultUnit, variables })}>保存</Button>
            </div>
        </div>
    );
};
