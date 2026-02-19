import React, { useState } from 'react';
import { useMaster } from '../contexts/MasterContext';
import { Card, Button, Input } from '../components/ui';
import { ArrowLeft, Plus, Edit2, Trash2, Eye, EyeOff, Check, X, Settings, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';
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

type Tab = 'departments' | 'workTypes' | 'detailTasks' | 'partners' | 'locations';

export const MasterPage: React.FC = () => {
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<Tab>('departments');

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
                    <ArrowLeft size={20} />
                </Button>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">マスタ管理</h1>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-lg overflow-x-auto">
                {[
                    { id: 'departments', label: '部門' },
                    { id: 'workTypes', label: '作業種別' },
                    { id: 'detailTasks', label: '詳細作業' },
                    { id: 'partners', label: '相手' },
                    { id: 'locations', label: '場所' },
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
            </Card>
        </div>
    );
};

// --- DND Helper ---
const SortableList = ({ items, onReorder, renderItem }: { items: any[], onReorder: (newItems: any[]) => void, renderItem: (item: any) => React.ReactNode }) => {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-2">
                    {items.map(item => (
                        <SortableItem key={item.id} id={item.id}>
                            {renderItem(item)}
                        </SortableItem>
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
};

const SortableItem = ({ id, children }: { id: string, children: React.ReactNode }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div ref={setNodeRef} style={style} className="relative">
            {/* Drag Handle is passed via children or we wrap it?
                Actually, to make it clean, we can inject props or just render children.
                The handle needs 'listeners' and 'attributes'. 
                We can cloneElement or just pass them down if 'children' is a function?
                Or simpler: The SortableItem *is* the row. 
                But we need the handle to be the drag activator. 
                
                Let's use a context or just pass the drag props to the ListItem?
                No, simpler: Wrap the *entire* ListItem in the sortable div (ref setNodeRef), 
                and pass attributes/listeners to a specific handle inside ListItem?
                
                For now, let's make the handle explicit in ListItem.
                We can pass `dragHandleProps` to the `renderItem` callback.
            */}
            {/* Wait, the standard way is: setNodeRef on the container. listeners/attributes on the handle. */}
            {/* Let's pass the wrapper props to the child. */}
            {React.cloneElement(children as React.ReactElement, { dragHandleProps: { ...attributes, ...listeners } })}
        </div>
    );
};


// --- Sub Editors ---

const DepartmentEditor = () => {
    const { departments, addDepartment, updateDepartment, deleteDepartment } = useMaster();
    const [newName, setNewName] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await addDepartment({
            id: uuidv4(),
            name: newName,
            order: departments.length + 1,
            enabled: true
        });
        setNewName('');
    };

    const handleRestoreBrackets = async () => {
        const defaultIds = ['dept-1', 'dept-2', 'dept-3', 'dept-4', 'dept-5', 'dept-6', 'dept-7', 'dept-8', 'dept-9', 'dept-10', 'dept-11', 'dept-12', 'dept-13', 'dept-14'];
        for (const dept of departments) {
            if (defaultIds.includes(dept.id) && !dept.name.startsWith('【')) {
                await updateDepartment(dept.id, { name: `【${dept.name}】` });
            }
        }
    };

    // Use Context's reorder function or implement generic reorder?
    // MasterContext doesn't expose `reorderDepartments` directly? 
    // Wait, I need to check MasterContext if it has bulk update or reorder capabilities.
    // The previous implementation used `updateDepartment` one by one.
    // Let's implement `handleReorder` here using `updateDepartment`.

    const handleReorder = async (newItems: any[]) => {
        // Optimistic UI update is hard without local state, but Dexie hook updates fast.
        // We just need to save the new orders.
        // Parallel update
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) {
                return updateDepartment(item.id, { order: index + 1 });
            }
            return Promise.resolve();
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button
                    onClick={handleRestoreBrackets}
                    className="text-xs font-bold text-cyan-500 hover:text-cyan-600 transition-colors flex items-center gap-1"
                >
                    <Settings size={12} className="inline" /> デフォルト項目の【】を復元
                </button>
            </div>
            <div className="flex gap-2">
                <Input
                    placeholder="新しい部門名..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd}><Plus size={20} /></Button>
            </div>

            <SortableList
                items={departments}
                onReorder={handleReorder}
                renderItem={(dept) => (
                    <ListItem
                        item={dept}
                        onUpdate={(u) => updateDepartment(dept.id, u)}
                        onDelete={() => { if (confirm('削除しますか？')) deleteDepartment(dept.id); }}
                    />
                )}
            />
        </div>
    );
};

const WorkTypeEditor = () => {
    const { workTypes, addWorkType, updateWorkType, deleteWorkType } = useMaster();
    const [newName, setNewName] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await addWorkType({
            name: newName,
            order: workTypes.length + 1,
            enabled: true
        });
        setNewName('');
    };

    const handleRestoreBrackets = async () => {
        const defaultIds = ['wt-1', 'wt-2', 'wt-3', 'wt-4'];
        for (const wt of workTypes) {
            if (defaultIds.includes(wt.id) && !wt.name.startsWith('【')) {
                await updateWorkType(wt.id, { name: `【${wt.name}】` });
            }
        }
    };

    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) {
                return updateWorkType(item.id, { order: index + 1 });
            }
            return Promise.resolve();
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button
                    onClick={handleRestoreBrackets}
                    className="text-xs font-bold text-cyan-500 hover:text-cyan-600 transition-colors flex items-center gap-1"
                >
                    <Settings size={12} className="inline" /> デフォルト項目の【】を復元
                </button>
            </div>
            <div className="flex gap-2">
                <Input
                    placeholder="新しい作業種別..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd}><Plus size={20} /></Button>
            </div>

            <SortableList
                items={workTypes}
                onReorder={handleReorder}
                renderItem={(item) => (
                    <ListItem
                        item={item}
                        onUpdate={(u) => updateWorkType(item.id, u)}
                        onDelete={() => { if (confirm('削除しますか？')) deleteWorkType(item.id); }}
                    />
                )}
            />
        </div>
    );
};

const DetailTaskEditor = () => {
    const { detailTasks, addDetailTask, updateDetailTask, deleteDetailTask } = useMaster();
    const [newName, setNewName] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await addDetailTask({
            workTypeId: '',
            name: newName,
            order: detailTasks.length + 1,
            enabled: true
        });
        setNewName('');
    };

    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) {
                return updateDetailTask(item.id, { order: index + 1 });
            }
            return Promise.resolve();
        }));
    };

    return (
        <div className="space-y-6">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl space-y-4 border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">新しい詳細作業を追加</p>
                <div className="flex gap-2">
                    <Input
                        placeholder="詳細作業名..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                    <Button onClick={handleAdd} disabled={!newName.trim()}>
                        <Plus size={16} className="mr-2" /> 追加
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-bold text-slate-700 dark:text-slate-300">登録済み作業一覧</h3>
                <div className="max-h-[500px] overflow-y-auto pr-2">
                    <SortableList
                        items={detailTasks}
                        onReorder={handleReorder}
                        renderItem={(item) => (
                            <ListItem
                                item={item}
                                onUpdate={(u) => updateDetailTask(item.id, u)}
                                onDelete={() => { if (confirm('削除しますか？')) deleteDetailTask(item.id); }}
                            />
                        )}
                    />
                </div>
            </div>
        </div>
    );
};

const PartnerEditor = () => {
    const { partners, addPartner, updatePartner, deletePartner } = useMaster();
    const [newName, setNewName] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await addPartner({
            name: newName,
            order: partners.length + 1,
            enabled: true
        });
        setNewName('');
    };

    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) {
                return updatePartner(item.id, { order: index + 1 });
            }
            return Promise.resolve();
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Input
                    placeholder="新しい相手..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd}><Plus size={20} /></Button>
            </div>
            <SortableList
                items={partners}
                onReorder={handleReorder}
                renderItem={(item) => (
                    <ListItem
                        item={item}
                        onUpdate={(u) => updatePartner(item.id, u)}
                        onDelete={() => { if (confirm('削除しますか？')) deletePartner(item.id); }}
                    />
                )}
            />
        </div>
    );
};

const LocationEditor = () => {
    const { locations, addLocation, updateLocation, deleteLocation } = useMaster();
    const [newName, setNewName] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await addLocation({
            name: newName,
            order: locations.length + 1,
            enabled: true
        });
        setNewName('');
    };

    const handleReorder = async (newItems: any[]) => {
        await Promise.all(newItems.map((item, index) => {
            if (item.order !== index + 1) {
                return updateLocation(item.id, { order: index + 1 });
            }
            return Promise.resolve();
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Input
                    placeholder="新しい場所..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd}><Plus size={20} /></Button>
            </div>
            <SortableList
                items={locations}
                onReorder={handleReorder}
                renderItem={(item) => (
                    <ListItem
                        item={item}
                        onUpdate={(u) => updateLocation(item.id, u)}
                        onDelete={() => { if (confirm('削除しますか？')) deleteLocation(item.id); }}
                    />
                )}
            />
        </div>
    );
};


// Generic List Item
const ListItem = ({
    item,
    onUpdate,
    onDelete,
    dragHandleProps
}: {
    item: any,
    onUpdate: (p: any) => void,
    onDelete: () => void,
    dragHandleProps?: any
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(item.name);

    const save = () => {
        onUpdate({ name: editName });
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg animate-in fade-in">
                <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                    className="h-8 py-1"
                />
                <Button size="sm" onClick={save}><Check size={16} /></Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}><X size={16} /></Button>
            </div>
        );
    }

    return (
        <div className={clsx(
            "flex items-center justify-between p-3 rounded-lg border transition-all",
            "border-slate-200 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600",
            !item.enabled
                ? "bg-slate-100/50 dark:bg-slate-900/30 opacity-60"
                : "bg-white dark:bg-slate-800/30"
        )}>
            <div className="flex items-center gap-2 overflow-hidden">
                <div
                    className="cursor-move p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    {...dragHandleProps}
                >
                    <GripVertical size={18} />
                </div>

                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.name}</span>
            </div>
            <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setEditName(item.name); setIsEditing(true); }}>
                    <Edit2 size={16} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onUpdate({ enabled: !item.enabled })}>
                    {item.enabled ? <Eye size={16} className="text-cyan-600 dark:text-cyan-400" /> : <EyeOff size={16} className="text-slate-400 dark:text-slate-500" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete}>
                    <Trash2 size={16} className="text-slate-500 hover:text-rose-500" />
                </Button>
            </div>
        </div>
    );
};
