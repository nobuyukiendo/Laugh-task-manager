import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, Button } from './ui';
import { X, BarChart2 } from 'lucide-react';
import { MetricsInputList } from './metrics/MetricsInputList';
import { MetricEntry, db } from '../db';
import { useMaster } from '../contexts/MasterContext';
import { validateMetrics } from '../utils/metrics';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface DailyMetricModalProps {
    dateKey: string; // YYYY-MM-DD
    onClose: () => void;
}

export const DailyMetricModal: React.FC<DailyMetricModalProps> = ({ dateKey, onClose }) => {
    const { addMetricMaster, addMetricHistory } = useMaster();

    // 既存データの読み込み
    const existing = useLiveQuery(
        () => db.dailyMetrics.where('dateKey').equals(dateKey).toArray(),
        [dateKey]
    ) || [];

    const [entries, setEntries] = useState<MetricEntry[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleEditExisting = (dm: any) => {
        setEntries(dm.entries);
        setEditingId(dm.id);
    };

    const cancelEdit = () => {
        setEntries([]);
        setEditingId(null);
    };

    const handleSave = async () => {
        const { error, validMetrics } = validateMetrics(entries);
        if (error) {
            alert(error);
            return;
        }

        if (validMetrics.length === 0) {
            alert('メトリクスを1つ以上入力してください。');
            return;
        }

        setSaving(true);
        try {
            // マスタ・履歴への保存
            for (const m of validMetrics) {
                await addMetricHistory(m.name, m.unit);
                if (m.isMasterLinked) {
                    await addMetricMaster({ name: m.name, defaultUnit: m.unit, enabled: true });
                }
            }

            const now = Date.now();
            if (editingId) {
                const existingItem = await db.dailyMetrics.get(editingId);
                if (existingItem) {
                    await db.dailyMetrics.put({
                        ...existingItem,
                        entries: validMetrics,
                        updatedAt: now,
                    });
                }
            } else {
                await db.dailyMetrics.add({
                    id: uuidv4(),
                    dateKey,
                    entries: validMetrics,
                    createdAt: now,
                    updatedAt: now,
                });
            }

            onClose();
        } catch (e) {
            console.error(e);
            alert('保存中にエラーが発生しました。');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteExisting = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('この日次メトリクスを削除しますか？')) return;
        await db.dailyMetrics.delete(id);
        if (editingId === id) cancelEdit();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <BarChart2 size={20} className="text-cyan-500" />
                        <div>
                            <h2 className="text-base font-bold text-main-text">日次メトリクス入力</h2>
                            <p className="text-[11px] text-slate-500">{dateKey} の数値記録</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}><X size={18} /></Button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* 既存データ */}
                    {existing.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">保存済み（クリックで編集）</p>
                            <div className="space-y-2">
                                {existing.map(dm => (
                                    <div
                                        key={dm.id}
                                        className={`p-3 ${editingId === dm.id ? 'bg-cyan-50/50 dark:bg-cyan-900/20 border-cyan-500' : 'bg-slate-50 dark:bg-slate-900/50 border-border hover:border-cyan-300'} rounded-xl border transition-all cursor-pointer`}
                                        onClick={() => handleEditExisting(dm)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-wrap gap-2">
                                                {dm.entries.map((e, i) => (
                                                    <span key={i} className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 px-2 py-0.5 rounded-md font-mono">
                                                        {e.name}: <strong>{e.value}</strong> {e.unit}
                                                    </span>
                                                ))}
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteExisting(e, dm.id)}
                                                className="ml-2 p-1 text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {format(dm.createdAt, 'HH:mm')} に保存
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 新規・編集入力セット */}
                    <div className={editingId ? 'p-3 rounded-xl border border-cyan-500 bg-cyan-50/20 dark:bg-cyan-900/10' : ''}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {editingId ? '編集中' : '新規入力'}
                            </p>
                            {editingId && (
                                <button onClick={cancelEdit} className="text-[10px] text-slate-500 hover:text-slate-700 underline">編集をキャンセル</button>
                            )}
                        </div>
                        <div className="bg-white/50 dark:bg-slate-900/50 p-3 rounded-xl border border-border">
                            <MetricsInputList
                                metrics={entries}
                                onChange={setEntries}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-border flex gap-3">
                    <Button variant="ghost" className="flex-1" onClick={onClose}>キャンセル</Button>
                    <Button className="flex-1" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : '保存する'}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
