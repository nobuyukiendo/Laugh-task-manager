import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, WorkLog } from '../db';
import { useMaster } from '../contexts/MasterContext';
import { useSettings } from '../contexts/SettingsContext';
import { Card, Button, Input, Select, Label } from '../components/ui';
import { format, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, Trash2, Edit2, UploadCloud, CalendarCheck, Plus, X, Book, History as HistoryIcon, AlertCircle } from 'lucide-react';
import { EditLogModal } from '../components/EditLogModal';
import { useGoogleCalendar, ImportEvent } from '../hooks/useGoogleCalendar';
import { ImportGCalModal } from '../components/ImportGCalModal';
import { useTheme } from '../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';

export const TimelinePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [justAddedLogId, setJustAddedLogId] = useState<string | null>(() => {
        return (location.state as any)?.highlightedLogId || null;
    });

    const { settings } = useSettings();
    const { departments, workTypes, detailTasks, recentDetailTasks, addDetailTask, addRecentDetailTask } = useMaster();

    // Date Navigation
    const [viewDate, setViewDate] = useState(new Date());
    const { syncLog, fetchEventsForImport } = useGoogleCalendar();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Sync State
    const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});
    const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; status: 'idle' | 'running' | 'done' }>({
        current: 0,
        total: 0,
        status: 'idle'
    });
    const [missingEvents, setMissingEvents] = useState<ImportEvent[]>([]);

    // Scroll & Highlight Effect
    React.useEffect(() => {
        if (justAddedLogId) {
            // Scroll to the element
            setTimeout(() => {
                const el = document.getElementById(`log-${justAddedLogId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);

            // Flash effect for 3 seconds
            const timer = setTimeout(() => {
                setJustAddedLogId(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [justAddedLogId]);

    const [manualForm, setManualForm] = useState({
        startTime: '',
        endTime: '',
        deptId: '',
        workTypeId: '',
        note: ''
    });

    const [manualDetailNames, setManualDetailNames] = useState<string[]>([]);
    const [manualDetailInput, setManualDetailInput] = useState('');
    const [saveToMaster, setSaveToMaster] = useState(false);

    const normalizeTaskName = (name: string) => {
        return name
            .replace(/　/g, ' ') // 全角スペースを半角に
            .replace(/\s+/g, ' ') // 連続する空白を1つに
            .trim();
    };

    const timezone = settings?.timezone || 'UTC';
    const dateKey = settings ? formatInTimeZone(viewDate, timezone, 'yyyy-MM-dd') : format(viewDate, 'yyyy-MM-dd');

    const logs = useLiveQuery(async () => {
        return await db.workLogs
            .where('dateKey').equals(dateKey)
            .and(l => l.status === 'done' || l.status === 'canceled')
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
        // Clear errors on date change
        setSyncErrors({});
        setMissingEvents([]);
        setSyncProgress({ current: 0, total: 0, status: 'idle' });
    };

    const handleBulkSync = async () => {
        if (!logs || !settings?.calendar.connected) {
            alert("設定画面でGoogleカレンダーと連携してください。");
            return;
        }

        if (!confirm("表示中のログをカレンダーへ転記しますか？")) return;

        const targetLogs = logs.filter(l => l.status === 'done');
        setSyncProgress({ current: 0, total: targetLogs.length, status: 'running' });
        setSyncErrors({}); // Clear previous errors

        let updatedCount = 0;
        let createdCount = 0;
        let failedCount = 0;
        const newErrors: Record<string, string> = {};

        for (let i = 0; i < targetLogs.length; i++) {
            const log = targetLogs[i];
            setSyncProgress(prev => ({ ...prev, current: i + 1 }));

            try {
                const result = await syncLog(log, false);
                if (result.status === 'CREATED') createdCount++;
                else if (result.status === 'UPDATED') updatedCount++;
                else if (result.status === 'COLLISION_ERROR') {
                    failedCount++;
                    const event = result.collisionEvents ? result.collisionEvents[0] : null;
                    newErrors[log.id] = `時間が重複する予定があります: ${event?.summary || '不明な予定'}`;
                }
            } catch (e: any) {
                if (e.message === "AUTH_EXPIRED") {
                    console.warn("Sync logs interrupted due to auth expiration.");
                    // No alert needed, UI handles connected=false
                    break;
                }
                failedCount++;
                console.error("Sync failed for log", log.id, e);
                newErrors[log.id] = "転記中にエラーが発生しました";
            }
        }

        setSyncErrors(newErrors);
        setSyncProgress(prev => ({ ...prev, status: 'done' }));

        setTimeout(() => {
            // Optional: reset progress after a few seconds? 
            // Or keep it visible. Let's keep it until date change or next action.
        }, 5000);

        if (failedCount > 0) {
            alert(`転記完了\n作成: ${createdCount}件\n更新: ${updatedCount}件\n失敗: ${failedCount}件 (赤枠の項目を確認してください)`);
        } else {
            alert(`転記完了\n作成: ${createdCount}件\n更新: ${updatedCount}件`);
        }
    };

    const handleSingleSync = async (log: WorkLog) => {
        try {
            // Clear specific error first
            setSyncErrors(prev => {
                const next = { ...prev };
                delete next[log.id];
                return next;
            });

            const result = await syncLog(log, false);
            if (result.status === 'CREATED') alert("カレンダーに登録しました！");
            else if (result.status === 'UPDATED') alert("カレンダーを更新しました！");
            else if (result.status === 'COLLISION_ERROR') {
                const event = result.collisionEvents ? result.collisionEvents[0] : null;
                const msg = `時間が重複する予定があります: ${event?.summary || '不明な予定'}`;
                setSyncErrors(prev => ({ ...prev, [log.id]: msg }));
                alert(`登録できません。\n${msg}`);
            }
        } catch (e: any) {
            if (e.message === "AUTH_EXPIRED") {
                return; // Silent return
            }
            setSyncErrors(prev => ({ ...prev, [log.id]: "転記中にエラーが発生しました" }));
            alert("転記に失敗しました");
        }
    };

    const handleVerifySync = async () => {
        if (!logs || !settings?.calendar.connected) return;

        setSyncProgress({ current: 0, total: 0, status: 'running' }); // Indeterminate or just busy state
        setMissingEvents([]); // Clear previous missing events

        try {
            const events = await fetchEventsForImport(viewDate);
            const newErrors: Record<string, string> = {};
            let mismatchCount = 0;
            let warningCount = 0;
            const syncedEventIds = new Set<string>();

            // 1. Correctness Check (Log -> GCal)
            logs.forEach(log => {
                if (log.status !== 'done') return;

                const logStart = Math.floor(log.startAt / 1000) * 1000;
                // const logEnd = Math.floor((log.endAt || 0) / 1000) * 1000;

                // Case 1: Linked Log (Check existence & consistency)
                if (log.calendar?.synced && log.calendar.eventId) {
                    const ev = events.find(e => e.id === log.calendar?.eventId);
                    if (!ev) {
                        newErrors[log.id] = "Googleカレンダー上の予定が見つかりません (削除された可能性があります)";
                        mismatchCount++;
                    } else {
                        syncedEventIds.add(ev.id); // Mark as accounted for
                        const evStart = Math.floor(ev.startAt / 1000) * 1000;
                        if (Math.abs(logStart - evStart) > 60000) {
                            newErrors[log.id] = `時間が一致しません (Log: ${formatInTimeZone(log.startAt, timezone, 'HH:mm')}, GCal: ${formatInTimeZone(ev.startAt, timezone, 'HH:mm')})`;
                            mismatchCount++;
                        }
                    }
                }
                // Case 2: Unlinked Log
                else {
                    const overlapEv = events.find(ev => {
                        if (ev.id === log.calendar?.eventId) return false;
                        return ev.startAt < (log.endAt || 0) && ev.endAt > log.startAt;
                    });

                    if (overlapEv) {
                        // Collision (Error)
                        newErrors[log.id] = `カレンダーに重複する予定があります (未連携): ${overlapEv.summary}`;
                        syncedEventIds.add(overlapEv.id); // Account for it to avoid double warning
                        mismatchCount++;
                    } else {
                        // No Collision but Not Synced (Warning)
                        newErrors[log.id] = "⚠️ カレンダーに連携されていません";
                        warningCount++;
                    }
                }
            });

            // 2. Completeness Check (GCal -> Log)
            // Identify events in GCal that are NOT linked to any log AND didn't collide with any unlinked log.
            const orphans = events.filter(ev => !syncedEventIds.has(ev.id));
            setMissingEvents(orphans);

            setSyncErrors(prev => ({ ...prev, ...newErrors }));

            const totalIssues = mismatchCount + warningCount + orphans.length;

            if (totalIssues === 0) {
                alert("カレンダーとの整合性を確認しました。\n問題は見つかりませんでした。");
            } else {
                alert(`確認完了: ${totalIssues}件の問題が見つかりました。\n(エラー: ${mismatchCount}件, 警告: ${warningCount}件, カレンダーのみ: ${orphans.length}件)\n画面の表示を確認してください。`);
            }

        } catch (e: any) {
            if (e.message === "AUTH_EXPIRED") return;
            console.error(e);
            alert("検証中にエラーが発生しました");
        } finally {
            setSyncProgress({ current: 0, total: 0, status: 'idle' });
        }
    };

    const addManualDetail = async (input: string) => {
        const normalized = normalizeTaskName(input);
        if (!normalized) return;

        if (!manualDetailNames.includes(normalized)) {
            setManualDetailNames(prev => [...prev, normalized]);
            if (saveToMaster) {
                const exists = detailTasks.find(d => normalizeTaskName(d.name) === normalized);
                if (!exists) {
                    await addDetailTask({
                        name: normalized,
                        workTypeId: manualForm.workTypeId || ''
                    });
                }
            }
            await addRecentDetailTask(normalized, manualForm.workTypeId || '');
        }
        setManualDetailInput('');
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

            {/* Warning for Missing Events */}
            {missingEvents.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r shadow-sm">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold mb-2">
                        <AlertCircle size={20} />
                        <h3>履歴に登録されていないカレンダー予定 ({missingEvents.length}件)</h3>
                    </div>
                    <div className="space-y-1">
                        {missingEvents.map(ev => (
                            <div key={ev.id} className="text-sm text-amber-900 dark:text-amber-100 flex items-center gap-2">
                                <span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded text-xs">
                                    {formatInTimeZone(ev.startAt, timezone, 'HH:mm')} - {formatInTimeZone(ev.endAt, timezone, 'HH:mm')}
                                </span>
                                <span>{ev.summary}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                        ※ 「カレンダーからインポート」ボタンで取り込めます。
                    </div>
                </div>
            )}

            {/* Authentication Expired Banner */}
            {!settings?.calendar.connected && (settings?.calendar.tokenExpiresAt || 0) > 0 && Date.now() > (settings?.calendar.tokenExpiresAt || 0) && (
                <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 font-bold">
                            <AlertCircle size={20} />
                            <h3>Google連携の有効期限（目安:約60分）が切れました</h3>
                        </div>
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                            セキュリティのため定期的にログアウトされます。再ログインすればすぐに復帰できます。
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => navigate('/settings')}
                        className="bg-orange-600 hover:bg-orange-700 text-white shrink-0 shadow-sm"
                    >
                        設定を開く
                    </Button>
                </div>
            )}

            {settings?.calendar.connected && (
                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                        <Button
                            variant={syncProgress.status === 'running' ? 'ghost' : 'secondary'}
                            size="sm"
                            disabled={syncProgress.status === 'running'}
                            onClick={handleVerifySync}
                            className={`gap-2 ${syncProgress.status !== 'running' ? 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300' : ''}`}
                        >
                            <CalendarCheck size={16} />
                            {syncProgress.status === 'running' ? '確認中...' : '整合性チェック'}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={syncProgress.status === 'running'}
                            onClick={handleBulkSync}
                            className="bg-slate-700 hover:bg-slate-600 text-white dark:bg-slate-700 dark:hover:bg-slate-600"
                        >
                            <UploadCloud size={16} className="mr-2" />
                            {syncProgress.status === 'running'
                                ? `転記中... (${syncProgress.current}/${syncProgress.total})`
                                : `カレンダーへ一括転記`}
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2">
                {settings?.calendar.connected && (
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowImportModal(true)}
                        className="gap-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                        <CalendarCheck size={16} className="text-cyan-500" />
                        カレンダーからインポート
                    </Button>
                )}
                <Button
                    size="sm"
                    variant={showManualEntry ? 'ghost' : 'secondary'}
                    onClick={() => setShowManualEntry(!showManualEntry)}
                    className={showManualEntry ? "text-slate-500" : ""}
                >
                    {showManualEntry ? <><X size={16} className="mr-1" /> 閉じる</> : <><Plus size={16} className="mr-1" /> 手動で追加</>}
                </Button>
            </div>

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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-slate-600 dark:text-slate-400 font-bold">部門 *</Label>
                            <Select
                                value={manualForm.deptId}
                                onChange={e => setManualForm({ ...manualForm, deptId: e.target.value })}
                                className="bg-white dark:bg-black text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 font-bold"
                            >
                                <option value="">(選択してください)</option>
                                {departments.filter(d => d.enabled).map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
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
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Detail Task Input */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-slate-600 dark:text-slate-400 font-bold block mb-0">詳細作業</Label>
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

                        <div className="flex flex-wrap gap-2">
                            {manualDetailNames.map((name, i) => (
                                <span key={i} className="flex items-center gap-1 px-2 py-1 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 rounded-full text-xs">
                                    {name}
                                    <button type="button" onClick={() => setManualDetailNames(prev => prev.filter((_, idx) => idx !== i))}><X size={12} /></button>
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <Input
                                value={manualDetailInput}
                                onChange={e => setManualDetailInput(e.target.value)}
                                placeholder="作業名を追加..."
                                onKeyDown={e => {
                                    if (e.key === 'Enter') { e.preventDefault(); addManualDetail(manualDetailInput); }
                                }}
                                className="flex-1 bg-white dark:bg-black border-slate-300 dark:border-slate-600"
                            />
                            <div className="relative">
                                <Select
                                    value=""
                                    onChange={e => e.target.value && addManualDetail(e.target.value)}
                                    className="w-10 h-full opacity-0 absolute inset-0 cursor-pointer z-10"
                                >
                                    <option value="" disabled className="font-bold text-slate-500">【マスタ】</option>
                                    {detailTasks.filter(d => d.enabled).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </Select>
                                <Button variant="secondary" className="h-full px-2"><Book size={16} /></Button>
                            </div>
                            <div className="relative">
                                <Select
                                    value=""
                                    onChange={e => e.target.value && addManualDetail(e.target.value)}
                                    className="w-10 h-full opacity-0 absolute inset-0 cursor-pointer z-10"
                                >
                                    <option value="" disabled className="font-bold text-slate-500">【履歴】</option>
                                    {recentDetailTasks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                </Select>
                                <Button variant="secondary" className="h-full px-2"><HistoryIcon size={16} /></Button>
                            </div>
                        </div>
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

                            if (endAt <= startAt) {
                                alert('終了時刻は開始時刻より後である必要があります');
                                return;
                            }

                            // Process any remaining text in the manualDetailInput
                            let finalNamesRaw = [...manualDetailNames];
                            const currentInput = normalizeTaskName(manualDetailInput);
                            if (currentInput && !finalNamesRaw.includes(currentInput)) {
                                finalNamesRaw.push(currentInput);
                                // Save to master if requested
                                if (saveToMaster) {
                                    const exists = detailTasks.find(d => normalizeTaskName(d.name) === currentInput);
                                    if (!exists) {
                                        await addDetailTask({
                                            name: currentInput,
                                            workTypeId: manualForm.workTypeId || ''
                                        });
                                    }
                                }
                                await addRecentDetailTask(currentInput, manualForm.workTypeId || '');
                            }

                            const durationSec = Math.floor((endAt - startAt) / 1000);
                            const finalNames = finalNamesRaw.map(normalizeTaskName).filter(Boolean);
                            const derivedIds = finalNames.map(name =>
                                detailTasks.find(d => normalizeTaskName(d.name) === name)?.id
                            ).filter(Boolean) as string[];

                            await db.workLogs.add({
                                id: crypto.randomUUID(),
                                dateKey: today,
                                departmentId: manualForm.deptId,
                                workTypeId: manualForm.workTypeId || '',
                                detailTaskIds: derivedIds,
                                detailTaskNames: finalNames,
                                note: '', // Removed note field
                                startAt,
                                endAt,
                                durationSec,
                                status: 'done',
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                                timezone: timezone
                            });
                            setManualForm({ startTime: '', endTime: '', deptId: '', workTypeId: '', note: '' });
                            setManualDetailNames([]);
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
                    const startStr = formatInTimeZone(log.startAt, timezone, 'HH:mm');
                    const endStr = log.endAt ? formatInTimeZone(log.endAt, timezone, 'HH:mm') : '??:??';
                    const durationMin = Math.floor((log.durationSec || 0) / 60);

                    const hasError = !!syncErrors[log.id];

                    return (
                        <div key={log.id} id={`log-${log.id}`} className={`group relative pl-4 border-l-2 ${justAddedLogId === log.id ? 'border-pink-500 ring-2 ring-pink-500 ring-opacity-50 rounded-r-lg' : 'border-slate-700'} hover:border-cyan-500 transition-all duration-500`}>
                            <div className={`absolute -left-[5px] top-4 w-2 h-2 rounded-full ${justAddedLogId === log.id ? 'bg-pink-500 animate-ping' : 'bg-slate-700'} group-hover:bg-cyan-500 transition-colors`} />

                            <Card className={`p-4 flex flex-col gap-2 ${justAddedLogId === log.id
                                ? 'bg-pink-50 dark:bg-pink-900/20'
                                : hasError
                                    ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-400 dark:border-rose-600'
                                    : 'bg-white dark:bg-slate-900'
                                } data-[dark]:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-800`}>
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
                                        {(log.detailTaskNames && log.detailTaskNames.length > 0) ? (
                                            <span className="px-2 py-0.5 bg-slate-800 dark:bg-slate-700 rounded text-xs text-slate-300">
                                                {log.detailTaskNames.join('、')}
                                            </span>
                                        ) : log.detailTaskIds.length > 0 ? (
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

                                    {/* Error Message */}
                                    {hasError && (
                                        <div className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-bold bg-white dark:bg-slate-900 p-2 rounded border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                                            <AlertCircle size={14} />
                                            {syncErrors[log.id]}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-2 flex justify-end">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={log.calendar?.synced ? "text-green-500 hover:text-green-600" : "text-slate-400 hover:text-cyan-500"}
                                        onClick={() => handleSingleSync(log)}
                                        disabled={!settings?.calendar.connected}
                                        title={!settings?.calendar.connected ? "カレンダー未連携" : (log.calendar?.synced ? "再同期 (上書き)" : "カレンダーへ転記")}
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

            {showImportModal && (
                <ImportGCalModal
                    onClose={() => setShowImportModal(false)}
                    onImportSuccess={() => {
                        // Success toast or refresh logic if needed
                    }}
                />
            )}
        </div>
    );
};
