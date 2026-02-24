import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus } from 'lucide-react';
import { Button } from '../ui';
import { MetricEntry } from '../../db';
import { MetricEntryField } from './MetricEntryField';

interface MetricsInputListProps {
    metrics: MetricEntry[];
    onChange: (metrics: MetricEntry[]) => void;
}

export const MetricsInputList: React.FC<MetricsInputListProps> = ({ metrics, onChange }) => {
    const handleAdd = () => {
        const newMetric: MetricEntry = {
            id: uuidv4(),
            name: '',
            value: 0,
            unit: '',
            isMasterLinked: false
        };
        onChange([...metrics, newMetric]);
    };

    const handleUpdate = (id: string, updated: MetricEntry) => {
        onChange(metrics.map(m => m.id === id ? updated : m));
    };

    const handleDelete = (id: string) => {
        onChange(metrics.filter(m => m.id !== id));
    };

    return (
        <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-sub-text">メトリクス (計測指標)</label>
                <div className="h-[1px] flex-1 mx-4 bg-border/40" />
            </div>

            <div className="space-y-1">
                {metrics.map((metric) => (
                    <MetricEntryField
                        key={metric.id}
                        metric={metric}
                        onChange={(updated) => handleUpdate(metric.id, updated)}
                        onDelete={() => handleDelete(metric.id)}
                    />
                ))}
            </div>

            <Button
                variant="secondary"
                size="sm"
                onClick={handleAdd}
                className="w-full mt-3 border-dashed border-2 py-3 bg-transparent hover:bg-primary/5 hover:border-primary/40 text-sub-text hover:text-primary group transition-all"
            >
                <Plus size={16} className="mr-2 group-hover:scale-110 transition-transform" />
                <span className="font-bold">メトリクス追加</span>
            </Button>

            <p className="mt-2 text-[10px] text-sub-text/60 leading-relaxed italic">
                ※ タスクの振り返りや観測に役立つ数値を記録できます。入力は任意です。
            </p>
        </div>
    );
};
