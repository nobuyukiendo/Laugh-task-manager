import React, { useRef } from 'react';
import { Input } from '../ui';
import { Book, Trash2, History as HistoryIcon } from 'lucide-react';
import { Button } from '../ui';
import { MetricEntry } from '../../db';
import { useMaster } from '../../contexts/MasterContext';

interface MetricEntryFieldProps {
    metric: MetricEntry;
    onChange: (metric: MetricEntry) => void;
    onDelete: () => void;
}

export const MetricEntryField: React.FC<MetricEntryFieldProps> = ({ metric, onChange, onDelete }) => {
    const { metricMasters, metricHistories } = useMaster();
    const historySelectRef = useRef<HTMLSelectElement>(null);
    const masterSelectRef = useRef<HTMLSelectElement>(null);

    const [localName, setLocalName] = React.useState(metric.name);
    const [localUnit, setLocalUnit] = React.useState(metric.unit);

    // Synchronize local state when prop changes (e.g. from context/db)
    React.useEffect(() => {
        setLocalName(metric.name);
    }, [metric.name]);

    React.useEffect(() => {
        setLocalUnit(metric.unit);
    }, [metric.unit]);

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Convert full-width to half-width
        const halfWidth = raw.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        const numValue = parseFloat(halfWidth);
        onChange({ ...metric, value: isNaN(numValue) ? 0 : numValue });
    };

    const handleBlur = () => {
        // Synchronize to parent (DB) only on blur to avoid IME interference
        if (localName !== metric.name || localUnit !== metric.unit) {
            onChange({ ...metric, name: localName, unit: localUnit });
        }
    };

    const handleNameSelect = (name: string, unit: string) => {
        setLocalName(name);
        setLocalUnit(unit);
        onChange({ ...metric, name, unit });
    };

    return (
        <div className="p-4 bg-surface/50 border border-border rounded-xl mb-3 last:mb-0 transition-all hover:border-primary/30">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" data-theme-role="primary" />
                    <span className="text-xs font-bold text-sub-text truncate">メトリクスセット</span>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={metric.isMasterLinked}
                            onChange={(e) => onChange({ ...metric, isMasterLinked: e.target.checked })}
                            className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary transition-all group-hover:border-primary"
                        />
                        <span className="text-[10px] font-bold text-sub-text group-hover:text-primary transition-colors">マスタに保存</span>
                    </label>
                    <button
                        onClick={onDelete}
                        className="p-1.5 text-sub-text hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="削除"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {/* Metric Name Input with Icon Triggers */}
                <div>
                    <span className="text-[10px] font-bold text-sub-text mb-1 block">メトリクス名</span>
                    <div className="flex gap-2 text-main-text">
                        <div className="relative flex-1 group">
                            <Input
                                placeholder="項目名を入力"
                                value={localName}
                                onChange={(e) => setLocalName(e.target.value)}
                                onBlur={handleBlur}
                                onDoubleClick={() => historySelectRef.current?.showPicker()}
                                className="bg-input-bg text-input-text border-border rounded-xl"
                                data-theme-role="inputBg"
                                title="ダブルクリックで履歴を表示"
                            />
                        </div>

                        {/* Master Tasks Dropdown Icon */}
                        <div className="relative">
                            <select
                                ref={masterSelectRef}
                                value=""
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const parts = val.split('|');
                                    if (parts.length === 2) {
                                        handleNameSelect(parts[0], parts[1]);
                                    }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                title="マスタから選択"
                            >
                                <option value="" disabled>【マスタ】</option>
                                {metricMasters.filter(m => m.enabled).map(m => (
                                    <option key={m.id} value={`${m.name}|${m.defaultUnit}`}>{m.name}</option>
                                ))}
                                {metricMasters.length === 0 && <option value="" disabled>マスタなし</option>}
                            </select>
                            <Button variant="secondary" className="h-full px-3 bg-button-bg text-button-text hover:opacity-80 border border-border rounded-xl" title="マスタから選択">
                                <Book size={18} />
                            </Button>
                        </div>

                        {/* Recent Tasks Dropdown Icon */}
                        <div className="relative">
                            <select
                                ref={historySelectRef}
                                value=""
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const parts = val.split('|');
                                    if (parts.length === 2) {
                                        handleNameSelect(parts[0], parts[1]);
                                    }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                title="履歴から選択"
                            >
                                <option value="" disabled>【履歴】</option>
                                {metricHistories.map(h => (
                                    <option key={h.id} value={`${h.name}|${h.unit}`}>{h.name}</option>
                                ))}
                                {metricHistories.length === 0 && <option value="" disabled>履歴なし</option>}
                            </select>
                            <Button variant="secondary" className="h-full px-3 bg-button-bg text-button-text hover:opacity-80 border border-border rounded-xl" title="履歴から選択">
                                <HistoryIcon size={18} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Value & Unit */}
                <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                        <span className="text-[10px] font-bold text-sub-text mb-1 block">数値</span>
                        <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={metric.value === 0 ? '' : metric.value}
                            onChange={handleValueChange}
                            className="text-right font-mono bg-input-bg text-input-text border-border rounded-xl"
                            data-theme-role="inputBg"
                        />
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-sub-text mb-1 block">単位</span>
                        <Input
                            placeholder="単位を入力"
                            value={localUnit}
                            onChange={(e) => setLocalUnit(e.target.value)}
                            onBlur={handleBlur}
                            className="bg-input-bg text-input-text border-border rounded-xl"
                            data-theme-role="inputBg"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
