import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MetricMaster } from '../db';
import { Card, Button } from './ui';
import { X, Plus, PlusCircle, CheckCircle2, Info } from 'lucide-react';
import { useMaster } from '../contexts/MasterContext';

interface UnregisteredMetricsModalProps {
    onClose: () => void;
}

interface UnregisteredMetric {
    name: string;
    unit: string;
    count: number;
}

export const UnregisteredMetricsModal: React.FC<UnregisteredMetricsModalProps> = ({ onClose }) => {
    const { metricMasters, addMetricMaster } = useMaster();

    // WorkLogとDailyMetricからメトリクスを抽出
    const workLogs = useLiveQuery(() => db.workLogs.toArray(), []) || [];
    const dailyMetrics = useLiveQuery(() => db.dailyMetrics.toArray(), []) || [];

    const unregisteredList = useMemo(() => {
        const masterNames = new Set(metricMasters.map(m => m.name));
        const usageMap = new Map<string, { unit: string; count: number }>();

        // タスクログからの抽出
        workLogs.forEach(log => {
            if (!log.metrics) return;
            log.metrics.forEach(m => {
                if (!m.name || masterNames.has(m.name)) return;

                const existing = usageMap.get(m.name);
                if (existing) {
                    existing.count += 1;
                } else {
                    usageMap.set(m.name, { unit: m.unit || '', count: 1 });
                }
            });
        });

        // 日次メトリクスからの抽出
        dailyMetrics.forEach(dm => {
            if (!dm.entries) return;
            dm.entries.forEach(e => {
                if (!e.name || masterNames.has(e.name)) return;

                const existing = usageMap.get(e.name);
                if (existing) {
                    existing.count += 1;
                } else {
                    usageMap.set(e.name, { unit: e.unit || '', count: 1 });
                }
            });
        });

        const list: UnregisteredMetric[] = [];
        usageMap.forEach((val, name) => {
            list.push({ name, unit: val.unit, count: val.count });
        });

        return list.sort((a, b) => b.count - a.count);
    }, [workLogs, dailyMetrics, metricMasters]);

    const handleRegisterSingle = async (m: UnregisteredMetric) => {
        await addMetricMaster({
            name: m.name,
            defaultUnit: m.unit,
            enabled: true,
            order: metricMasters.length + 1
        } as Omit<MetricMaster, 'id'>);
    };

    const handleRegisterAll = async () => {
        if (unregisteredList.length === 0) return;

        let currentOrder = metricMasters.length + 1;
        for (const m of unregisteredList) {
            await addMetricMaster({
                name: m.name,
                defaultUnit: m.unit,
                enabled: true,
                order: currentOrder++
            } as Omit<MetricMaster, 'id'>);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border-cyan-500/20">
                <div className="p-6 border-b border-border flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                            <PlusCircle size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-main-text">未登録メトリクスの一覧</h2>
                            <p className="text-xs text-slate-400">ログには存在するがマスタに未登録の項目です</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full w-10 h-10 p-0 hover:bg-slate-800">
                        <X size={20} />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {unregisteredList.length > 0 ? (
                        <>
                            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 flex gap-3 items-start">
                                <Info size={18} className="text-cyan-500 shrink-0 mt-0.5" />
                                <div className="text-sm text-slate-600 dark:text-slate-300">
                                    <p className="font-bold text-cyan-500 mb-1">マスタ登録のメリット</p>
                                    <p>マスタに登録することで、クロス分析での利用や、入力時のサジェスト機能が有効になります。</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-xs font-bold text-slate-500">{unregisteredList.length} 件の未登録項目</span>
                                <Button size="sm" onClick={handleRegisterAll} className="bg-cyan-600 hover:bg-cyan-700 text-xs gap-1.5 h-8">
                                    <Plus size={14} /> すべてマスタに登録
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {unregisteredList.map(m => (
                                    <div key={m.name} className="group flex items-center justify-between p-4 bg-surface rounded-xl border border-border hover:border-cyan-500/30 transition-all shadow-sm">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-bold text-sm text-main-text">{m.name}</span>
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">{m.unit || '単位なし'}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                <CheckCircle2 size={10} /> {m.count} 回の使用履歴あり
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleRegisterSingle(m)}
                                            className="h-8 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Plus size={14} /> 登録
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="py-16 text-center text-slate-500">
                            <CheckCircle2 size={48} className="mx-auto mb-4 text-slate-200 dark:text-slate-800" />
                            <p className="text-sm font-medium">未登録のメトリクスはありません</p>
                            <p className="text-xs mt-1">すべてのメトリクスが正しくマスタ管理されています。</p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-border bg-slate-900/30 flex justify-end">
                    <Button onClick={onClose} variant="ghost" className="px-8 hover:bg-slate-800">
                        閉じる
                    </Button>
                </div>
            </Card>
        </div>
    );
};
