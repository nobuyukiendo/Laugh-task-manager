import React, { useState } from 'react';
import { Button, Input, Select, Label } from '../components/ui';
import { useTimer } from '../contexts/TimerContext';
import { useMaster } from '../contexts/MasterContext';
import { Play } from 'lucide-react';
import { ActiveTimer } from '../components/ActiveTimer';

export const TimerPage: React.FC = () => {
    const { activeLog, startTimer, stopTimer, updateActiveNote } = useTimer();
    const { departments, workTypes, detailTasks, addDetailTask } = useMaster();

    // Form State
    const [deptId, setDeptId] = useState('');
    const [workTypeId, setWorkTypeId] = useState('');
    const [detailName, setDetailName] = useState('');
    const [note, setNote] = useState('');

    const handleStart = async () => {
        if (!deptId) {
            alert('部門は必須です');
            return;
        }

        // Resolve Detail Task
        let finalDetailIds: string[] = [];
        const trimmedDetail = detailName.trim();

        if (trimmedDetail) {
            const exact = detailTasks.find(d => d.name === trimmedDetail);
            if (exact) {
                finalDetailIds = [exact.id];
            } else {
                // Register new
                const newId = await addDetailTask({
                    name: trimmedDetail,
                    workTypeId: workTypeId || '', // Link if workType selected
                });
                finalDetailIds = [newId];
            }
        }

        await startTimer(deptId, workTypeId, finalDetailIds, note);

        // Reset form
        setDeptId('');
        setWorkTypeId('');
        setDetailName('');
        setNote('');
    };

    if (activeLog) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent mb-6 flex items-center gap-2 font-['Zen_Maru_Gothic']">
                    <Play className="text-pink-500 fill-current" /> 計測中...
                </h1>
                <ActiveTimer
                    log={activeLog}
                    onStop={stopTimer}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-['Zen_Maru_Gothic']">
                <Play className="text-pink-500 fill-current" /> 作業を開始
            </h1>

            <div className="space-y-6 bg-white dark:bg-slate-900/50 p-6 rounded-[24px] shadow-sm border border-pink-100 dark:border-slate-800">

                {/* Dept */}
                <div>
                    <Label className="text-pink-600 dark:text-pink-400 font-bold mb-1 block">部門 <span className="text-rose-500">*</span></Label>
                    <Select
                        value={deptId}
                        onChange={e => setDeptId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-pink-100 dark:border-slate-700 focus:border-pink-400 focus:ring-pink-200 rounded-xl py-3"
                    >
                        <option value="">(選択してください)</option>
                        {departments.filter(d => d.enabled).map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </Select>
                </div>

                {/* Work Type */}
                <div>
                    <Label className="text-slate-600 dark:text-slate-400 font-bold mb-1 block">作業種別 (任意)</Label>
                    <Select
                        value={workTypeId}
                        onChange={e => setWorkTypeId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-pink-100 dark:border-slate-700 focus:border-pink-400 focus:ring-pink-200 rounded-xl py-3"
                    >
                        <option value="">(未選択)</option>
                        {workTypes.filter(w => w.enabled).map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </Select>
                </div>

                {/* Detail Task (Free Input + Global Suggestions) */}
                <div>
                    <Label className="text-slate-600 dark:text-slate-400 font-bold mb-1 block">作業詳細 (自由入力 / 検索)</Label>
                    <div className="relative">
                        <Input
                            list="detail-tasks-list"
                            value={detailName}
                            onChange={e => setDetailName(e.target.value)}
                            placeholder="作業詳細を入力..."
                            className="w-full bg-slate-50 dark:bg-slate-800 border-pink-100 dark:border-slate-700 rounded-xl py-3"
                        />
                        <datalist id="detail-tasks-list">
                            {detailTasks.map(d => (
                                <option key={d.id} value={d.name} />
                            ))}
                        </datalist>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">※ 履歴から検索するか、新しい作業名を入力してください</p>
                </div>

                <div className="pt-4">
                    <Button
                        onClick={handleStart}
                        disabled={!deptId}
                        className="w-full py-4 text-lg font-bold rounded-2xl bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-400 hover:to-violet-400 text-white shadow-lg shadow-pink-200 dark:shadow-pink-900/20 transform transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play className="mr-2 fill-current" />
                        計測開始
                    </Button>
                </div>
            </div>
        </div>
    );
};
