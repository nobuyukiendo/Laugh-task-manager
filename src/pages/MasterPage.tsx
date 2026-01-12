import React, { useState } from 'react';
import { useMaster } from '../contexts/MasterContext';
import { Card, Button, Input } from '../components/ui';
import { ArrowLeft, Plus, Edit2, Trash2, Eye, EyeOff, Check, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';

type Tab = 'departments' | 'workTypes' | 'detailTasks';

export const MasterPage: React.FC = () => {
    const navigate = useNavigate();
    // Context is used in sub-components
    // const { ... } = useMaster();

    const [activeTab, setActiveTab] = useState<Tab>('departments');
    // const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
                    <ArrowLeft size={20} />
                </Button>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">マスタ管理</h1>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-lg">
                {[
                    { id: 'departments', label: '部門' },
                    { id: 'workTypes', label: '作業種別' },
                    { id: 'detailTasks', label: '詳細作業' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={clsx(
                            "flex-1 py-2 text-sm font-medium rounded-md transition-all",
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
            </Card>
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

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Input
                    placeholder="新しい部門名..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd}><Plus size={20} /></Button>
            </div>

            <div className="space-y-2">
                {departments.map((dept, index) => (
                    <ListItem
                        key={dept.id}
                        item={dept}
                        onUpdate={(u) => updateDepartment(dept.id, u)}
                        onDelete={() => { if (confirm('削除しますか？')) deleteDepartment(dept.id); }}
                        onMoveUp={index > 0 ? () => handleMove(index, 'up', departments, updateDepartment) : undefined}
                        onMoveDown={index < departments.length - 1 ? () => handleMove(index, 'down', departments, updateDepartment) : undefined}
                    />
                ))}
            </div>
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

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Input
                    placeholder="新しい作業種別..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd}><Plus size={20} /></Button>
            </div>
            <div className="space-y-2">
                {workTypes.map((item, index) => (
                    <ListItem
                        key={item.id}
                        item={item}
                        onUpdate={(u) => updateWorkType(item.id, u)}
                        onDelete={() => { if (confirm('削除しますか？')) deleteWorkType(item.id); }}
                        onMoveUp={index > 0 ? () => handleMove(index, 'up', workTypes, updateWorkType) : undefined}
                        onMoveDown={index < workTypes.length - 1 ? () => handleMove(index, 'down', workTypes, updateWorkType) : undefined}
                    />
                ))}
            </div>
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

    const filteredTasks = detailTasks;

    return (
        <div className="space-y-6">
            {/* Add New Form */}
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

            {/* List */}
            <div className="space-y-4">
                <h3 className="font-bold text-slate-700 dark:text-slate-300">登録済み作業一覧</h3>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {filteredTasks.map((item, index) => (
                        <ListItem
                            key={item.id}
                            item={item}
                            onUpdate={(u) => updateDetailTask(item.id, u)}
                            onDelete={() => { if (confirm('削除しますか？')) deleteDetailTask(item.id); }}
                            onMoveUp={index > 0 ? () => handleMove(index, 'up', filteredTasks, updateDetailTask) : undefined}
                            onMoveDown={index < filteredTasks.length - 1 ? () => handleMove(index, 'down', filteredTasks, updateDetailTask) : undefined}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Reordering Logic ---
const handleMove = async (index: number, direction: 'up' | 'down', items: any[], updateFunc: (id: string, u: any) => Promise<any>) => {
    // Basic bounds check
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    // Create a new array with swapped elements
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];

    // Robust re-indexing: 
    // We check ALL items. Any item whose 'order' property does not match its new array index (1-based) gets updated.
    // This fixes gaps, duplicates, and applies the swap.
    const updates = newItems
        .map((item, idx) => ({ item, newOrder: idx + 1 }))
        .filter(({ item, newOrder }) => item.order !== newOrder);

    // Execute updates
    // Note: We use the passed updateFunc. 
    // Optimization: If the user has many items, this might fire many requests. 
    // Since this is indexedDB local, it's fast.
    await Promise.all(updates.map(({ item, newOrder }) => updateFunc(item.id, { order: newOrder })));
};

// Generic List Item
const ListItem = ({
    item,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown
}: {
    item: any,
    onUpdate: (p: any) => void,
    onDelete: () => void,
    onMoveUp?: () => void,
    onMoveDown?: () => void
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
                <div className="flex flex-col gap-0.5 mr-1">
                    <button
                        onClick={onMoveUp}
                        disabled={!onMoveUp}
                        className={clsx("p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors", !onMoveUp && "opacity-20 cursor-default")}
                    >
                        <ChevronUp size={14} className="text-slate-500" />
                    </button>
                    <button
                        onClick={onMoveDown}
                        disabled={!onMoveDown}
                        className={clsx("p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors", !onMoveDown && "opacity-20 cursor-default")}
                    >
                        <ChevronDown size={14} className="text-slate-500" />
                    </button>
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
