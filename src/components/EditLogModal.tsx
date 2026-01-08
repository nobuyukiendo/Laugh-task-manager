import React, { useState } from 'react';
import { WorkLog, db } from '../db';
import { Card, Button, Input, Select, Label } from './ui';
import { useMaster } from '../contexts/MasterContext';
import { useSettings } from '../contexts/SettingsContext';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { X, Book, History as HistoryIcon } from 'lucide-react';

export const EditLogModal: React.FC<{ log: WorkLog; onClose: () => void }> = ({ log, onClose }) => {
    const { departments, workTypes, detailTasks, recentDetailTasks, addDetailTask, addRecentDetailTask } = useMaster();
    const { settings } = useSettings();
    const { syncLog } = useGoogleCalendar();
    const tz = settings?.timezone || 'UTC';

    // Form State
    const [deptId, setDeptId] = useState(log.departmentId);
    const [workTypeId, setWorkTypeId] = useState(log.workTypeId);
    const [detailNames, setDetailNames] = useState<string[]>(log.detailTaskNames || []);
    const [detailInput, setDetailInput] = useState('');
    const [saveToMaster, setSaveToMaster] = useState(false);

    const normalizeTaskName = (name: string) => {
        return name
            .replace(/　/g, ' ') // 全角スペースを半角に
            .replace(/\s+/g, ' ') // 連続する空白を1つに
            .trim();
    };

    const toLocalISO = (ts: number | undefined) => {
        if (!ts) return '';
        return formatInTimeZone(ts, tz, "yyyy-MM-dd'T'HH:mm");
    };

    const [startStr, setStartStr] = useState(toLocalISO(log.startAt));
    const [endStr, setEndStr] = useState(toLocalISO(log.endAt));
    const [error, setError] = useState('');

    const handleSave = async () => {
        setError('');
        if (!deptId) { setError('部門は必須です'); return; }
        if (!startStr) { setError('開始時間は必須です'); return; }
        if (!endStr) { setError('終了時間は必須です'); return; }

        const startTs = toDate(startStr, { timeZone: tz }).getTime();
        const endTs = toDate(endStr, { timeZone: tz }).getTime();

        const sDate = new Date(startTs); sDate.setSeconds(0, 0);
        const eDate = new Date(endTs); eDate.setSeconds(0, 0);
        const finalStart = sDate.getTime();
        const finalEnd = eDate.getTime();

        if (finalEnd <= finalStart) {
            setError('終了日時は開始日時より後にしてください');
            return;
        }

        const durationSec = (finalEnd - finalStart) / 1000;

        // Final Normalized Names
        const finalNames = [...detailNames];
        // Handle pending input if any? 
        // Let's assume they must click "Add" or just use what's inChips.

        // Derive IDs
        const derivedIds = finalNames.map(name =>
            detailTasks.find(d => normalizeTaskName(d.name) === normalizeTaskName(name))?.id
        ).filter(Boolean) as string[];

        // Update Object
        const updatedLog: WorkLog = {
            ...log,
            departmentId: deptId,
            workTypeId: workTypeId,
            detailTaskIds: derivedIds,
            detailTaskNames: finalNames,
            note: '', // Always empty as per user request to remove it
            startAt: finalStart,
            endAt: finalEnd,
            durationSec,
            updatedAt: Date.now()
        };

        await db.workLogs.update(log.id, {
            departmentId: deptId,
            workTypeId: workTypeId,
            detailTaskIds: derivedIds,
            detailTaskNames: finalNames,
            note: '',
            startAt: finalStart,
            endAt: finalEnd,
            durationSec,
            updatedAt: Date.now()
        });

        // Update Calendar if synced
        if (log.calendar?.synced && log.calendar.eventId) {
            try {
                // Remove alert on failure as requested
                await syncLog(updatedLog);
            } catch (e) {
                console.error('Calendar sync failed during edit (silently ignored)', e);
            }
        }

        onClose();
    };

    const addDetail = async (input: string) => {
        const normalized = normalizeTaskName(input);
        if (!normalized) return;

        if (!detailNames.includes(normalized)) {
            setDetailNames(prev => [...prev, normalized]);

            // Handle Master registration if toggle is ON
            if (saveToMaster) {
                const exists = detailTasks.find(d => normalizeTaskName(d.name) === normalized);
                if (!exists) {
                    await addDetailTask({
                        name: normalized,
                        workTypeId: workTypeId || ''
                    });
                }
            }
            // Always add to Recent
            await addRecentDetailTask(normalized, workTypeId || '');
        }
        setDetailInput('');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">ログ編集</h2>
                    <Button variant="ghost" size="sm" onClick={onClose}><X size={20} /></Button>
                </div>

                {error && <div className="mb-4 p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-sm rounded">{error}</div>}

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>開始日時</Label>
                            <Input type="datetime-local" value={startStr} onChange={e => setStartStr(e.target.value)} />
                        </div>
                        <div>
                            <Label>終了日時</Label>
                            <Input type="datetime-local" value={endStr} onChange={e => setEndStr(e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <Label>部門 <span className="text-rose-500">*</span></Label>
                        <Select value={deptId} onChange={e => setDeptId(e.target.value)}>
                            <option value="">(選択してください)</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                    </div>

                    <div>
                        <Label>作業種別 (任意)</Label>
                        <Select value={workTypeId} onChange={e => setWorkTypeId(e.target.value)}>
                            <option value="">(未選択)</option>
                            {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </Select>
                    </div>

                    {/* Detail Task Selection */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="mb-0">詳細作業 (検索/追加)</Label>
                            <label className="flex items-center gap-2 cursor-pointer text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
                                <input
                                    type="checkbox"
                                    checked={saveToMaster}
                                    onChange={e => setSaveToMaster(e.target.checked)}
                                    className="w-3 h-3 rounded border-cyan-300 text-cyan-500 focus:ring-cyan-200"
                                />
                                マスタに保存
                            </label>
                        </div>

                        {/* Selected Chips */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            {detailNames.map((name, i) => (
                                <span key={i} className="flex items-center gap-1 px-2 py-1 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 rounded-full text-xs">
                                    {name}
                                    <button
                                        type="button"
                                        onClick={() => setDetailNames(prev => prev.filter((_, idx) => idx !== i))}
                                        className="hover:text-cyan-600"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>

                        {/* Input row with buttons */}
                        <div className="flex gap-2">
                            <Input
                                value={detailInput}
                                onChange={e => setDetailInput(e.target.value)}
                                placeholder="作業名を入力..."
                                className="flex-1"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addDetail(detailInput);
                                    }
                                }}
                            />

                            {/* Master Tasks Dropdown */}
                            <div className="relative">
                                <Select
                                    value=""
                                    onChange={e => {
                                        if (e.target.value) addDetail(e.target.value);
                                    }}
                                    className="w-10 h-full opacity-0 absolute inset-0 cursor-pointer z-10"
                                >
                                    <option value="" disabled className="font-bold text-slate-500">【マスタ】</option>
                                    {detailTasks.filter(d => d.enabled).map(d => (
                                        <option key={d.id} value={d.name}>{d.name}</option>
                                    ))}
                                </Select>
                                <Button variant="secondary" className="h-full px-2">
                                    <Book size={16} />
                                </Button>
                            </div>

                            {/* Recent Tasks Dropdown */}
                            <div className="relative">
                                <Select
                                    value=""
                                    onChange={e => {
                                        if (e.target.value) addDetail(e.target.value);
                                    }}
                                    className="w-10 h-full opacity-0 absolute inset-0 cursor-pointer z-10"
                                >
                                    <option value="" disabled className="font-bold text-slate-500">【履歴】</option>
                                    {recentDetailTasks.map(r => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                    ))}
                                </Select>
                                <Button variant="secondary" className="h-full px-2">
                                    <HistoryIcon size={16} />
                                </Button>
                            </div>

                            <Button
                                type="button"
                                size="sm"
                                onClick={() => addDetail(detailInput)}
                            >
                                追加
                            </Button>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-2">
                        <Button className="flex-1" onClick={handleSave}>保存して更新</Button>
                        <Button variant="secondary" onClick={onClose}>キャンセル</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
