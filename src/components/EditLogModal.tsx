import React, { useState } from 'react';
import { WorkLog, db } from '../db';
import { Card, Button, Input, Select, Label } from './ui';
import { useMaster } from '../contexts/MasterContext';
import { useSettings } from '../contexts/SettingsContext';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { X } from 'lucide-react';

export const EditLogModal: React.FC<{ log: WorkLog; onClose: () => void }> = ({ log, onClose }) => {
    const { departments, workTypes, detailTasks } = useMaster();
    const { settings } = useSettings();
    const { syncLog } = useGoogleCalendar();
    const tz = settings?.timezone || 'UTC';

    // Form State
    const [deptId, setDeptId] = useState(log.departmentId);
    const [workTypeId, setWorkTypeId] = useState(log.workTypeId);
    const [detailIds, setDetailIds] = useState<string[]>(log.detailTaskIds);
    const [note, setNote] = useState(log.note);
    const [detailInput, setDetailInput] = useState(''); // For adding new via search

    // Date Handling: ISO String for input type="datetime-local"
    // Format: "YYYY-MM-DDTHH:mm"
    // We need to convert timestamp -> TZ adjusted local string -> Input value
    // This is tricky without date-fns-tz helpers for "format to local string of specific TZ"
    // But formatInTimeZone does exactly that.

    const toLocalISO = (ts: number | undefined) => {
        if (!ts) return '';
        return formatInTimeZone(ts, tz, "yyyy-MM-dd'T'HH:mm");
    };

    const [startStr, setStartStr] = useState(toLocalISO(log.startAt));
    const [endStr, setEndStr] = useState(toLocalISO(log.endAt));
    const [error, setError] = useState('');

    // Remove filtering by WorkType
    // const filteredDetails = detailTasks.filter(d => d.workTypeId === workTypeId);

    const handleSave = async () => {
        setError('');
        if (!deptId) { setError('部門は必須です'); return; }
        if (!startStr) { setError('開始時間は必須です'); return; }
        if (!endStr) { setError('終了時間は必須です'); return; }

        // Parse back to timestamp
        // We treat the input string as "Time in Target TZ".
        // We need to construct a Date object that represents that time in that TZ, then get timestamp.
        // toDate (from date-fns-tz) helps parse ISO string as if it's in a specific TZ.

        const startTs = toDate(startStr, { timeZone: tz }).getTime();
        const endTs = toDate(endStr, { timeZone: tz }).getTime();

        // Truncate seconds logic: floor to minute
        const sDate = new Date(startTs); sDate.setSeconds(0, 0);
        const eDate = new Date(endTs); eDate.setSeconds(0, 0);
        const finalStart = sDate.getTime();
        const finalEnd = eDate.getTime();

        if (finalEnd <= finalStart) {
            setError('終了日時は開始日時より後にしてください');
            return;
        }

        const durationSec = (finalEnd - finalStart) / 1000;

        // Update Object
        const updatedLog: WorkLog = {
            ...log,
            departmentId: deptId,
            workTypeId: workTypeId,
            detailTaskIds: detailIds,
            note,
            startAt: finalStart,
            endAt: finalEnd,
            durationSec,
            updatedAt: Date.now()
        };

        await db.workLogs.update(log.id, {
            departmentId: deptId,
            workTypeId: workTypeId,
            detailTaskIds: detailIds,
            note,
            startAt: finalStart,
            endAt: finalEnd,
            durationSec,
            updatedAt: Date.now()
        });

        // Update Calendar if synced
        if (log.calendar?.synced && log.calendar.eventId) {
            try {
                await syncLog(updatedLog);
            } catch (e) {
                alert('カレンダー同期の更新に失敗しました');
            }
        }

        onClose();
    };

    const toggleDetail = (id: string) => {
        setDetailIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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

                    {/* Decoupled Detail Task Selection */}
                    <div>
                        <Label className="mb-2 block">詳細作業 (検索/追加)</Label>

                        {/* Selected Chips */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            {detailIds.map(did => {
                                const d = detailTasks.find(t => t.id === did);
                                return d ? (
                                    <span key={did} className="flex items-center gap-1 px-2 py-1 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 rounded-full text-xs">
                                        {d.name}
                                        <button type="button" onClick={() => toggleDetail(did)} className="hover:text-cyan-600"><X size={12} /></button>
                                    </span>
                                ) : null;
                            })}
                        </div>

                        {/* Dropdown / Input wrapper */}
                        <div className="flex gap-2">
                            <Input
                                list="all-details"
                                value={detailInput}
                                onChange={e => setDetailInput(e.target.value)}
                                placeholder="作業名を入力または選択..."
                                className="flex-1"
                            />
                            <datalist id="all-details">
                                {detailTasks.map(d => (
                                    <option key={d.id} value={d.name} />
                                ))}
                            </datalist>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                    if (!detailInput.trim()) return;
                                    const match = detailTasks.find(d => d.name === detailInput.trim());
                                    if (match) {
                                        if (!detailIds.includes(match.id)) setDetailIds([...detailIds, match.id]);
                                        setDetailInput('');
                                    } else {
                                        // Option to create new on the fly? Or forbid?
                                        // User said "Change to dropdown".
                                        // Let's assume selecting existing is priority.
                                        alert("一覧にある作業を選択してください (編集画面では新規作成不可)");
                                    }
                                }}
                            >
                                追加
                            </Button>
                        </div>
                    </div>

                    <div>
                        <Label>メモ (自由入力)</Label>
                        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="備考・詳細など" />
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
