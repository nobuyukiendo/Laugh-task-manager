import React, { useRef } from 'react';
import { Input, Button } from './ui';
import { Book, History as HistoryIcon } from 'lucide-react';
import { useMaster } from '../contexts/MasterContext';

interface SmartDetailInputProps {
    value: string;
    onChange: (value: string) => void;
    saveToMaster: boolean;
    onSaveToMasterChange: (checked: boolean) => void;
}

export const SmartDetailInput: React.FC<SmartDetailInputProps> = ({ value, onChange, saveToMaster, onSaveToMasterChange }) => {
    const { detailTasks, recentDetailTasks } = useMaster();
    const historySelectRef = useRef<HTMLSelectElement>(null);

    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-sub-text">作業詳細 (自由入力)</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary hover:opacity-80 transition-opacity" data-theme-role="primary">
                    <input
                        type="checkbox"
                        checked={saveToMaster}
                        onChange={e => onSaveToMasterChange(e.target.checked)}
                        className="w-4 h-4 rounded border-primary text-primary focus:ring-primary"
                        data-theme-role="primary"
                    />
                    マスタに保存
                </label>
            </div>
            <div className="relative group">
                <div className="flex gap-2">
                    <Input
                        placeholder="作業詳細を入力..."
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        onDoubleClick={() => historySelectRef.current?.showPicker()}
                        className="flex-1 bg-input-bg text-input-text border-border rounded-xl py-3 placeholder-sub-text/50"
                        data-theme-role="inputBg"
                        title="ダブルクリックで履歴を表示"
                    />

                    {/* Master Tasks Dropdown */}
                    <div className="relative">
                        <select
                            value=""
                            onChange={e => {
                                if (e.target.value) onChange(e.target.value);
                            }}
                            className="w-12 h-full opacity-0 absolute inset-0 cursor-pointer z-10 bg-input-bg text-input-text"
                            title="マスタから選択"
                        >
                            <option value="" disabled>【マスタ】</option>
                            {detailTasks.filter(d => d.enabled).map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                        <Button variant="secondary" className="h-full px-3 bg-button-bg text-button-text hover:opacity-80 border border-border" title="マスタから選択">
                            <Book size={18} />
                        </Button>
                    </div>

                    {/* Recent Tasks Dropdown */}
                    <div className="relative">
                        <select
                            ref={historySelectRef}
                            value=""
                            onChange={e => {
                                if (e.target.value) onChange(e.target.value);
                            }}
                            className="w-12 h-full opacity-0 absolute inset-0 cursor-pointer z-10 bg-input-bg text-input-text"
                            title="履歴から選択"
                        >
                            <option value="" disabled>【履歴】</option>
                            {recentDetailTasks.map(r => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                        </select>
                        <Button variant="secondary" className="h-full px-3 bg-button-bg text-button-text hover:opacity-80 border border-border" title="履歴から選択">
                            <HistoryIcon size={18} />
                        </Button>
                    </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                    ※ 直接入力するか、右側のボタンからマスタ・履歴を呼び出せます
                </p>
            </div>
        </div>
    );
};
