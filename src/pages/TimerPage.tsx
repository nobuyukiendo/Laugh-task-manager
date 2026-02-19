import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimer } from '../contexts/TimerContext';
import { useMaster } from '../contexts/MasterContext';
import { useSettings } from '../contexts/SettingsContext';
import { Button, Input, Select, Label } from '../components/ui';
import { Play, CheckCircle2, X, Edit2 } from 'lucide-react';
import { WorkLog, db } from '../db';
import { format } from 'date-fns';
import { ActiveTimer } from '../components/ActiveTimer';
import { SmartDetailInput } from '../components/SmartDetailInput';
import { useLiveQuery } from 'dexie-react-hooks';

export const TimerPage: React.FC = () => {
    const timerContext = useTimer();
    const { activeLog, lastFinishedLog, startTimer, stopTimer } = timerContext;

    // Track the recently finished log reactively
    const recentLog = useLiveQuery<WorkLog | undefined>(
        async () => {
            if (!lastFinishedLog) return undefined;
            return await db.workLogs.get(lastFinishedLog.id);
        },
        [lastFinishedLog?.id]
    );

    const masterContext = useMaster();
    const { departments, workTypes, detailTasks, partners, locations, addDetailTask, addRecentDetailTask } = masterContext;
    const settingsContext = useSettings();
    const { settings } = settingsContext;
    const navigate = useNavigate();

    // Form State
    const [deptId, setDeptId] = useState(() => localStorage.getItem('defaultDeptId') || '');
    const [workTypeId, setWorkTypeId] = useState('');
    const [detailName, setDetailName] = useState('');
    const [saveToMaster, setSaveToMaster] = useState(false);
    const [note, setNote] = useState('');

    // Notification State
    const [showRegistered, setShowRegistered] = useState(false);

    // Persist DeptId
    useEffect(() => {
        if (deptId) {
            localStorage.setItem('defaultDeptId', deptId);
        }
    }, [deptId]);

    // Handle auto-hide only
    useEffect(() => {
        if (showRegistered) {
            const timer = setTimeout(() => setShowRegistered(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [showRegistered]);

    const normalizeTaskName = (name: string) => {
        return name
            .replace(/　/g, ' ') // 全角スペースを半角に
            .replace(/\s+/g, ' ') // 連続する空白を1つに
            .trim();
    };

    const handleStart = async () => {
        if (!deptId) {
            alert('部門は必須です');
            return;
        }

        const normalizedName = normalizeTaskName(detailName);
        let finalDetailIds: string[] = [];
        let finalDetailNames: string[] = [];

        if (normalizedName) {
            finalDetailNames = [normalizedName];

            // 1. Always add to Recent
            await addRecentDetailTask(normalizedName, workTypeId || '');

            // 2. Conditional Master Save
            const exactMaster = detailTasks.find(d => normalizeTaskName(d.name) === normalizedName);
            if (exactMaster) {
                finalDetailIds = [exactMaster.id];
            } else if (saveToMaster) {
                const newId = await addDetailTask({
                    name: normalizedName,
                    workTypeId: workTypeId || '',
                });
                finalDetailIds = [newId];
            }
        }

        await startTimer(deptId, workTypeId, finalDetailIds, finalDetailNames, note);

        // Reset form (except deptId)
        setWorkTypeId('');
        setDetailName('');
        setSaveToMaster(false);
        setNote('');
        setShowRegistered(false);
    };

    const handleStop = async () => {
        // Capture current log before stopping
        const currentLog = activeLog;
        if (!currentLog) return; // Guard: prevent crash if activeLog is null

        await stopTimer();

        // Show notification manually on user action
        setShowRegistered(true);

        // Guard: Handle undefined settings with default
        const afterMeasurement = settings?.afterMeasurement ?? 'stay';

        if (afterMeasurement === 'navigate') {
            navigate('/timeline', { state: { highlightedLogId: currentLog.id } });
        }
    };

    if (activeLog) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent mb-6 flex items-center gap-2 font-['Zen_Maru_Gothic']">
                    <Play className="text-pink-500 fill-current" /> 計測中...
                </h1>
                <ActiveTimer
                    log={activeLog}
                    departmentName={departments.find(d => d.id === activeLog.departmentId)?.name}
                    workTypeName={workTypes.find(w => w.id === activeLog.workTypeId)?.name}
                    detailName={activeLog.detailTaskNames?.[0] || (activeLog.detailTaskIds.length > 0 ? '詳細タスクあり' : '')}
                    onStop={handleStop}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-['Zen_Maru_Gothic']">
                <Play className="text-pink-500 fill-current" /> 作業を開始
            </h1>

            {/* Notification Banner */}
            {showRegistered && (
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 font-bold">
                        <CheckCircle2 size={20} />
                        登録しました
                    </div>
                    <button onClick={() => setShowRegistered(false)} className="text-green-600 hover:text-green-800 dark:hover:text-green-200">
                        <X size={18} />
                    </button>
                </div>
            )}

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

                {/* Detail Task */}
                <SmartDetailInput
                    value={detailName}
                    onChange={setDetailName}
                    saveToMaster={saveToMaster}
                    onSaveToMasterChange={setSaveToMaster}
                />

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

                {/* Text Generator Panel */}
                <TextGeneratorPanel
                    workTypeId={workTypeId}
                    workTypes={workTypes}
                    partners={partners}
                    locations={locations}
                    onApply={(text) => setDetailName(text)}
                />
            </div>

            {/* Last Log Summary (Stay Mode) */}
            {recentLog && (
                <EditableLogCard log={recentLog} departments={departments} workTypes={workTypes} />
            )}
        </div>
    );
};

// --- Editable Log Card ---
const EditableLogCard: React.FC<{ log: WorkLog; departments: any[]; workTypes: any[] }> = ({ log, departments, workTypes }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValues, setEditValues] = useState({ start: '', end: '' });

    // Initialize inputs when entering edit mode
    useEffect(() => {
        if (isEditing) {
            setEditValues({
                start: format(log.startAt, 'HH:mm'),
                end: log.endAt ? format(log.endAt, 'HH:mm') : ''
            });
        }
    }, [isEditing, log]);

    const handleSave = async () => {
        if (!editValues.start || !editValues.end) return;

        const baseDate = new Date(log.startAt);
        const [startH, startM] = editValues.start.split(':').map(Number);
        const [endH, endM] = editValues.end.split(':').map(Number);

        // Construct new timestamps properly preserving the original date
        const newStart = new Date(baseDate);
        newStart.setHours(startH, startM, 0, 0);

        const newEnd = new Date(baseDate);
        newEnd.setHours(endH, endM, 0, 0);

        // Validate time range
        if (newEnd < newStart) {
            alert('終了時刻は開始時刻より後の時間を指定してください');
            return;
        }

        const durationSec = (newEnd.getTime() - newStart.getTime()) / 1000;

        await db.workLogs.update(log.id, {
            startAt: newStart.getTime(),
            endAt: newEnd.getTime(),
            durationSec,
            updatedAt: Date.now()
        });

        setIsEditing(false);
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        return `${m}分`;
    };

    if (isEditing) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 shadow-lg animate-in zoom-in-95 duration-200">
                <h3 className="text-xs font-bold text-indigo-500 mb-3 flex items-center justify-between">
                    <span>時間を編集</span>
                    <span className="text-[10px] text-slate-400">※直近の1件のみ</span>
                </h3>
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 block mb-1">開始</label>
                        <input
                            type="time"
                            value={editValues.start}
                            onChange={e => setEditValues({ ...editValues, start: e.target.value })}
                            className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm font-bold text-center"
                        />
                    </div>
                    <div className="text-slate-300 mt-4">→</div>
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 block mb-1">終了</label>
                        <input
                            type="time"
                            value={editValues.end}
                            onChange={e => setEditValues({ ...editValues, end: e.target.value })}
                            className="w-full bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm font-bold text-center"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 rounded-lg shadow-md transition-all flex items-center gap-1"
                    >
                        <CheckCircle2 size={12} />
                        保存
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 group relative cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                }}
                className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                title="時間を編集"
            >
                <Edit2 size={14} />
            </button>

            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">今回登録した内容</h3>
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {departments.find(d => d.id === log.departmentId)?.name || '部門不明'}
                        {log.workTypeId && (
                            <>
                                <span className="text-slate-300 mx-1">/</span>
                                {workTypes.find(w => w.id === log.workTypeId)?.name || ''}
                            </>
                        )}
                    </div>
                    {(log.detailTaskNames?.[0] || log.detailTaskIds.length > 0) && (
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                            {log.detailTaskNames?.[0] || '詳細タスク'}
                        </div>
                    )}
                </div>
                <div className="text-right pr-2">
                    <div className="text-lg font-black font-mono text-cyan-600 dark:text-cyan-400">
                        {formatTime(log.durationSec)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                        {format(log.startAt, 'HH:mm')} - {log.endAt ? format(log.endAt, 'HH:mm') : '???'}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Text Generator Panel ---
interface TextGeneratorPanelProps {
    workTypeId: string;
    workTypes: any[];
    partners: any[];
    locations: any[];
    onApply: (text: string) => void;
}

const TextGeneratorPanel: React.FC<TextGeneratorPanelProps> = ({ workTypeId, workTypes, partners, locations, onApply }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [action, setAction] = useState<'send' | 'check' | 'mtg'>('send');
    const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
    const [locationId, setLocationId] = useState('');
    const [content, setContent] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const targetWorkType = workTypes.find(w => w.id === workTypeId);
    const isMessage = targetWorkType && (targetWorkType.name.includes('社内メッセージ') || targetWorkType.name.includes('社内メッセージ確認'));
    const isMtg = targetWorkType && targetWorkType.name.includes('社内MTG');

    React.useEffect(() => {
        if (isMessage) {
            setIsVisible(true);
            if (targetWorkType.name.includes('確認')) {
                setAction('check');
            } else {
                setAction('send');
            }
        } else if (isMtg) {
            setIsVisible(true);
            setAction('mtg');
        } else {
            setIsVisible(false);
        }
    }, [workTypeId, isMessage, isMtg, targetWorkType]);

    if (!isVisible) return null;

    const locationName = locations.find(l => l.id === locationId)?.name || '';
    const locationPrefix = locationName ? `${locationName}で、` : '';

    const getPartnerNames = () => {
        if (selectedPartnerIds.length === 0) return '';
        return partners
            .filter(p => selectedPartnerIds.includes(p.id))
            .map(p => p.name)
            .join(', ');
    };

    const partnerNames = getPartnerNames();

    let generatedText = '';
    let isValid = false;

    if (action === 'mtg') {
        // MTG Template: {Location}で、{Partner}と、{Content}についてMTG
        // Parts are optional
        const parts = [];
        if (locationName) parts.push(`${locationName}で`);
        if (partnerNames) parts.push(`${partnerNames}と`);
        if (content) parts.push(`${content}について`);

        generatedText = `${parts.join('、')}MTG`;
        // Remove leading/trailing comma if any weirdness, but join handles it.
        // Actually, if parts is empty -> "MTG". The user requested strict template.
        // "{Location}で、{Partner}と、{Content}についてMTG"
        // Let's stick closer to the REQUESTED format but handle missing parts gracefully or strictly?
        // User said: "・{場所}、{相手}は未入力でも使用可能とする" (Location and Partner can be empty)
        // User said: "・未入力項目がある場合でも、エラーとせず保存できること" (Can save even with empty items)

        // Re-constructing with exact requested separators if the item exists
        let text = '';
        if (locationName) text += `${locationName}で、`;
        if (partnerNames) text += `${partnerNames}と、`;
        if (content) text += `${content}について`;
        text += 'MTG';

        generatedText = text;
        isValid = true; // Always valid for MTG as per requirements

    } else {
        // Message Modes
        generatedText = action === 'send'
            ? `${locationPrefix}${partnerNames}に${content}についてのメッセージ送信`
            : `${locationPrefix}${partnerNames}の${content}についてのメッセージ確認`;

        isValid = selectedPartnerIds.length > 0 && content.trim().length > 0;
    }

    const togglePartner = (id: string) => {
        setSelectedPartnerIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    return (
        <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl animate-in fade-in slide-in-from-top-2">
            <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
                <span className="bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded text-xs">便利機能</span>
                詳細作業 文面生成
            </h3>

            <div className="space-y-4">
                {/* Action Selector (Visible if Message Type, or maybe just hidden if MTG specific?) */}
                {/* User didn't say to hide it, but if auto-selected, maybe show state? */}
                {/* Let's show buttons to allow toggling if they want manually? No, it's driven by work type. */}
                {/* But the UI showed buttons. Let's keep them read-only or selectable if applicable. */}
                {/* Actually for MTG, it switches to MTG mode. Send/Check are for Message. */}

                <div className="flex items-center gap-2">
                    <div className="flex flex-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                        {action === 'mtg' ? (
                            <button
                                className="flex-1 py-1.5 text-xs font-bold rounded-md transition-all bg-pink-500 text-white shadow-sm pointer-events-none"
                            >
                                社内MTG
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => setAction('send')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${action === 'send' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    送信（〜に）
                                </button>
                                <button
                                    onClick={() => setAction('check')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${action === 'check' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    確認（〜の）
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Inputs */}
                <div className="grid grid-cols-[1fr_2fr] gap-2">
                    <div className="col-span-2 flex gap-2">
                        <Select
                            value={locationId}
                            onChange={e => setLocationId(e.target.value)}
                            className="text-sm py-2 flex-1"
                        >
                            <option value="">場所 (なし)</option>
                            {locations.filter((l: any) => l.enabled).map((l: any) => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </Select>

                        {/* Partner Selection (Always Multi-select Dropdown) */}
                        <div className="relative flex-[2]">
                            <div
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm cursor-pointer flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <span className={`block truncate ${selectedPartnerIds.length > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {selectedPartnerIds.length > 0
                                        ? `${selectedPartnerIds.length}名選択中`
                                        : '相手を選択 (複数可)'}
                                </span>
                                <span className="text-slate-400 text-xs">▼</span>
                            </div>
                            {isDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-[110]" onClick={() => setIsDropdownOpen(false)} />
                                    <div className="absolute top-full left-0 right-0 mt-1 z-[111] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                        {partners.filter((p: any) => p.enabled).map((p: any) => {
                                            const isSelected = selectedPartnerIds.includes(p.id);
                                            return (
                                                <div
                                                    key={p.id}
                                                    onClick={() => togglePartner(p.id)}
                                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                                                        {isSelected && <CheckCircle2 size={10} className="text-white" />}
                                                    </div>
                                                    <span className={isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}>
                                                        {p.name}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {partners.length === 0 && (
                                            <div className="p-3 text-sm text-slate-400 text-center">相手マスタがありません</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <Input
                        placeholder={action === 'mtg' ? "例：今後の進め方" : "例：日程調整／見積もり"}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        className="text-sm py-2 col-span-2"
                    />
                </div>
                <p className="text-[10px] text-indigo-400 dark:text-indigo-300">
                    ※ 内容は名詞だけでOK（「について」は自動で入ります）
                </p>

                {/* Preview & Apply */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800/50">
                    <div className="text-[10px] text-slate-400 mb-1">プレビュー</div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 min-h-[1.25rem]">
                        {(selectedPartnerIds.length > 0) || content || (action === 'mtg') ? generatedText : <span className="text-slate-300">入力するとここにプレビューが表示されます</span>}
                    </div>
                </div>

                <Button
                    onClick={() => onApply(generatedText)}
                    disabled={!isValid}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-300 dark:disabled:bg-slate-700"
                    size="sm"
                >
                    詳細作業に入力
                </Button>
            </div>
        </div>
    );
};
