import React, { useState, useEffect } from 'react';
import { db, WorkLog } from '../db';
import { Card, Button, Label, Input } from './ui';
import { useMaster } from '../contexts/MasterContext';
import { useSettings } from '../contexts/SettingsContext';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { format } from 'date-fns';
import { X, Calendar, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ImportEvent {
    id: string;
    summary: string;
    startAt: number;
    endAt: number;
    deptId: string;
    wtId: string;
    detail: string;
    isDuplicate?: boolean;
    selected: boolean;
}

export const ImportGCalModal: React.FC<{ onClose: () => void; onImportSuccess: () => void }> = ({ onClose, onImportSuccess }) => {
    const { settings } = useSettings();
    const { departments, workTypes } = useMaster();
    const { fetchEventsForImport } = useGoogleCalendar();

    const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [events, setEvents] = useState<ImportEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');

    const loadEvents = async () => {
        setLoading(true);
        setError('');
        try {
            const date = new Date(targetDate);
            const fetched = await fetchEventsForImport(date);

            // Duplication Check
            const dateKey = format(date, 'yyyy-MM-dd');
            const existingLogs = await db.workLogs.where('dateKey').equals(dateKey).toArray();

            const processed = fetched.map(e => {
                const isDup = existingLogs.some(l =>
                    l.startAt === e.startAt &&
                    l.endAt === e.endAt &&
                    l.status !== 'canceled'
                );
                return {
                    ...e,
                    isDuplicate: isDup,
                    selected: !isDup // Default checked if not duplicate
                } as ImportEvent;
            });

            setEvents(processed);
        } catch (e: any) {
            setError('イベントの取得に失敗しました。連携状況を確認してください。');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (settings?.calendar?.connected) {
            loadEvents();
        } else {
            setError('Googleカレンダーが連携されていません。設定画面で連携してください。');
        }
    }, [targetDate]);

    const handleImport = async () => {
        const toImport = events.filter(e => e.selected);
        if (toImport.length === 0) return;

        setImporting(true);
        try {
            const tz = settings?.timezone || 'Asia/Tokyo';

            for (const item of toImport) {
                const dateKey = format(new Date(item.startAt), 'yyyy-MM-dd');

                const newLog: WorkLog = {
                    id: uuidv4(),
                    status: 'done',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    timezone: tz,
                    dateKey: dateKey,
                    departmentId: item.deptId || '',
                    workTypeId: item.wtId || '',
                    detailTaskIds: [],
                    detailTaskNames: item.detail ? [item.detail] : [],
                    note: '',
                    startAt: item.startAt,
                    endAt: item.endAt,
                    durationSec: (item.endAt - item.startAt) / 1000,
                    calendar: {
                        synced: true,
                        eventId: item.id,
                        lastSyncedAt: Date.now()
                    }
                };

                await db.workLogs.add(newLog);
            }

            onImportSuccess();
            onClose();
        } catch (e: any) {
            setError('登録中にエラーが発生しました。');
            console.error(e);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                        <Calendar className="text-cyan-500" size={20} />
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">カレンダーからインポート</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}><X size={20} /></Button>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <Label className="text-[10px] mb-1">対象日</Label>
                            <Input
                                type="date"
                                value={targetDate}
                                onChange={e => setTargetDate(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={loadEvents}
                            disabled={loading || !settings?.calendar?.connected}
                            className="h-9"
                        >
                            再読込
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-900">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <Loader2 className="animate-spin mb-2" size={32} />
                            <p>イベントを取得中...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-lg text-sm flex items-center gap-2">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 italic">
                            対象日のイベントが見つかりません
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-[10px] text-slate-500 font-medium px-1">
                                形式：【部門】【作業種別】詳細作業 を自動解析します
                            </p>
                            {events.map((ev, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-lg border flex items-start gap-3 transition-all ${ev.selected
                                            ? 'bg-cyan-50/50 dark:bg-cyan-900/10 border-cyan-200 dark:border-cyan-800 shadow-sm'
                                            : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-60'
                                        }`}
                                >
                                    <div className="pt-1">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                            checked={ev.selected}
                                            onChange={e => {
                                                const newEvs = [...events];
                                                newEvs[idx].selected = e.target.checked;
                                                setEvents(newEvs);
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                {format(new Date(ev.startAt), 'HH:mm')} - {format(new Date(ev.endAt), 'HH:mm')}
                                            </span>
                                            {ev.isDuplicate && (
                                                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <AlertCircle size={10} />
                                                    登録済み
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {ev.summary}
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${ev.deptId ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 border border-indigo-200 dark:border-indigo-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                                部門: {departments.find(d => d.id === ev.deptId)?.name || '未一致'}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${ev.wtId ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 border border-pink-200 dark:border-pink-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                                種別: {workTypes.find(w => w.id === ev.wtId)?.name || '未一致'}
                                            </span>
                                        </div>
                                        {ev.detail && (
                                            <div className="text-[10px] text-slate-500 italic pl-1 border-l-2 border-slate-200 dark:border-slate-700 mt-1">
                                                詳細: {ev.detail}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-3 bg-white dark:bg-slate-900">
                    <Button
                        className="flex-1 gap-2"
                        disabled={loading || importing || events.filter(e => e.selected).length === 0}
                        onClick={handleImport}
                    >
                        {importing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        {events.filter(e => e.selected).length} 件をインポート
                    </Button>
                    <Button variant="secondary" onClick={onClose} disabled={importing}>キャンセル</Button>
                </div>
            </Card>
        </div>
    );
};
