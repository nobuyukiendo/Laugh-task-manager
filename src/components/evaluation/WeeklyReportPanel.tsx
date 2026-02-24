import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkLog } from '../../db';
import { useMaster } from '../../contexts/MasterContext';
import { ChevronDown, ChevronRight, Edit, Copy, Save, RotateCcw, Plus, Calculator, BarChart3, ListChecks, Gauge, X, Calendar, ClipboardList, TrendingUp } from 'lucide-react';
import { startOfWeek, endOfWeek, format, subWeeks, isWithinInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getSummaryBlocks, SummaryBlocks, getDefaultEditorialTemplate } from '../../utils/reportGenerator';

interface WeeklyData {
    weekStart: Date;
    weekEnd: Date;
    logs: WorkLog[];
    summaryBlocks: SummaryBlocks;
    editorialText: string;
}

interface ComparisonItem {
    type: 'task' | 'metric';
    title: string;
    content: string;
}

export const WeeklyReportPanel: React.FC = () => {
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
    const [editingWeek, setEditingWeek] = useState<string | null>(null);
    const [editorialDraft, setEditorialDraft] = useState<string>('');

    // 既存のマスタデータを使用
    const { departments, workTypes, detailTasks } = useMaster();

    // 有効な部門のみ取得
    const enabledDepartments = useMemo(() =>
        departments.filter(d => d.enabled).sort((a, b) => a.order - b.order),
        [departments]
    );

    // 全WorkLogを取得
    const allWorkLogs = useLiveQuery(() =>
        db.workLogs.where('status').equals('done').toArray(),
        []
    );

    // 直近3カ月（12週）の週報データを生成
    const weeklyData = useMemo<WeeklyData[]>(() => {
        if (!allWorkLogs || !selectedDepartmentId) return [];

        const weeks: WeeklyData[] = [];
        const now = new Date();

        for (let i = 0; i < 12; i++) {
            const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 }); // 月曜始まり
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

            const logsInWeek = allWorkLogs.filter((log) => {
                if (log.departmentId !== selectedDepartmentId) return false;
                const logDate = new Date(log.startAt);
                return isWithinInterval(logDate, { start: weekStart, end: weekEnd });
            });

            // 統計ブロックを生成
            const summaryBlocks = getSummaryBlocks({
                logs: logsInWeek,
                departments,
                workTypes,
                detailTasks
            });

            // Editorial Notes
            const weekKey = format(weekStart, 'yyyy-MM-dd');
            const fullKey = `weeklyReportEditorial_${weekKey}_${selectedDepartmentId}`;
            let savedEditorial = localStorage.getItem(fullKey) || '';

            // 初めて開く場合にテンプレートを適用
            if (!savedEditorial && logsInWeek.length > 0) {
                const templateKey = `reportTemplate_${selectedDepartmentId}`;
                const customTemplate = localStorage.getItem(templateKey);
                savedEditorial = customTemplate || getDefaultEditorialTemplate(weekStart, weekEnd);
                localStorage.setItem(fullKey, savedEditorial);
            }

            weeks.push({
                weekStart,
                weekEnd,
                logs: logsInWeek,
                summaryBlocks,
                editorialText: savedEditorial,
            });
        }

        return weeks;
    }, [allWorkLogs, selectedDepartmentId, departments, workTypes, detailTasks]);

    const toggleWeek = (weekKey: string) => {
        setExpandedWeeks((prev) => {
            const next = new Set(prev);
            if (next.has(weekKey)) {
                next.delete(weekKey);
            } else {
                next.add(weekKey);
            }
            return next;
        });
    };

    const startEditing = (weekKey: string, currentText: string) => {
        setEditingWeek(weekKey);
        setEditorialDraft(currentText);
    };

    const saveEditorial = (weekKey: string) => {
        if (!selectedDepartmentId) return;

        const fullKey = `weeklyReportEditorial_${weekKey}_${selectedDepartmentId}`;
        localStorage.setItem(fullKey, editorialDraft);
        setEditingWeek(null);

        // 再レンダリングを強制（localStorageの変更を反映）
        window.location.reload();
    };

    const cancelEditing = () => {
        setEditingWeek(null);
        setEditorialDraft('');
    };

    const appendToEditorial = (text: string) => {
        if (!text) return;
        insertBelowSeparator(text);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('クリップボードにコピーしました！');
    };

    const saveTemplate = () => {
        if (!selectedDepartmentId) return;
        if (confirm('現在の内容をこの部門のテンプレートとして保存しますか？（区切り線などは変更しないでください）')) {
            localStorage.setItem(`reportTemplate_${selectedDepartmentId}`, editorialDraft);
            alert('テンプレートを保存しました。');
        }
    };

    const resetTemplate = (weekStart: Date, weekEnd: Date) => {
        if (confirm('テンプレートを初期状態に戻しますか？')) {
            const defaultTmpl = getDefaultEditorialTemplate(weekStart, weekEnd);
            setEditorialDraft(defaultTmpl);
            localStorage.removeItem(`reportTemplate_${selectedDepartmentId}`);
        }
    };

    const SummaryBlock: React.FC<{ title: string; content: string; icon: React.ReactNode; onAdd: () => void }> = ({ title, content, icon, onAdd }) => (
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 group flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    {icon}
                    <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
                </div>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg border border-cyan-100 dark:border-cyan-800/50 transition-all active:scale-95"
                >
                    <Plus size={12} />
                    週報に追加
                </button>
            </div>
            <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {content}
            </pre>
        </div>
    );

    // --- Insertion Logic ---
    const insertBelowSeparator = (textToAdd: string) => {
        const separator = '--------------------------------------------------';
        const parts = editorialDraft.split(separator);
        if (parts.length >= 2) {
            // Insert after the first separator
            const before = parts[0] + separator;
            const after = parts.slice(1).join(separator);
            setEditorialDraft(before + '\n' + textToAdd + '\n' + after.trim());
        } else {
            // No separator found, just prepend
            setEditorialDraft(textToAdd + '\n\n' + editorialDraft);
        }
    };

    const insertDailyComments = (weekStart: Date) => {
        const savedComments = JSON.parse(localStorage.getItem('dailyComments') || '{}');
        const lines: string[] = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dateKey = format(d, 'yyyy-MM-dd');
            if (savedComments[dateKey]) {
                lines.push(savedComments[dateKey]);
            }
        }

        if (lines.length === 0) {
            alert('対象週の日次コメントが見つかりませんでした。');
            return;
        }

        insertBelowSeparator(`【日次コメント】\n${lines.join('\n')}`);
    };

    // --- Comparison Modal Integration ---
    const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);

    const openComparison = async (thisWeekLogs: WorkLog[], thisWeekStart: Date, allLogs: WorkLog[]) => {
        const lastWeekStart = subWeeks(thisWeekStart, 1);
        const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });

        const lastWeekLogs = allLogs.filter(l => {
            if (l.departmentId !== selectedDepartmentId) return false;
            const d = new Date(l.startAt);
            return isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd });
        });

        const items: ComparisonItem[] = [];

        // 1. Task Comparison (Intersection logic)
        const normalize = (s: string) => s.trim().replace(/　/g, ' ').replace(/\s+/g, ' ');
        const aggregate = (logs: WorkLog[]) => {
            const map: Record<string, { sec: number; count: number; display: string }> = {};
            logs.forEach(l => {
                const wtName = workTypes.find(w => w.id === (l.workTypeId || ''))?.name || '';
                const detailStr = (l.detailTaskNames || []).join(' ');
                const compoundKey = [normalize(wtName), normalize(detailStr)].join('|');
                const display = `${wtName}${detailStr}`.replace(/(未選択|未分類|unknown|\(詳細なし\))/g, '');

                if (!map[compoundKey]) map[compoundKey] = { sec: 0, count: 0, display };
                map[compoundKey].sec += (l.durationSec || 0);
                map[compoundKey].count += 1;
            });
            return map;
        };

        const prevMap = aggregate(lastWeekLogs);
        const currMap = aggregate(thisWeekLogs);

        Object.keys(currMap).forEach(key => {
            if (prevMap[key]) {
                const prev = prevMap[key];
                const curr = currMap[key];
                const prevMin = Math.round(prev.sec / 60);
                const currMin = Math.round(curr.sec / 60);
                if (prevMin > 0 && currMin > 0) {
                    const diff = currMin - prevMin;
                    const trend = diff > 0 ? `+${diff}min` : `${diff}min`;
                    items.push({
                        type: 'task',
                        title: curr.display,
                        content: `・${curr.display}：先週 ${prevMin}min → 今週 ${currMin}min (${trend})`
                    });
                }
            }
        });

        // 2. Metrics Comparison
        const aggregateMetrics = (logs: WorkLog[]) => {
            const map: Record<string, { values: number[], unit: string }> = {};
            logs.forEach(l => {
                l.metrics?.forEach(m => {
                    const key = `${m.name}|${m.unit}`;
                    if (!map[key]) map[key] = { values: [], unit: m.unit };
                    map[key].values.push(m.value);
                });
            });
            return map;
        };

        const prevMetrics = aggregateMetrics(lastWeekLogs);
        const currMetrics = aggregateMetrics(thisWeekLogs);

        Object.keys(currMetrics).forEach(key => {
            if (prevMetrics[key]) {
                const [name, unit] = key.split('|');
                const prevVals = prevMetrics[key].values;
                const currVals = currMetrics[key].values;
                const prevSum = prevVals.reduce((a, b) => a + b, 0);
                const currSum = currVals.reduce((a, b) => a + b, 0);
                const diff = currSum - prevSum;
                const trend = diff > 0 ? `+${diff}` : `${diff}`;

                items.push({
                    type: 'metric',
                    title: name,
                    content: `・${name}: 先週 ${prevSum}${unit} → 今週 ${currSum}${unit} (${trend}${unit})`
                });
            }
        });

        setComparisonItems(items);
        setIsComparisonOpen(true);
    };

    const ComparisonModal: React.FC = () => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-cyan-500" />
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">先週比較の選択挿入</h3>
                    </div>
                    <button onClick={() => setIsComparisonOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {comparisonItems.length === 0 ? (
                        <p className="text-center py-8 text-slate-400 text-sm">一致するタスクやメトリクスはありません</p>
                    ) : (
                        comparisonItems.map((item, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between group">
                                <div className="space-y-1 pr-4">
                                    <div className="flex items-center gap-1.5">
                                        {item.type === 'task' ? <ClipboardList size={12} className="text-slate-400" /> : <Gauge size={12} className="text-cyan-500" />}
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                            {item.type === 'task' ? 'TASK' : 'METRIC'}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                                        {item.content}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        insertBelowSeparator(item.content);
                                        setIsComparisonOpen(false);
                                    }}
                                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-cyan-500 rounded-lg text-[10px] font-black text-cyan-600 dark:text-cyan-400 shadow-sm transition-all"
                                >
                                    挿入
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* 部門ドロップダウン */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    部門
                </label>
                <select
                    value={selectedDepartmentId || ''}
                    onChange={(e) => setSelectedDepartmentId(e.target.value || null)}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                >
                    <option value="">部門を選択してください</option>
                    {enabledDepartments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                            {dept.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* 週報一覧 */}
            {selectedDepartmentId && (
                <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        直近3カ月（12週）の週報
                    </p>
                    {weeklyData.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                            この部門の週報データがありません
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {weeklyData.map((week) => {
                                const weekKey = format(week.weekStart, 'yyyy-MM-dd');
                                const isExpanded = expandedWeeks.has(weekKey);
                                const isEditing = editingWeek === weekKey;
                                const totalMinutes = Math.round(
                                    week.logs.reduce((sum, log) => sum + (log.durationSec / 60), 0)
                                );

                                return (
                                    <div
                                        key={weekKey}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
                                    >
                                        {/* ヘッダー */}
                                        <button
                                            onClick={() => toggleWeek(weekKey)}
                                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? (
                                                    <ChevronDown size={16} className="text-slate-400" />
                                                ) : (
                                                    <ChevronRight size={16} className="text-slate-400" />
                                                )}
                                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {format(week.weekStart, 'M/d', { locale: ja })} 〜{' '}
                                                    {format(week.weekEnd, 'M/d', { locale: ja })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    {week.logs.length}件
                                                </span>
                                                <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                                                    {totalMinutes}分
                                                </span>
                                            </div>
                                        </button>

                                        {/* 内容 */}
                                        {isExpanded && (
                                            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 space-y-4">
                                                {week.logs.length === 0 ? (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                                        この週の作業記録はありません
                                                    </p>
                                                ) : (
                                                    <>
                                                        {/* Live Summary (Blocks) */}
                                                        <div>
                                                            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-widest pl-1">
                                                                Live Summary (Read-only)
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                <SummaryBlock
                                                                    title="合計時間"
                                                                    icon={<Calculator size={14} />}
                                                                    content={week.summaryBlocks.total}
                                                                    onAdd={() => appendToEditorial(week.summaryBlocks.total)}
                                                                />
                                                                <SummaryBlock
                                                                    title="部門別"
                                                                    icon={<BarChart3 size={14} />}
                                                                    content={week.summaryBlocks.departments}
                                                                    onAdd={() => appendToEditorial(week.summaryBlocks.departments)}
                                                                />
                                                                <SummaryBlock
                                                                    title="作業種別"
                                                                    icon={<ListChecks size={14} />}
                                                                    content={week.summaryBlocks.workTypes}
                                                                    onAdd={() => appendToEditorial(week.summaryBlocks.workTypes)}
                                                                />
                                                                <SummaryBlock
                                                                    title="詳細作業"
                                                                    icon={<ListChecks size={14} />}
                                                                    content={week.summaryBlocks.details}
                                                                    onAdd={() => appendToEditorial(week.summaryBlocks.details)}
                                                                />
                                                                <div className="md:col-span-2">
                                                                    <SummaryBlock
                                                                        title="メトリクス"
                                                                        icon={<Gauge size={14} />}
                                                                        content={week.summaryBlocks.metrics}
                                                                        onAdd={() => appendToEditorial(week.summaryBlocks.metrics)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Editorial Notes */}
                                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
                                                                    Editorial Notes (Editable/Saved)
                                                                </h4>
                                                                <div className="flex gap-2">
                                                                    {!isEditing && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => copyToClipboard(week.editorialText)}
                                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-all"
                                                                                title="内容をコピー"
                                                                            >
                                                                                <Copy size={14} />
                                                                                コピー
                                                                            </button>
                                                                            <button
                                                                                onClick={() => startEditing(weekKey, week.editorialText)}
                                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-900/20 hover:bg-cyan-50 dark:hover:bg-cyan-900/40 rounded-lg border border-cyan-100 dark:border-cyan-800/50 transition-all font-['Zen_Maru_Gothic']"
                                                                            >
                                                                                <Edit size={14} />
                                                                                編集
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {isEditing ? (
                                                                <div className="space-y-3">
                                                                    <div className="relative group">
                                                                        <textarea
                                                                            value={editorialDraft}
                                                                            onChange={(e) => setEditorialDraft(e.target.value)}
                                                                            rows={15}
                                                                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 transition-all font-['Zen_Maru_Gothic'] custom-scrollbar"
                                                                            placeholder="ここで週報を編集してください..."
                                                                        />
                                                                        <div className="absolute top-4 right-4 flex gap-2">
                                                                            <button
                                                                                onClick={saveTemplate}
                                                                                className="p-2 text-slate-400 hover:text-cyan-500 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-border shadow-sm transition-all"
                                                                                title="テンプレートとして保存"
                                                                            >
                                                                                <Save size={14} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => resetTemplate(week.weekStart, week.weekEnd)}
                                                                                className="p-2 text-slate-400 hover:text-rose-500 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-border shadow-sm transition-all"
                                                                                title="初期状態に戻す"
                                                                            >
                                                                                <RotateCcw size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                                                                        <div className="flex gap-2">
                                                                            {/* These buttons are now moved here for convenience in edit mode */}
                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center px-2">Insert:</span>
                                                                            <button
                                                                                onClick={() => insertDailyComments(week.weekStart)}
                                                                                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:border-cyan-500 rounded-lg border border-border transition-all"
                                                                            >
                                                                                <Calendar size={12} />
                                                                                日次コメント
                                                                            </button>
                                                                            <button
                                                                                onClick={() => openComparison(week.logs, week.weekStart, allWorkLogs || [])}
                                                                                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:border-cyan-500 rounded-lg border border-border transition-all"
                                                                            >
                                                                                <TrendingUp size={12} />
                                                                                先週比較
                                                                            </button>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => saveEditorial(weekKey)}
                                                                                className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-xl transition-all shadow-md active:scale-95"
                                                                            >
                                                                                変更を保存
                                                                            </button>
                                                                            <button
                                                                                onClick={cancelEditing}
                                                                                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                                                            >
                                                                                キャンセル
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-['Zen_Maru_Gothic'] bg-slate-50/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/50 leading-relaxed shadow-inner">
                                                                    {week.editorialText || '（未入力：編集ボタンから入力を開始してください）'}
                                                                </pre>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {isComparisonOpen && <ComparisonModal />}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
