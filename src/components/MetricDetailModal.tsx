import React from 'react';
import { Card, Button, Label } from './ui';
import { X, Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface MetricLogEntry {
    logId: string;
    value: number;
    unit: string;
    timestamp: number;
    deptName?: string;
    wtName?: string;
    detailNames?: string[];
    durationSec?: number;
}

interface MetricDetailModalProps {
    metricName: string;
    unit: string;
    entries: MetricLogEntry[];
    onClose: () => void;
    onEditEntry?: (id: string) => void;
    onInsertAggregate?: () => void;
    totalDurationSec?: number;
}

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({ metricName, unit, entries, onClose, onEditEntry, onInsertAggregate, totalDurationSec }) => {
    // Sort entries by timestamp descending
    const sortedEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);

    const totalMetricValue = entries.reduce((sum, e) => sum + e.value, 0);
    const taskCount = entries.length;

    // Analysis metrics
    const totalMinutes = totalDurationSec ? totalDurationSec / 60 : 0;

    // ① 単位1／時間（作業密度）
    const unitPerHour = totalMinutes > 0 ? (totalMetricValue / totalMinutes) * 60 : 0;

    // ② 時間／単位1（作業の重さ）
    const timePerUnit = totalMetricValue > 0 ? totalMinutes / totalMetricValue : 0;

    const formatWeight = (val: number) => {
        if (val === 0) return '0';
        if (val < 0.01) return val.toFixed(5);
        if (val < 1) return val.toFixed(3);
        return val.toFixed(1);
    };

    const formatDuration = (sec: number) => {
        const min = Math.round(sec / 60);
        if (min >= 60) return `${(sec / 3600).toFixed(1)}h`;
        return `${min}min`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            {metricName}
                            <small className="ml-2 text-xs font-normal text-slate-500">[{unit}]</small>
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">詳細ログ一覧 ({entries.length}件)</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {onInsertAggregate && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onInsertAggregate}
                                className="h-9 gap-1.5 px-3 text-xs font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800/50 hover:bg-cyan-50 dark:hover:bg-cyan-900/30"
                            >
                                <Plus size={14} />
                                週報に追加
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={onClose}><X size={20} /></Button>
                    </div>
                </div>

                {totalDurationSec !== undefined && (
                    <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-border p-6 grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="space-y-1">
                            <Label className="uppercase tracking-widest text-[10px]">メトリクス合計</Label>
                            <div className="text-xl font-black text-slate-700 dark:text-slate-200">
                                {totalMetricValue}<small className="ml-1 text-xs font-normal text-slate-500">{unit}</small>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="uppercase tracking-widest text-[10px]">作業時間合計</Label>
                            <div className="text-xl font-black text-slate-700 dark:text-slate-200">
                                {formatDuration(totalDurationSec)}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="uppercase tracking-widest text-[10px]">該当タスク数</Label>
                            <div className="text-lg font-black text-slate-700 dark:text-slate-200">
                                {taskCount}<small className="ml-1 text-xs font-normal text-slate-500">件</small>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="uppercase tracking-widest text-[10px] text-cyan-600 dark:text-cyan-400">作業密度（単位／時間）</Label>
                            <div className="text-xl font-black text-cyan-600 dark:text-cyan-400">
                                {Math.round(unitPerHour).toLocaleString()}<small className="ml-1 text-xs font-normal opacity-70">{unit}／時</small>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="uppercase tracking-widest text-[10px] text-cyan-600 dark:text-cyan-400">作業の重さ（時間／単位）</Label>
                            <div className="text-xl font-black text-cyan-600 dark:text-cyan-400">
                                {formatWeight(timePerUnit)}<small className="ml-1 text-xs font-normal opacity-70">分／{unit}</small>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                        {sortedEntries.map((entry, i) => (
                            <div
                                key={i}
                                className={`p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border flex items-center justify-between transition-all ${onEditEntry ? 'cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-50/10 active:scale-[0.98]' : ''}`}
                                onClick={() => onEditEntry?.(entry.logId)}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-tighter">
                                        <Calendar size={12} />
                                        {format(entry.timestamp, 'yyyy/MM/dd HH:mm')}
                                    </div>
                                    <div className="text-sm font-semibold text-main-text">
                                        {entry.deptName}
                                        {entry.wtName && ` / ${entry.wtName}`}
                                    </div>
                                    {entry.detailNames && entry.detailNames.length > 0 && (
                                        <div className="text-[10px] text-slate-500">
                                            {entry.detailNames.join(', ')}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-black text-cyan-500">
                                        {entry.value}
                                        <small className="ml-1 text-[10px] text-slate-400 font-normal">{entry.unit}</small>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {entries.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                データがありません
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-border bg-slate-50/50 dark:bg-slate-900/20">
                    <Button className="w-full" onClick={onClose}>閉じる</Button>
                </div>
            </Card>
        </div>
    );
};
