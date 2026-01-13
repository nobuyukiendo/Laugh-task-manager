import React, { useState } from 'react';
import { Button, Input, Select, Label } from '../components/ui';
import { useTimer } from '../contexts/TimerContext';
import { useMaster } from '../contexts/MasterContext';
import { Play, Book, History as HistoryIcon } from 'lucide-react';
import { ActiveTimer } from '../components/ActiveTimer';
import { useNavigate } from 'react-router-dom';

export const TimerPage: React.FC = () => {
    const { activeLog, startTimer, stopTimer } = useTimer();
    const { departments, workTypes, detailTasks, recentDetailTasks, partners, addDetailTask, addRecentDetailTask } = useMaster();
    const navigate = useNavigate();

    // Form State
    const [deptId, setDeptId] = useState(() => localStorage.getItem('lastTimerDeptId') || '');
    const [workTypeId, setWorkTypeId] = useState('');
    const [detailName, setDetailName] = useState('');
    const [saveToMaster, setSaveToMaster] = useState(false);
    const [note, setNote] = useState('');

    // Persist DeptId
    React.useEffect(() => {
        if (deptId) {
            localStorage.setItem('lastTimerDeptId', deptId);
        }
    }, [deptId]);

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
    };

    const handleStop = async () => {
        const logId = activeLog?.id;
        await stopTimer();
        navigate('/timeline', { state: { highlightedLogId: logId } });
    };

    if (activeLog) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent mb-6 flex items-center gap-2 font-['Zen_Maru_Gothic']">
                    <Play className="text-pink-500 fill-current" /> 計測中...
                </h1>
                <ActiveTimer
                    log={activeLog}
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
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <Label className="text-slate-600 dark:text-slate-400 font-bold block">作業詳細 (自由入力)</Label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-pink-600 dark:text-pink-400 hover:opacity-80 transition-opacity">
                            <input
                                type="checkbox"
                                checked={saveToMaster}
                                onChange={e => setSaveToMaster(e.target.checked)}
                                className="w-4 h-4 rounded border-pink-300 text-pink-500 focus:ring-pink-200"
                            />
                            マスタに保存
                        </label>
                    </div>
                    <div className="relative group">
                        <div className="flex gap-2">
                            <Input
                                placeholder="作業詳細を入力..."
                                value={detailName}
                                onChange={e => setDetailName(e.target.value)}
                                className="flex-1 bg-slate-50 dark:bg-slate-800 border-pink-100 dark:border-slate-700 rounded-xl py-3"
                            />

                            {/* Master Tasks Dropdown */}
                            <div className="relative">
                                <Select
                                    value=""
                                    onChange={e => {
                                        if (e.target.value) setDetailName(e.target.value);
                                    }}
                                    className="w-12 h-full opacity-0 absolute inset-0 cursor-pointer z-10"
                                    title="マスタから選択"
                                >
                                    <option value="" disabled className="font-bold text-slate-500">【マスタ】</option>
                                    {detailTasks.filter(d => d.enabled).map(d => (
                                        <option key={d.id} value={d.name}>{d.name}</option>
                                    ))}
                                </Select>
                                <Button variant="secondary" className="h-full px-3" title="マスタから選択">
                                    <Book size={18} />
                                </Button>
                            </div>

                            {/* Recent Tasks Dropdown */}
                            <div className="relative">
                                <Select
                                    value=""
                                    onChange={e => {
                                        if (e.target.value) setDetailName(e.target.value);
                                    }}
                                    className="w-12 h-full opacity-0 absolute inset-0 cursor-pointer z-10"
                                    title="履歴から選択"
                                >
                                    <option value="" disabled className="font-bold text-slate-500">【履歴】</option>
                                    {recentDetailTasks.map(r => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                    ))}
                                </Select>
                                <Button variant="secondary" className="h-full px-3" title="履歴から選択">
                                    <HistoryIcon size={18} />
                                </Button>
                            </div>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400">
                            ※ 直接入力するか、右側のボタンからマスタ・履歴を呼び出せます
                        </p>
                    </div>
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

                {/* Text Generator Panel */}
                <TextGeneratorPanel
                    workTypeId={workTypeId}
                    workTypes={workTypes}
                    partners={partners}
                    onApply={(text) => setDetailName(text)}
                />
            </div>
        </div>
    );
};

// --- Text Generator Panel ---
interface TextGeneratorPanelProps {
    workTypeId: string;
    workTypes: any[];
    partners: any[];
    onApply: (text: string) => void;
}

const TextGeneratorPanel: React.FC<TextGeneratorPanelProps> = ({ workTypeId, workTypes, partners, onApply }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [action, setAction] = useState<'send' | 'check'>('send');
    const [partnerId, setPartnerId] = useState('');
    const [content, setContent] = useState('');

    const targetWorkType = workTypes.find(w => w.id === workTypeId);
    const isTarget = targetWorkType && (targetWorkType.name.includes('社内メッセージ') || targetWorkType.name.includes('社内メッセージ確認'));

    React.useEffect(() => {
        if (isTarget) {
            setIsVisible(true);
            if (targetWorkType.name.includes('確認')) {
                setAction('check');
            } else {
                setAction('send');
            }
        } else {
            setIsVisible(false);
        }
    }, [workTypeId, isTarget, targetWorkType]);

    if (!isVisible) return null;

    const partnerName = partners.find(p => p.id === partnerId)?.name || '';
    const generatedText = action === 'send'
        ? `${partnerName}に${content}についてのメッセージ送信`
        : `${partnerName}の${content}についてのメッセージ確認`;

    const isValid = partnerId && content.trim().length > 0;

    return (
        <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl animate-in fade-in slide-in-from-top-2">
            <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
                <span className="bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded text-xs">便利機能</span>
                詳細作業 文面生成
            </h3>

            <div className="space-y-4">
                {/* Action Selector */}
                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
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
                </div>

                {/* Inputs */}
                <div className="grid grid-cols-[1fr_2fr] gap-2">
                    <Select
                        value={partnerId}
                        onChange={e => setPartnerId(e.target.value)}
                        className="text-sm py-2"
                    >
                        <option value="">相手を選択</option>
                        {partners.filter((p: any) => p.enabled).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </Select>
                    <Input
                        placeholder="例：日程調整／見積もり"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        className="text-sm py-2"
                    />
                </div>
                <p className="text-[10px] text-indigo-400 dark:text-indigo-300">
                    ※ 内容は名詞だけでOK（「について」は自動で入ります）
                </p>

                {/* Preview & Apply */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800/50">
                    <div className="text-[10px] text-slate-400 mb-1">プレビュー</div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 min-h-[1.25rem]">
                        {partnerId || content ? generatedText : <span className="text-slate-300">入力するとここにプレビューが表示されます</span>}
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
