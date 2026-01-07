import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, WorkLog } from '../db';
import { useMaster } from '../contexts/MasterContext';
import { useSettings } from '../contexts/SettingsContext';
import { Card, Button, Input, Select, Label } from '../components/ui';
import { format, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, Trash2, Edit2, UploadCloud, CalendarCheck, Plus, X } from 'lucide-react';
import { EditLogModal } from '../components/EditLogModal';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useTheme } from '../contexts/ThemeContext';

export const TimelinePage: React.FC = () => {
    const { settings } = useSettings();
    const { departments, workTypes, detailTasks } = useMaster();

    // Date Navigation
    const [viewDate, setViewDate] = useState(new Date());
    const { syncLog, isSyncing } = useGoogleCalendar();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [manualForm, setManualForm] = useState({
        startTime: '',
        endTime: '',
        deptId: '',
        workTypeId: '',
        note: ''
    });

    // Derive date key
    // CAUTION: JS Date is local, but we need to respect formatInTimeZone if user selected a different TZ.
    // For simplicity, we use the selected date as "YYYY-MM-DD" string in local or ensure consistent handling.
    // The DB stores `dateKey` based on the user's preferred TZ at the time of creation.
    // To query correctly, we should probably generate dateKey from the selected Date object using the *current* settings.

    const timezone = settings?.timezone || 'UTC';
    const dateKey = settings ? formatInTimeZone(viewDate, timezone, 'yyyy-MM-dd') : format(viewDate, 'yyyy-MM-dd');

    const logs = useLiveQuery(async () => {
        return await db.workLogs
            .where('dateKey').equals(dateKey)
            .and(l => l.status === 'done' || l.status === 'canceled') // Show done/canceled, running is elsewhere? or include?
            // Usually running is shown separately or at top.
            .sortBy('startAt');
    }, [dateKey]);

    const handleDelete = async (id: string) => {
        if (confirm("このログを削除しますか？")) {
            await db.workLogs.delete(id);
        }
    };

    const changeDate = (days: number) => {
        const d = new Date(viewDate);
        d.setDate(d.getDate() + days);
        setViewDate(d);
    };

    const handleBulkSync = async () => {
        if (!logs || !settings?.calendar.connected) {
            alert("設定画面でGoogleカレンダーと連携してください。");
            return;
        }

        if (!confirm("表示中のログをカレンダーへ転記しますか？")) return;

        let updatedCount = 0;
        let createdCount = 0;

        for (const log of logs) {
            if (log.status !== 'done') continue;

            try {
                // First attempt
                const result = await syncLog(log, false);

                if (result.status === 'CREATED') createdCount++;
                else if (result.status === 'UPDATED') updatedCount++;
                else if (result.status === 'COLLISION_ERROR') {
                    const event = result.collisionEvents ? result.collisionEvents[0] : null;
                    const logStart = formatInTimeZone(log.startAt, log.timezone, 'yyyy/MM/dd HH:mm');
                    const logEnd = log.endAt ? formatInTimeZone(log.endAt, log.timezone, 'HH:mm') : '??:??';

                    const msg = `時間が重複する予定があるため、登録できません。\n\n【登録しようとした履歴】\n${logStart} - ${logEnd}\n\n【重複している予定】\n${event?.summary}\n(${new Date(event?.start.dateTime || '').toLocaleString()} - ${new Date(event?.end.dateTime || '').toLocaleString()})\n\n時間を修正してください。`;
                    alert(msg);
                    // Do not increment counts, do not proceed.
                }
            } catch (e) {
                console.error("Sync failed for log", log.id, e);
            }
        }
        alert(`転記完了\n作成: ${createdCount}件\n更新: ${updatedCount}件`);
    };

    // Single Sync Button Handler
    const handleSingleSync = async (log: WorkLog) => {
        try {
            const result = await syncLog(log, false);
            if (result.status === 'CREATED') alert("カレンダーに登録しました！");
            else if (result.status === 'UPDATED') alert("カレンダーを更新しました！");
            else if (result.status === 'COLLISION_ERROR') {
                const event = result.collisionEvents ? result.collisionEvents[0] : null;
                const logStart = formatInTimeZone(log.startAt, log.timezone, 'yyyy/MM/dd HH:mm');
                const logEnd = log.endAt ? formatInTimeZone(log.endAt, log.timezone, 'HH:mm') : '??:??';

                const msg = `時間が重複する予定があるため、登録できません。\n\n【登録しようとした履歴】\n${logStart} - ${logEnd}\n\n【重複している予定】\n${event?.summary}\n(${new Date(event?.start.dateTime || '').toLocaleString()} - ${new Date(event?.end.dateTime || '').toLocaleString()})\n\n時間を修正してください。`;
                alert(msg);
            }
        } catch (e) {
            alert("転記に失敗しました");
        }
    };

    if (!logs) return <div className="p-8 text-center text-slate-500">Loading...</div>;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h1 style={{ color: isDark ? '#f1f5f9' : '#0f172a' }} className="text-2xl font-bold">今日の流れ (履歴)</h1>

                <div style={{ backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }} className="flex items-center gap-2 p-1 rounded-lg">
                    <Button size="sm" variant="ghost" onClick={() => changeDate(-1)}><ChevronLeft size={16} /></Button>
                    <span style={{ color: isDark ? '#e2e8f0' : '#334155' }} className="text-sm font-mono font-medium px-2">{dateKey}</span>
                    <Button size="sm" variant="ghost" onClick={() => changeDate(1)}><ChevronRight size={16} /></Button>
                </div>
            </div>

            {settings?.calendar.connected && (
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={handleBulkSync} disabled={isSyncing}>
                        <UploadCloud size={16} className="mr-2" />
                        {isSyncing ? '転記中...' : 'カレンダーへ一括転記'}
                    </Button>
                </div>
            )}

            {/* Manual Entry Toggle */}
            <div className="flex justify-end">
                <Button
                    size="sm"
                    variant={showManualEntry ? 'ghost' : 'secondary'}
                    onClick={() => setShowManualEntry(!showManualEntry)}
                    className={showManualEntry ? "text-slate-500" : ""}
                >
                    {showManualEntry ? <><X size={16} className="mr-1" /> 閉じる</> : <><Plus size={16} className="mr-1" /> 手動で追加</>}
                </Button>
            </div>

            {/* Manual Entry Form */}
            {showManualEntry && (
                <Card className="p-4 space-y-4 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-md">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">作業を手動で追加</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-slate-600 dark:text-slate-400 font-bold">開始時刻 *</Label>
                            <Input
                                type="time"
                                value={manualForm.startTime}
                                onChange={e => setManualForm({ ...manualForm, startTime: e.target.value })}
                                className="bg-white dark:bg-black text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
                            />
                        </div>
                        <div>
                            <Label className="text-slate-600 dark:text-slate-400 font-bold">終了時刻 *</Label>
                            <Input
                                type="time"
                                value={manualForm.endTime}
                                onChange={e => setManualForm({ ...manualForm, endTime: e.target.value })}
                                className="bg-white dark:bg-black text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
                            />
                        </div>
                    </div>
                    <div>
                        <Label className="text-slate-600 dark:text-slate-400 font-bold">部門 *</Label>
                        <Select
                            value={manualForm.deptId}
                            onChange={e => setManualForm({ ...manualForm, deptId: e.target.value })}
                            className="bg-white dark:bg-black text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 font-bold"
                        >
                            <option value="">(選択してください)</option>
                            {departments.filter(d => d.enabled).map(d => (
                                <option key={d.id} value={d.id} className="text-slate-900 dark:text-white bg-white dark:bg-black">{d.name}</option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <Label className="text-slate-600 dark:text-slate-400 font-bold">作業種別 (任意)</Label>
                        <Select
                            value={manualForm.workTypeId}
                            onChange={e => setManualForm({ ...manualForm, workTypeId: e.target.value })}
                            className="bg-white dark:bg-black text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 font-bold"
                        >
                            <option value="">(未選択)</option>
                            {workTypes.filter(w => w.enabled).map(w => (
                                <option key={w.id} value={w.id} className="text-slate-900 dark:text-white bg-white dark:bg-black">{w.name}</option>
                            ))}
                        </Select>
                    </div>
                    <Button
                        onClick={async () => {
                            if (!manualForm.startTime || !manualForm.endTime || !manualForm.deptId) {
                                alert('開始時刻、終了時刻、部門は必須です');
                                return;
                            }
                            const today = format(viewDate, 'yyyy-MM-dd');
                            const startAt = parse(`${today} ${manualForm.startTime}`, 'yyyy-MM-dd HH:mm', new Date()).getTime();
                            const endAt = parse(`${today} ${manualForm.endTime}`, 'yyyy-MM-dd HH:mm', new Date()).getTime();

                            // Simple validation
                            if (endAt <= startAt) {
                                alert('終了時刻は開始時刻より後である必要があります');
                                return;
                            }

                            const durationSec = Math.floor((endAt - startAt) / 1000);

                            await db.workLogs.add({
                                id: crypto.randomUUID(),
                                dateKey: today,
                                departmentId: manualForm.deptId,
                                workTypeId: manualForm.workTypeId || '',
                                detailTaskIds: [],
                                note: manualForm.note,
                                startAt,
                                endAt,
                                durationSec,
                                status: 'done',
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                                timezone: timezone
                            });
                            setManualForm({ startTime: '', endTime: '', deptId: '', workTypeId: '', note: '' });
                            setShowManualEntry(false);
                        }}
                        disabled={!manualForm.startTime || !manualForm.endTime || !manualForm.deptId}
                        className="w-full"
                    >
                        <Plus size={16} className="mr-1" /> 追加
                    </Button>
                </Card>
            )}

            <div className="space-y-3">
                {logs.length === 0 && (
                    <div className="text-center py-10 text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        まだ記録がありません
                    </div>
                )}

                {logs.map(log => {
                    // Time Formatting
                    const startStr = formatInTimeZone(log.startAt, timezone, 'HH:mm');
                    const endStr = log.endAt ? formatInTimeZone(log.endAt, timezone, 'HH:mm') : '??:??';
                    const durationMin = Math.floor((log.durationSec || 0) / 60);

                    return (
                        <div key={log.id} className="group relative pl-4 border-l-2 border-slate-700 hover:border-cyan-500 transition-colors">
                            <div className="absolute -left-[5px] top-4 w-2 h-2 rounded-full bg-slate-700 group-hover:bg-cyan-500 transition-colors" />

                            <Card className="p-4 flex flex-col gap-2 bg-white dark:bg-slate-900 data-[dark]:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between items-start">
                                    <div className="text-xs font-mono text-slate-400">
                                        {startStr} - {endStr} <span className="text-slate-500">({durationMin}min)</span>
                                    </div>
                                    <div className="flex bg-slate-900/50 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-1 text-slate-300 hover:text-cyan-400" onClick={() => setEditingLog(log)}><Edit2 size={14} /></button>
                                        <button className="p-1 text-slate-300 hover:text-rose-400" onClick={() => handleDelete(log.id)}><Trash2 size={14} /></button>
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                            {departments.find(d => d.id === log.departmentId)?.name || '(部門不明)'}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            / {workTypes.find(w => w.id === log.workTypeId)?.name || '未分類'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {log.detailTaskIds.length > 0 ? (
                                            log.detailTaskIds.map(did => {
                                                const dName = detailTasks.find(d => d.id === did)?.name;
                                                return dName && (
                                                    <span key={did} className="px-2 py-0.5 bg-slate-800 dark:bg-slate-700 rounded text-xs text-slate-300">
                                                        {dName}
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <span className="text-slate-500 text-xs italic">詳細なし</span>
                                        )}
                                    </div>
                                    {log.note && (
                                        <div className="text-sm text-slate-400 dark:text-slate-400 bg-slate-900/50 dark:bg-slate-800/50 p-2 rounded">
                                            {log.note}
                                        </div>
                                    )}
                                </div>

                                {/* Sync Status / Button */}
                                <div className="mt-2 flex justify-end">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={log.calendar?.synced ? "text-green-500 hover:text-green-600" : "text-slate-400 hover:text-cyan-500"}
                                        onClick={() => handleSingleSync(log)}
                                        title={log.calendar?.synced ? "再同期 (上書き)" : "カレンダーへ転記"}
                                    >
                                        {log.calendar?.synced ? <CalendarCheck size={16} /> : <UploadCloud size={16} />}
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    );
                })}
            </div>

            {editingLog && (
                <EditLogModal log={editingLog} onClose={() => setEditingLog(null)} />
            )}
        </div>
    );
};
