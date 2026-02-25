import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, Button, Label } from '../components/ui';
// import { useSettings } from '../contexts/SettingsContext';
import { useMaster } from '../contexts/MasterContext';
import { useTheme } from '../contexts/ThemeContext';
import { db, WorkLog } from '../db';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns';
import {
    PieChart, Copy, FileText, ChevronLeft, ChevronRight, BarChart2, Calendar, Save, RotateCcw, Plus,
    Calculator, BarChart3, ListChecks, Gauge
} from 'lucide-react';
import {
    getDefaultEditorialTemplate,
    getSummaryBlocks,
    SummaryBlocks
} from '../utils/reportGenerator';
import { MetricDetailModal } from '../components/MetricDetailModal';
import { EditLogModal } from '../components/EditLogModal';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// Department Color Mapping & Helper
const getDepartmentHue = (name: string): number => {
    const savedMappingStr = localStorage.getItem('deptColorMapping');
    const savedMapping = savedMappingStr ? JSON.parse(savedMappingStr) : {};

    // Normalize name for lookup (remove brackets and trim)
    const normalized = name.replace(/[【】]/g, '').trim();

    // Fixed defaults
    const defaults: Record<string, number> = {
        'ChatGPT': 190,
        '広告開拓': 270,
        'Touring': 210,
        'Maintenance': 30,
        'Washing': 180,
    };

    if (defaults[normalized]) return defaults[normalized];
    if (savedMapping[normalized] !== undefined) return savedMapping[normalized];

    // Generate hash-based hue
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);

    savedMapping[normalized] = hue;
    localStorage.setItem('deptColorMapping', JSON.stringify(savedMapping));
    return hue;
};



// Center Text Plugin
const centerTextPlugin = {
    id: 'centerText',
    beforeDraw: (chart: any) => {
        const pluginOpts = chart.config.options.plugins.centerText;
        if (pluginOpts && pluginOpts.display !== false) {
            const { ctx, chartArea: { top, bottom, left, right } } = chart;
            ctx.save();
            const centerX = (left + right) / 2;
            const centerY = (top + bottom) / 2;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw Main Text
            ctx.font = 'bold 36px Inter, sans-serif';
            ctx.fillStyle = pluginOpts.color || '#64748b';
            ctx.fillText(pluginOpts.text, centerX, centerY - 8);

            // Draw Subtext
            ctx.font = '500 12px Inter, sans-serif';
            ctx.fillStyle = pluginOpts.subtextColor || '#94a3b8';
            ctx.fillText(pluginOpts.subtext, centerX, centerY + 22);
            ctx.restore();
        }
    }
};

const formatDuration = (sec: number) => {
    const min = Math.round(sec / 60);
    if (min >= 60) return `${(sec / 3600).toFixed(1)}h`;
    return `${min}min`;
};

export const DashboardPage: React.FC = () => {
    const { departments, workTypes, detailTasks } = useMaster();
    const { activeThemeId } = useTheme();
    const location = useLocation();

    // Period State
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>(() => {
        const saved = localStorage.getItem('dashboardPeriod');
        return (saved === 'day' || saved === 'week' || saved === 'month') ? saved : 'week';
    });

    // Data State
    const [stats, setStats] = useState<any>(null);
    const [editorialText, setEditorialText] = useState('');
    const [dailyComment, setDailyComment] = useState('');

    // Filter States (Weekly Live Summary)
    const [filterDeptId, setFilterDeptId] = useState<string>('all');
    const [filterWorkTypeId, setFilterWorkTypeId] = useState<string>('all');

    // Zoom States (Donut Chart)
    const [zoomLevel, setZoomLevel] = useState<'all' | 'dept' | 'wt'>('all');
    const [zoomDeptId, setZoomDeptId] = useState<string | null>(null);
    const [zoomWtId, setZoomWtId] = useState<string | null>(null);
    const [zoomHistory, setZoomHistory] = useState<Array<{ level: 'all' | 'dept' | 'wt', deptId: string | null, wtId: string | null }>>([]);

    const [selectedMetric, setSelectedMetric] = useState<{ name: string, unit: string, entries: any[], totalDurationSec?: number } | null>(null);
    const [pendingMetric, setPendingMetric] = useState<{
        name: string,
        unit: string,
        sum: number,
        count: number,
        avg: number,
        median: number,
        totalDurationSec?: number
    } | null>(null);
    const [pendingMemos, setPendingMemos] = useState<Array<{ date: string, memo: string }> | null>(null);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);

    const MetricInsertionOptionsModal: React.FC<{
        metric: { name: string, unit: string, sum: number, count: number, avg: number, median: number, totalDurationSec?: number };
        onClose: () => void;
        onConfirm: (options: { sum: boolean, count: boolean, avg: boolean, median: boolean, totalTime: boolean, density: boolean, weight: boolean }) => void;
    }> = ({ metric, onClose, onConfirm }) => {
        const [options, setOptions] = useState({ sum: true, count: true, avg: true, median: true, totalTime: false, density: false, weight: false });

        const totalMinutes = metric.totalDurationSec ? metric.totalDurationSec / 60 : 0;
        const unitPerHour = totalMinutes > 0 ? (metric.sum / totalMinutes) * 60 : 0;
        const timePerUnit = metric.sum > 0 ? totalMinutes / metric.sum : 0;

        const formatWeight = (val: number) => {
            if (val === 0) return '0';
            if (val < 0.01) return val.toFixed(5);
            if (val < 1) return val.toFixed(3);
            return val.toFixed(1);
        };

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <Card className="w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-bold text-main-text flex items-center gap-2">
                            <Plus size={18} className="text-cyan-500" />
                            何を挿入しますか？
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{metric.name} ({metric.unit}) の統計情報</p>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'sum', label: '合計', value: `${metric.sum}${metric.unit}`, visible: true },
                                { id: 'count', label: '件数', value: `${metric.count}件`, visible: true },
                                { id: 'avg', label: '平均', value: `${metric.avg.toFixed(1)}${metric.unit}`, visible: true },
                                { id: 'median', label: '中央値', value: `${metric.median.toFixed(1)}${metric.unit}`, visible: true },
                                { id: 'totalTime', label: '作業時間合計', value: `${Math.round(totalMinutes)}分`, visible: !!metric.totalDurationSec },
                                { id: 'density', label: '単位1／時間', value: `${Math.round(unitPerHour).toLocaleString()}${metric.unit}／時`, visible: !!metric.totalDurationSec },
                                { id: 'weight', label: '時間／単位1', value: `${formatWeight(timePerUnit)}分／${metric.unit}`, visible: !!metric.totalDurationSec },
                            ].filter(opt => opt.visible).map(opt => (
                                <label key={opt.id} className="flex flex-col p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:border-cyan-500/50 transition-all">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-slate-500">{opt.label}</span>
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                                            checked={(options as any)[opt.id]}
                                            onChange={e => setOptions({ ...options, [opt.id]: e.target.checked })}
                                        />
                                    </div>
                                    <div className="text-xs font-bold text-main-text">{opt.value}</div>
                                </label>
                            ))}
                        </div>

                        {/* Preview Block */}
                        {(() => {
                            const lines: string[] = [];
                            if (options.sum) lines.push(`・合計: ${metric.sum}${metric.unit}`);
                            if (options.count) lines.push(`・件数: ${metric.count}件`);
                            if (options.avg) lines.push(`・平均: ${metric.avg.toFixed(1)}${metric.unit}`);
                            if (options.median) lines.push(`・中央値: ${metric.median.toFixed(1)}${metric.unit}`);

                            if (options.totalTime && metric.totalDurationSec) {
                                lines.push(`　作業時間合計：${Math.round(totalMinutes)}分`);
                            }
                            if (options.density && totalMinutes > 0) {
                                const density = Math.round((metric.sum / totalMinutes) * 60);
                                lines.push(`　単位1／時間：${density.toLocaleString()}${metric.unit}／時間`);
                            }
                            if (options.weight && metric.sum > 0) {
                                const weight = totalMinutes / metric.sum;
                                const weightStr = weight < 0.01 ? weight.toFixed(5) : weight < 1 ? weight.toFixed(3) : weight.toFixed(1);
                                lines.push(`　時間／単位1：${weightStr}分／${metric.unit}`);
                            }

                            if (lines.length === 0) return null;

                            return (
                                <div className="p-4 bg-slate-900/5 dark:bg-slate-50/5 rounded-xl border border-dashed border-border">
                                    <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">挿入テキストのプレビュー</div>
                                    <pre className="text-[10px] text-main-text font-mono leading-relaxed bg-white/50 dark:bg-slate-900/50 p-2 rounded">
                                        {`【メトリクス：${metric.name}】\n${lines.join('\n')}`}
                                    </pre>
                                </div>
                            );
                        })()}
                    </div>
                    <div className="p-6 border-t border-border flex gap-3">
                        <Button variant="ghost" className="flex-1" onClick={onClose}>キャンセル</Button>
                        <Button className="flex-1 shadow-cyan-500/20" onClick={() => onConfirm(options)}>挿入する</Button>
                    </div>
                </Card>
            </div>
        );
    };

    const DailyMemoSelectionModal: React.FC<{
        memos: Array<{ date: string, memo: string }>;
        onClose: () => void;
        onConfirm: (selectedDates: string[]) => void;
    }> = ({ memos, onClose, onConfirm }) => {
        const [selected, setSelected] = useState<string[]>(memos.map(m => m.date));

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <Card className="w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-bold text-main-text flex items-center gap-2">
                            <FileText size={18} className="text-purple-500" />
                            挿入するメモを選択
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">選択した日のメモを週報に挿入します</p>
                    </div>
                    <div className="p-4 max-h-[40vh] overflow-y-auto space-y-2">
                        {memos.map(m => (
                            <label key={m.date} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:border-purple-500/50 transition-all">
                                <input
                                    type="checkbox"
                                    className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500"
                                    checked={selected.includes(m.date)}
                                    onChange={e => {
                                        if (e.target.checked) setSelected([...selected, m.date]);
                                        else setSelected(selected.filter(s => s !== m.date));
                                    }}
                                />
                                <div className="space-y-0.5">
                                    <div className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-tight">{m.date}</div>
                                    <div className="text-xs text-main-text line-clamp-2 leading-relaxed">{m.memo}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                    <div className="p-6 border-t border-border flex gap-3">
                        <Button variant="ghost" className="flex-1" onClick={onClose}>キャンセル</Button>
                        <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20" onClick={() => onConfirm(selected)}>挿入する</Button>
                    </div>
                </Card>
            </div>
        );
    };

    const SummaryBlock: React.FC<{ title: string; content: string; icon: React.ReactNode; onAdd?: () => void }> = ({ title, content, icon, onAdd }) => (
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 group flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    {icon}
                    <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
                </div>
                {onAdd && (
                    <button
                        onClick={onAdd}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg border border-cyan-100 dark:border-cyan-800/50 transition-all active:scale-95"
                    >
                        <Plus size={12} />
                        週報に追加
                    </button>
                )}
            </div>
            <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                {content}
            </pre>
        </div>
    );

    // Save period to localStorage on change
    useEffect(() => {
        localStorage.setItem('dashboardPeriod', period);
    }, [period]);

    const [targetDate, setTargetDate] = useState(new Date());

    // Handle incoming state from navigation (e.g., from MemoPage)
    useEffect(() => {
        const state = location.state as { targetDate?: string, period?: 'day' | 'week' | 'month' } | null;
        if (state) {
            if (state.targetDate) {
                setTargetDate(new Date(state.targetDate));
            }
            if (state.period) {
                setPeriod(state.period);
            }
            // Clear state after reading to prevent re-applying on every render
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Load Data
    // Live Data Query
    const fetchedLogs = useLiveQuery(async () => {
        let start = 0;
        let end = 0;
        let sDate = new Date();
        let eDate = new Date();

        if (period === 'month') {
            sDate = startOfMonth(targetDate);
            eDate = endOfMonth(targetDate);
        } else if (period === 'week') {
            sDate = startOfWeek(targetDate, { weekStartsOn: 1 });
            eDate = endOfWeek(targetDate, { weekStartsOn: 1 });
        } else {
            sDate = new Date(targetDate);
            sDate.setHours(0, 0, 0, 0);
            eDate = new Date(targetDate);
            eDate.setHours(23, 59, 59, 999);
        }
        start = sDate.getTime();
        end = eDate.getTime();
        const data = await db.workLogs
            .where('startAt')
            .between(start, end, true, true)
            .toArray();

        return data.filter(l => l.status === 'done');
    }, [targetDate, period]);

    const logs = useMemo(() => fetchedLogs || [], [fetchedLogs]);
    const NO_WT_ID = 'no_work_type';

    // Live Summary Filtering
    const filteredWeeklyLogs = useMemo(() => {
        if (period !== 'week') return logs;
        return logs.filter(l => {
            const matchesDept = filterDeptId === 'all' || l.departmentId === filterDeptId;
            const logWtId = l.workTypeId || NO_WT_ID;
            const matchesWT = filterWorkTypeId === 'all' || logWtId === filterWorkTypeId;
            return matchesDept && matchesWT;
        });
    }, [logs, period, filterDeptId, filterWorkTypeId]);

    // Live Summary Calculation
    const summaryBlocks = useMemo<SummaryBlocks | null>(() => {
        if (!logs || logs.length === 0) return null;
        return getSummaryBlocks({
            logs: filteredWeeklyLogs,
            departments,
            workTypes,
            detailTasks
        }, period === 'day' ? '日' : period === 'month' ? '月' : '週');
    }, [filteredWeeklyLogs, departments, workTypes, detailTasks]);

    const insertBelowSeparator = (textToAdd: string) => {
        const separator = '--------------------------------------------------';
        const parts = editorialText.split(separator);
        if (parts.length >= 2) {
            const before = parts[0] + separator;
            const after = parts.slice(1).join(separator);
            saveEditorialText(before + '\n' + textToAdd + '\n' + after.trim());
        } else {
            saveEditorialText(textToAdd + '\n\n' + editorialText);
        }
    };

    const appendToEditorial = (text: string) => {
        if (!text) return;
        insertBelowSeparator(text);
    };

    const saveTemplate = () => {
        if (filterDeptId === 'all') {
            alert('テンプレートを保存するには部門を選択してください。');
            return;
        }
        if (confirm('現在の内容をこの部門のテンプレートとして保存しますか？')) {
            localStorage.setItem(`reportTemplate_${filterDeptId}`, editorialText);
            alert('テンプレートを保存しました。');
        }
    };

    const resetTemplate = () => {
        if (confirm('テンプレートを初期状態に戻しますか？')) {
            const sDate = startOfWeek(targetDate, { weekStartsOn: 1 });
            const eDate = endOfWeek(sDate, { weekStartsOn: 1 });
            const defaultTmpl = getDefaultEditorialTemplate(sDate, eDate);
            saveEditorialText(defaultTmpl);
            localStorage.removeItem(`reportTemplate_${filterDeptId}`);
        }
    };

    const getEditorialKey = () => {
        let dateKey = '';
        let prefix = '';
        if (period === 'month') {
            dateKey = format(targetDate, 'yyyy-MM');
            prefix = 'monthlyReportEditorial';
        } else if (period === 'week') {
            const sDate = startOfWeek(targetDate, { weekStartsOn: 1 });
            dateKey = format(sDate, 'yyyy-MM-dd');
            prefix = 'weeklyReportEditorial';
        } else {
            dateKey = format(targetDate, 'yyyy-MM-dd');
            prefix = 'dailyReportEditorial';
        }
        return `${prefix}_${dateKey}_${filterDeptId}`;
    };

    // Load Editorial
    useEffect(() => {
        const fullKey = getEditorialKey();
        const savedEditorial = localStorage.getItem(fullKey);

        if (savedEditorial) {
            setEditorialText(savedEditorial);
        } else {
            if (period === 'week') {
                const sDate = startOfWeek(targetDate, { weekStartsOn: 1 });
                const eDate = endOfWeek(sDate, { weekStartsOn: 1 });

                // Safe Template Selection
                const now = new Date();
                const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
                const isPastWeek = sDate.getTime() < thisWeekStart.getTime();

                // Apply custom template only to current/future weeks, and if a department is selected
                if (!isPastWeek && filterDeptId !== 'all') {
                    const customTemplate = localStorage.getItem(`reportTemplate_${filterDeptId}`);
                    if (customTemplate) {
                        setEditorialText(customTemplate);
                        return;
                    }
                }

                setEditorialText(getDefaultEditorialTemplate(sDate, eDate));
            } else {
                setEditorialText('');
            }
        }
    }, [period, targetDate, filterDeptId]);

    // Reset Zoom/Filters on period change
    useEffect(() => {
        setZoomLevel('all');
        setZoomDeptId(null);
        setZoomWtId(null);
        setZoomHistory([]);
        setFilterDeptId('all');
        setFilterWorkTypeId('all');
    }, [period, targetDate]);

    // Load Daily Comment
    useEffect(() => {
        const dateKey = format(targetDate, 'yyyy-MM-dd');
        const savedComments = JSON.parse(localStorage.getItem('dailyComments') || '{}');
        setDailyComment(savedComments[dateKey] || '');
    }, [targetDate]);

    const saveDailyComment = (value: string) => {
        setDailyComment(value);
        const dateKey = format(targetDate, 'yyyy-MM-dd');
        const savedComments = JSON.parse(localStorage.getItem('dailyComments') || '{}');
        savedComments[dateKey] = value;
        localStorage.setItem('dailyComments', JSON.stringify(savedComments));
    };

    const saveEditorialText = (value: string) => {
        setEditorialText(value);
        const fullKey = getEditorialKey();
        localStorage.setItem(fullKey, value);
    };

    const insertDailyComments = () => {
        const savedComments = JSON.parse(localStorage.getItem('dailyComments') || '{}');
        const memos: Array<{ date: string, memo: string }> = [];
        const start = startOfWeek(targetDate, { weekStartsOn: 1 });
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateKey = format(d, 'yyyy-MM-dd');
            if (savedComments[dateKey]) {
                memos.push({ date: dateKey, memo: savedComments[dateKey] });
            }
        }

        if (memos.length === 0) {
            alert('対象週の日次メモが見つかりませんでした。');
            return;
        }

        setPendingMemos(memos);
    };

    const normalizeTaskString = (s: string) => {
        return s.trim().replace(/　/g, ' ').replace(/\s+/g, ' ');
    };

    const insertLastWeekComparison = async () => {
        const thisWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(thisWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

        const lastWeekLogs = await db.workLogs
            .where('startAt')
            .between(lastWeekStart.getTime(), lastWeekEnd.getTime() + 86399999, true, true)
            .toArray();

        const filterDone = (l: WorkLog) => l.status === 'done';
        const prevLogsRaw = lastWeekLogs.filter(filterDone);
        const currLogsRaw = logs;

        const aggregateByCompoundKey = (targetLogs: WorkLog[]) => {
            const map: Record<string, { sec: number; count: number; display: string }> = {};
            targetLogs.forEach(l => {
                const deptName = departments.find(d => d.id === l.departmentId)?.name || '';
                const wtName = workTypes.find(w => w.id === (l.workTypeId || ''))?.name || '';

                // Prioritize detailTaskNames (non-volatile text)
                let names = l.detailTaskNames || [];
                if (names.length === 0 && l.detailTaskIds.length > 0) {
                    names = l.detailTaskIds.map(did => detailTasks.find(d => d.id === did)?.name).filter(Boolean) as string[];
                }
                const detailStr = names.join(' '); // Condensed

                const normDept = normalizeTaskString(deptName);
                const normWt = normalizeTaskString(wtName);
                const normDt = normalizeTaskString(detailStr);

                const compoundKey = [normDept, normWt, normDt].join('|');

                const cleanD = normDept.replace(/(未選択|未分類|unknown)/g, '');
                const cleanW = normWt.replace(/(未選択|未分類|unknown)/g, '');
                const cleanDt = normDt.replace(/(未選択|未分類|\(詳細なし\)|unknown)/g, '');
                const displayPrefix = `${cleanD}${cleanW}${cleanDt}`;

                if (!map[compoundKey]) {
                    map[compoundKey] = { sec: 0, count: 0, display: displayPrefix };
                }
                map[compoundKey].sec += (l.durationSec || 0);
                map[compoundKey].count += 1;
            });
            return map;
        };

        const prevMap = aggregateByCompoundKey(prevLogsRaw);
        const currMap = aggregateByCompoundKey(currLogsRaw);

        const allKeys = Array.from(new Set([...Object.keys(prevMap), ...Object.keys(currMap)]));
        const matchedLines: string[] = [];

        allKeys.forEach(key => {
            const prev = prevMap[key];
            const curr = currMap[key];
            const prevSec = prev ? prev.sec : 0;
            const currSec = curr ? curr.sec : 0;
            const prevCount = prev ? prev.count : 0;
            const currCount = curr ? curr.count : 0;

            const prevMin = Math.round(prevSec / 60);
            const currMin = Math.round(currSec / 60);

            // Strict Intersection: Only show if present in both weeks
            if (prevMin > 0 && currMin > 0) {
                // Total Comparison
                const diffMin = currMin - prevMin;
                const totalImprovement = ((prevMin - currMin) / prevMin) * 100;
                const totalSign = totalImprovement >= 0 ? '+' : '';
                const totalTrend = diffMin > 0 ? `+${diffMin}min` : diffMin < 0 ? `${diffMin}min` : '±0min';

                // Average Comparison
                const prevAvgMin = Math.round((prevSec / prevCount) / 60);
                const currAvgMin = Math.round((currSec / currCount) / 60);
                const diffAvgMin = currAvgMin - prevAvgMin;
                const avgImprovement = prevAvgMin > 0 ? ((prevAvgMin - currAvgMin) / prevAvgMin) * 100 : 0;
                const avgSign = avgImprovement >= 0 ? '+' : '';
                const avgTrend = diffAvgMin > 0 ? `+${diffAvgMin}min` : diffAvgMin < 0 ? `${diffAvgMin}min` : '±0min';

                // Count Comparison
                const diffCount = currCount - prevCount;
                const countTrend = diffCount > 0 ? `+${diffCount}回` : diffCount < 0 ? `${diffCount}回` : '±0回';

                matchedLines.push(
                    `・${curr.display}：\n` +
                    `　合計: 先週 ${prevMin}min → 今週 ${currMin}min (${totalTrend}) (改善率 ${totalSign}${totalImprovement.toFixed(1)}%)\n` +
                    `　平均: 先週 ${prevAvgMin}min → 今週 ${currAvgMin}min (${avgTrend}) (改善率 ${avgSign}${avgImprovement.toFixed(1)}%)\n` +
                    `　件数: 先週 ${prevCount}回 → 今週 ${currCount}回 (${countTrend})`
                );
            }
        });

        // Debug Logs
        console.log('--- 先週比較 デバッグ出力 (v4 Intersection) ---');
        console.log('一致件数:', matchedLines.length);

        if (matchedLines.length === 0) {
            alert('先週と今週で完全一致するタスクが見つかりませんでした。');
            return;
        }

        insertBelowSeparator(`【先週比較（完全一致タスク）】\n${matchedLines.join('\n')}`);
    };

    // Calculate Stats
    useEffect(() => {
        if (!logs.length) {
            setStats(null);
            return;
        }

        // Hierarchy Aggregation for Nested Chart
        type Node = { id: string; name: string; sec: number; children: Record<string, Node> };
        const tree: Record<string, Node> = {};

        // Filter logs based on zoom level
        const zoomFilteredLogs = logs.filter(l => {
            const logWtId = l.workTypeId || NO_WT_ID;
            if (zoomLevel === 'dept') return l.departmentId === zoomDeptId;
            if (zoomLevel === 'wt') return l.departmentId === zoomDeptId && logWtId === zoomWtId;
            return true;
        });

        let totalSec = 0;
        zoomFilteredLogs.forEach(l => {
            const sec = l.durationSec || 0;
            totalSec += sec;
            const deptId = l.departmentId;
            const wtId = l.workTypeId || NO_WT_ID;

            // Dept Level
            if (!tree[deptId]) {
                const dName = departments.find(d => d.id === deptId)?.name || '不明 (マスタ削除)';
                tree[deptId] = { id: deptId, name: dName, sec: 0, children: {} };
            }
            tree[deptId].sec += sec;

            // WT Level
            if (!tree[deptId].children[wtId]) {
                let wName = '作業種別なし';
                if (wtId !== NO_WT_ID) {
                    wName = workTypes.find(w => w.id === wtId)?.name || '不明 (マスタ削除)';
                }
                tree[deptId].children[wtId] = { id: wtId, name: wName, sec: 0, children: {} };
            }
            tree[deptId].children[wtId].sec += sec;

            // Detail Level
            let details = l.detailTaskNames || [];
            if (details.length === 0 && (l.detailTaskIds?.length || 0) > 0) {
                details = l.detailTaskIds.map(did => {
                    const master = detailTasks.find(d => d.id === did);
                    return master ? master.name : '不明 (マスタ削除)';
                }).filter(Boolean) as string[];
            }
            const detailKey = details.length > 0 ? details.join(', ') : '詳細なし';

            if (!tree[deptId].children[wtId].children[detailKey]) {
                tree[deptId].children[wtId].children[detailKey] = { id: detailKey, name: detailKey, sec: 0, children: {} };
            }
            tree[deptId].children[wtId].children[detailKey].sec += sec;
            tree[deptId].children[wtId].children[detailKey].sec += sec;
        });

        // Metric Aggregation
        const metricGroups: Record<string, { values: number[], unit: string, logs: any[] }> = {};
        zoomFilteredLogs.forEach(l => {
            if (l.metrics) {
                l.metrics.forEach(m => {
                    const key = `${m.name}|${m.unit}`;
                    if (!metricGroups[key]) metricGroups[key] = { values: [], unit: m.unit, logs: [] };
                    metricGroups[key].values.push(m.value);
                    metricGroups[key].logs.push({
                        logId: l.id,
                        value: m.value,
                        unit: m.unit,
                        timestamp: l.startAt,
                        deptName: departments.find(d => d.id === l.departmentId)?.name || '不明',
                        wtName: workTypes.find(w => w.id === (l.workTypeId || ''))?.name || '',
                        detailNames: l.detailTaskNames || [],
                        durationSec: l.durationSec || 0
                    });
                });
            }
        });

        const metricStats = Object.entries(metricGroups).map(([key, group]) => {
            const [name] = key.split('|');
            const vals = [...group.values].sort((a, b) => a - b);
            const sum = vals.reduce((a, b) => a + b, 0);
            const avg = sum / vals.length;
            const median = vals.length % 2 === 0
                ? (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2
                : vals[Math.floor(vals.length / 2)];
            const totalDurationSec = group.logs.reduce((a, b) => a + b.durationSec, 0);
            return { name, unit: group.unit, sum, avg, median, count: vals.length, entries: group.logs, totalDurationSec };
        });

        const datasets: any[] = [];
        const themeBorderColor = activeThemeId === 'dark' ? '#0f172a' : '#fff';

        if (zoomLevel === 'all') {
            const sortedDepts = Object.values(tree).sort((a, b) => b.sec - a.sec);
            const dData: number[] = [], dBg: string[] = [], dLabels: string[] = [], dMeta: any[] = [];
            const wData: number[] = [], wBg: string[] = [], wLabels: string[] = [], wMeta: any[] = [];
            const dtData: number[] = [], dtBg: string[] = [], dtLabels: string[] = [], dtMeta: any[] = [];

            const chartLabels: string[] = [];

            sortedDepts.forEach(d => {
                const hue = getDepartmentHue(d.name);
                dData.push(d.sec);
                dLabels.push(d.name);
                dBg.push(`hsl(${hue}, 70%, 80%)`);
                dMeta.push({ dept: d.name, deptId: d.id, type: 'dept' });
                chartLabels.push(d.name);

                const sortedWTs = Object.values(d.children).sort((a, b) => b.sec - a.sec);
                sortedWTs.forEach(w => {
                    wData.push(w.sec);
                    wBg.push(`hsl(${hue}, 70%, 60%)`);
                    wLabels.push(w.name);
                    wMeta.push({ dept: d.name, deptId: d.id, wt: w.name, wtId: w.id, type: 'wt' });

                    const sortedDTs = Object.values(w.children).sort((a, b) => b.sec - a.sec);
                    sortedDTs.forEach(dt => {
                        dtData.push(dt.sec);
                        dtBg.push(`hsl(${hue}, 70%, 40%)`);
                        dtLabels.push(dt.name);
                        dtMeta.push({ dept: d.name, wt: w.name, dt: dt.name, type: 'dt' });
                    });
                });
            });

            datasets.push(
                { label: '部門', data: dData, backgroundColor: dBg, borderColor: themeBorderColor, borderWidth: 1, customMetadata: dMeta, totalSec },
                { label: '作業種別', data: wData, backgroundColor: wBg, borderColor: themeBorderColor, borderWidth: 1, customMetadata: wMeta, totalSec },
                { label: '詳細', data: dtData, backgroundColor: dtBg, borderColor: themeBorderColor, borderWidth: 1, customMetadata: dtMeta, totalSec }
            );
        } else if (zoomLevel === 'dept') {
            const dNode = tree[zoomDeptId!];
            if (dNode) {
                const hue = getDepartmentHue(dNode.name);
                const wData: number[] = [], wBg: string[] = [], wLabels: string[] = [], wMeta: any[] = [];
                const dtData: number[] = [], dtBg: string[] = [], dtLabels: string[] = [], dtMeta: any[] = [];

                const sortedWTs = Object.values(dNode.children).sort((a, b) => b.sec - a.sec);
                sortedWTs.forEach(w => {
                    wData.push(w.sec);
                    wBg.push(`hsl(${hue}, 70%, 60%)`);
                    wLabels.push(w.name);
                    wMeta.push({ dept: dNode.name, deptId: dNode.id, wt: w.name, wtId: w.id, type: 'wt' });

                    const sortedDTs = Object.values(w.children).sort((a, b) => b.sec - a.sec);
                    sortedDTs.forEach(dt => {
                        dtData.push(dt.sec);
                        dtBg.push(`hsl(${hue}, 70%, 40%)`);
                        dtLabels.push(dt.name);
                        dtMeta.push({ dept: dNode.name, wt: w.name, dt: dt.name, type: 'dt' });
                    });
                });

                datasets.push(
                    { label: '作業種別', data: wData, backgroundColor: wBg, borderColor: themeBorderColor, borderWidth: 1, customMetadata: wMeta, totalSec },
                    { label: '詳細', data: dtData, backgroundColor: dtBg, borderColor: themeBorderColor, borderWidth: 1, customMetadata: dtMeta, totalSec }
                );
            }
        } else if (zoomLevel === 'wt') {
            const dNode = tree[zoomDeptId!];
            const wNode = dNode?.children[zoomWtId!];
            if (wNode) {
                const hue = getDepartmentHue(dNode.name);
                const dtData: number[] = [], dtBg: string[] = [], dtLabels: string[] = [], dtMeta: any[] = [];

                const sortedDTs = Object.values(wNode.children).sort((a, b) => b.sec - a.sec);
                sortedDTs.forEach(dt => {
                    dtData.push(dt.sec);
                    dtBg.push(`hsl(${hue}, 70%, 40%)`);
                    dtLabels.push(dt.name);
                    dtMeta.push({ dept: dNode.name, wt: wNode.name, dt: dt.name, type: 'dt' });
                });

                datasets.push(
                    { label: '詳細', data: dtData, backgroundColor: dtBg, borderColor: themeBorderColor, borderWidth: 1, customMetadata: dtMeta, totalSec }
                );
            }
        }

        setStats({
            totalSec,
            metricStats,
            chartData: {
                labels: zoomLevel === 'all' ? datasets[0].customMetadata.map((m: any) => m.dept) : [],
                datasets
            }
        });

    }, [logs, departments, workTypes, detailTasks, activeThemeId, zoomLevel, zoomDeptId, zoomWtId]);

    // Chart Data
    const deptData = stats?.chartData || null;

    const totalHours = (logs.reduce((acc, l) => acc + (l.durationSec || 0), 0) / 3600).toFixed(1);

    const copyReport = () => {
        if (!editorialText) {
            alert('コピーする内容がありません。');
            return;
        }
        navigator.clipboard.writeText(editorialText);
        alert('エディタの内容をクリップボードにコピーしました！');
    };

    const shiftDate = (amount: number) => {
        const d = new Date(targetDate);
        if (period === 'month') d.setMonth(d.getMonth() + amount);
        else if (period === 'week') d.setDate(d.getDate() + (amount * 7));
        else d.setDate(d.getDate() + amount);
        setTargetDate(d);
        // Reset zoom on date shift too
        setZoomLevel('all');
        setZoomDeptId(null);
        setZoomWtId(null);
        setZoomHistory([]);
    };

    const handleChartClick = (_event: any, elements: any[]) => {
        if (!elements.length) return;
        const element = elements[0];
        const datasetIndex = element.datasetIndex;
        const index = element.index;
        const meta = stats?.chartData?.datasets[datasetIndex]?.customMetadata?.[index];

        if (!meta) return;

        if (meta.type === 'dept') {
            const nextHistory = [...zoomHistory, { level: zoomLevel, deptId: zoomDeptId, wtId: zoomWtId }];
            setZoomHistory(nextHistory);
            setZoomLevel('dept');
            setZoomDeptId(meta.deptId);
        } else if (meta.type === 'wt') {
            const nextHistory = [...zoomHistory, { level: zoomLevel, deptId: zoomDeptId, wtId: zoomWtId }];
            setZoomHistory(nextHistory);
            setZoomLevel('wt');
            setZoomDeptId(meta.deptId);
            setZoomWtId(meta.wtId);
        }
    };

    const handleZoomBack = () => {
        if (zoomHistory.length === 0) return;
        const last = zoomHistory[zoomHistory.length - 1];
        setZoomLevel(last.level);
        setZoomDeptId(last.deptId);
        setZoomWtId(last.wtId);
        setZoomHistory(zoomHistory.slice(0, -1));
    };

    const handleZoomReset = () => {
        setZoomLevel('all');
        setZoomDeptId(null);
        setZoomWtId(null);
        setZoomHistory([]);
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h1
                    className="text-2xl font-bold text-main-text flex items-center gap-2 mb-8"
                    data-theme-role="text"
                >
                    <BarChart2 className="text-icon" data-theme-role="icon" />
                    集計・分析
                </h1>
            </div>

            {/* Controls */}
            <div
                className="flex flex-col md:flex-row gap-4 p-4 bg-surface rounded-xl border border-border items-end"
                data-theme-role="surface"
            >
                <div>
                    <Label>期間</Label>
                    <div
                        className="flex bg-surface rounded-lg p-1 border border-border"
                        data-theme-role="surface"
                    >
                        {(['day', 'week', 'month'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p
                                    ? 'bg-cyan-500 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {p === 'day' ? '日次' : p === 'week' ? '週次' : '月次'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 w-full">
                    <Label>{period === 'week' ? '対象週 (を含む日)' : '対象'}</Label>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => shiftDate(-1)}><ChevronLeft size={20} /></Button>
                        <input
                            type={period === 'month' ? 'month' : 'date'}
                            className="flex-1 bg-input-bg border border-border rounded-lg px-3 py-2 text-main-text outline-none focus:ring-2 focus:ring-primary"
                            data-theme-role="inputBg"
                            value={period === 'month' ? format(targetDate, 'yyyy-MM') : format(targetDate, 'yyyy-MM-dd')}
                            onChange={e => e.target.valueAsDate && setTargetDate(e.target.valueAsDate)}
                        />
                        <Button variant="ghost" size="sm" onClick={() => shiftDate(1)}><ChevronRight size={20} /></Button>
                    </div>
                </div>
            </div>

            {/* Visualization Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Total Duration */}
                <Card
                    className="flex flex-col items-center justify-center p-8 bg-surface shadow-lg border-border"
                    data-theme-role="surface"
                >
                    <div className="text-sub-text text-sm mb-2 font-medium" data-theme-role="subText">合計作業時間</div>
                    <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 font-mono tracking-tighter">
                        {totalHours}
                    </div>
                    <div className="text-sm text-sub-text mt-2" data-theme-role="subText">hours</div>
                </Card>

                {/* Department Chart */}
                <Card className="flex flex-col items-center justify-center min-h-[300px] shadow-lg relative p-6">
                    <div className="w-full flex justify-between items-start mb-4">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-1 pr-4">
                            <PieChart size={16} />
                            <span className="truncate">
                                {zoomLevel === 'all' ? '詳細内訳' :
                                    zoomLevel === 'dept' ? `${departments.find(d => d.id === zoomDeptId)?.name || '不明'} 内訳` :
                                        `${workTypes.find(w => w.id === zoomWtId)?.name || '不明'} 内訳`}
                            </span>
                        </h3>
                        {zoomLevel !== 'all' && (
                            <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="sm" onClick={handleZoomBack} className="text-[10px] h-7 px-2">
                                    戻る
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleZoomReset} className="text-[10px] h-7 px-2 text-pink-500">
                                    全体
                                </Button>
                            </div>
                        )}
                    </div>
                    {deptData && stats.totalSec > 0 ? (
                        <div className="w-64 h-64">
                            <Doughnut
                                data={deptData}
                                plugins={[centerTextPlugin]}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    cutout: '60%',
                                    onClick: handleChartClick,
                                    plugins: {
                                        legend: {
                                            display: zoomLevel === 'all',
                                            position: 'bottom',
                                            labels: {
                                                color: activeThemeId === 'dark' ? '#94a3b8' : '#475569',
                                                font: { size: 10, family: 'Inter' },
                                                boxWidth: 8,
                                                padding: 10
                                            }
                                        },
                                        centerText: {
                                            display: true,
                                            text: (stats.totalSec / 3600).toFixed(1),
                                            subtext: 'hours',
                                            color: activeThemeId === 'dark' ? '#e2e8f0' : '#1e293b',
                                            subtextColor: activeThemeId === 'dark' ? '#94a3b8' : '#64748b'
                                        },
                                        tooltip: {
                                            callbacks: {
                                                title: () => '',
                                                label: function (context: any) {
                                                    const value = context.raw || 0;
                                                    const total = context.dataset.totalSec || 1;
                                                    const percent = ((value / total) * 100).toFixed(1);
                                                    const meta = context.dataset.customMetadata?.[context.dataIndex];
                                                    if (!meta) return '';
                                                    const duration = formatDuration(value);
                                                    if (meta.type === 'dept') return [`部門：${meta.dept}`, `${duration} (${percent}%)`];
                                                    if (meta.type === 'wt') return [meta.dept, `作業種別：${meta.wt}`, `${duration} (${percent}%)`];
                                                    return [`${meta.dept} / ${meta.wt}`, `詳細：${meta.dt}`, `${duration} (${percent}%)`];
                                                }
                                            }
                                        }
                                    } as any
                                }}
                            />
                        </div>
                    ) : (
                        <div className="text-center p-4">
                            <div className="text-slate-400 dark:text-slate-500 text-sm mb-2">
                                {logs.length > 0 ? 'この項目の集計データが見つかりません' : 'データがありません'}
                            </div>
                            {logs.length > 0 && zoomLevel === 'all' && (
                                <div className="text-xs text-slate-500 italic">
                                    ※設定により1分単位で切り捨てられています
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>

            {/* Metrics Aggregation */}
            {stats?.metricStats && stats.metricStats.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.metricStats.map((ms: any, i: number) => (
                        <Card
                            key={i}
                            className="p-4 border-l-4 border-l-cyan-400 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] relative group/metric"
                            onClick={() => setSelectedMetric(ms)}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-sm font-bold text-main-text">{ms.name}</h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">{ms.count}件</span>
                                    {period === 'week' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPendingMetric({
                                                    name: ms.name,
                                                    unit: ms.unit,
                                                    sum: ms.sum,
                                                    count: ms.count,
                                                    avg: ms.avg,
                                                    median: ms.median,
                                                    totalDurationSec: ms.totalDurationSec
                                                });
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg border border-cyan-100 dark:border-cyan-800/50 transition-all active:scale-95"
                                            title="週報に追加"
                                        >
                                            <Plus size={12} />
                                            週報に追加
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-[10px] text-slate-500">合計</span>
                                    <span className="text-lg font-bold text-cyan-500">{ms.sum}<small className="ml-1 text-[10px] text-slate-400 font-normal">{ms.unit}</small></span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <div>
                                        <div className="text-[10px] text-slate-400">平均</div>
                                        <div className="text-xs font-semibold">{ms.avg.toFixed(1)}{ms.unit}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400">中央値</div>
                                        <div className="text-xs font-semibold">{ms.median.toFixed(1)}{ms.unit}</div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {period === 'day' && (
                <Card className="border-l-4 border-l-cyan-500 shadow-lg p-6">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                        <Calendar size={16} /> 今日の一言
                    </h3>
                    <textarea
                        className="w-full min-h-[120px] bg-input-bg border border-border rounded-lg p-4 text-sm text-main-text focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-y"
                        data-theme-role="inputBg"
                        placeholder="今日の一言メモを入力..."
                        value={dailyComment}
                        onChange={e => saveDailyComment(e.target.value)}
                    />
                </Card>
            )}

            {/* Summary Blocks (Unified for all periods) */}
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 pl-1">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                        Live Summary Blocks
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">部門:</span>
                            <select
                                className="bg-white dark:bg-slate-900 border border-border rounded-lg px-2 py-1 text-xs text-main-text outline-none focus:ring-1 focus:ring-primary/50"
                                value={filterDeptId}
                                onChange={e => setFilterDeptId(e.target.value)}
                            >
                                <option value="all">全て</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">作業種別:</span>
                            <select
                                className="bg-white dark:bg-slate-900 border border-border rounded-lg px-2 py-1 text-xs text-main-text outline-none focus:ring-1 focus:ring-primary/50"
                                value={filterWorkTypeId}
                                onChange={e => setFilterWorkTypeId(e.target.value)}
                            >
                                <option value="all">全て</option>
                                {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                <option value={NO_WT_ID}>作業種別なし</option>
                            </select>
                        </div>
                    </div>
                </div>
                {summaryBlocks ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SummaryBlock
                            title="合計時間"
                            icon={<Calculator size={14} />}
                            content={summaryBlocks.total}
                            onAdd={period === 'week' ? () => appendToEditorial(summaryBlocks.total) : undefined}
                        />
                        <SummaryBlock
                            title="部門別"
                            icon={<BarChart3 size={14} />}
                            content={summaryBlocks.departments}
                            onAdd={period === 'week' ? () => appendToEditorial(summaryBlocks.departments) : undefined}
                        />
                        <SummaryBlock
                            title="作業種別"
                            icon={<ListChecks size={14} />}
                            content={summaryBlocks.workTypes}
                            onAdd={period === 'week' ? () => appendToEditorial(summaryBlocks.workTypes) : undefined}
                        />
                        <SummaryBlock
                            title="詳細作業"
                            icon={<ListChecks size={14} />}
                            content={summaryBlocks.details}
                            onAdd={period === 'week' ? () => appendToEditorial(summaryBlocks.details) : undefined}
                        />
                        <div className="md:col-span-2">
                            <SummaryBlock
                                title="メトリクス"
                                icon={<Gauge size={14} />}
                                content={summaryBlocks.metrics}
                                onAdd={period === 'week' ? () => appendToEditorial(summaryBlocks.metrics) : undefined}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        集計対象のデータがありません
                    </div>
                )}
            </div>

            {period === 'week' && (
                <Card className="border-l-4 border-l-purple-500 shadow-xl p-6">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <FileText size={20} className="text-purple-500" />
                                    週報エディタ
                                </h3>
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-border">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={insertDailyComments}
                                        className="h-8 gap-1.5 px-3 text-[10px] font-bold hover:bg-white dark:hover:bg-slate-800"
                                    >
                                        <Plus size={14} /> 日次コメント挿入
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={insertLastWeekComparison}
                                        className="h-8 gap-1.5 px-3 text-[10px] font-bold hover:bg-white dark:hover:bg-slate-800"
                                    >
                                        <Plus size={14} /> 先週比較挿入
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={saveTemplate}
                                    className="h-9 w-9 p-0 border border-border shadow-sm"
                                    title="テンプレートとして保存"
                                >
                                    <Save size={16} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetTemplate}
                                    className="h-9 w-9 p-0 border border-border shadow-sm text-pink-500"
                                    title="初期状態に戻す"
                                >
                                    <RotateCcw size={16} />
                                </Button>
                                <div className="w-px h-6 bg-border mx-1" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={copyReport}
                                    className="h-9 gap-2 px-4 shadow-sm border border-border font-bold"
                                >
                                    <Copy size={16} /> コピー
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="flex flex-col gap-1.5 w-full md:w-1/2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">部門フィルタ</Label>
                                    <select
                                        className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-sm text-main-text outline-none focus:ring-2 focus:ring-primary/50"
                                        value={filterDeptId}
                                        onChange={e => setFilterDeptId(e.target.value)}
                                    >
                                        <option value="all">全て</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <textarea
                                value={editorialText}
                                onChange={(e) => saveEditorialText(e.target.value)}
                                className="w-full h-[500px] p-6 bg-surface border-2 border-border rounded-2xl text-sm leading-relaxed focus:ring-2 focus:ring-primary outline-none font-['Zen_Maru_Gothic'] shadow-inner"
                                placeholder="サマリーブロックから項目を追加するか、自由に記述してください..."
                            />
                        </div>
                    </div>
                </Card>
            )}
            <p className="text-xs text-center text-slate-400 mt-8">
                ※ グラフやサマリーは選択期間の完了済みログを集計しています
            </p>

            {selectedMetric && (
                <MetricDetailModal
                    metricName={selectedMetric.name}
                    unit={selectedMetric.unit}
                    entries={selectedMetric.entries}
                    totalDurationSec={selectedMetric.totalDurationSec}
                    onClose={() => setSelectedMetric(null)}
                    onInsertAggregate={() => {
                        const mStats = stats?.metricStats?.find((ms: any) => ms.name === selectedMetric.name);
                        if (mStats) {
                            setPendingMetric({
                                name: mStats.name,
                                unit: mStats.unit,
                                sum: mStats.sum,
                                count: mStats.count,
                                avg: mStats.avg,
                                median: mStats.median,
                                totalDurationSec: mStats.totalDurationSec
                            });
                        }
                    }}
                    onEditEntry={(id: string) => {
                        setEditingLogId(id);
                        setSelectedMetric(null);
                    }}
                />
            )}

            {pendingMetric && (
                <MetricInsertionOptionsModal
                    metric={pendingMetric!}
                    onClose={() => setPendingMetric(null)}
                    onConfirm={(options) => {
                        const lines: string[] = [];
                        if (options.sum) lines.push(`・合計: ${pendingMetric.sum}${pendingMetric.unit}`);
                        if (options.count) lines.push(`・件数: ${pendingMetric.count}件`);
                        if (options.avg) lines.push(`・平均: ${pendingMetric.avg.toFixed(1)}${pendingMetric.unit}`);
                        if (options.median) lines.push(`・中央値: ${pendingMetric.median.toFixed(1)}${pendingMetric.unit}`);

                        // Analysis metrics
                        const totalMinutes = pendingMetric.totalDurationSec ? pendingMetric.totalDurationSec / 60 : 0;
                        if (options.totalTime && pendingMetric.totalDurationSec) {
                            lines.push(`　作業時間合計：${Math.round(totalMinutes)}分`);
                        }
                        if (options.density && totalMinutes > 0) {
                            const density = Math.round((pendingMetric.sum / totalMinutes) * 60);
                            lines.push(`　単位1／時間：${density.toLocaleString()}${pendingMetric.unit}／時間`);
                        }
                        if (options.weight && pendingMetric.sum > 0) {
                            const weight = totalMinutes / pendingMetric.sum;
                            const weightStr = weight < 0.01 ? weight.toFixed(5) : weight < 1 ? weight.toFixed(3) : weight.toFixed(1);
                            lines.push(`　時間／単位1：${weightStr}分／${pendingMetric.unit}`);
                        }

                        if (lines.length > 0) {
                            appendToEditorial(`【メトリクス：${pendingMetric.name}】\n${lines.join('\n')}`);
                        }
                        setPendingMetric(null);
                    }}
                />
            )}

            {pendingMemos && (
                <DailyMemoSelectionModal
                    memos={pendingMemos!}
                    onClose={() => setPendingMemos(null)}
                    onConfirm={(selectedDates) => {
                        const savedComments = JSON.parse(localStorage.getItem('dailyComments') || '{}');
                        const lines: string[] = [];

                        // Sort selected dates
                        [...selectedDates].sort().forEach(dateStr => {
                            if (savedComments[dateStr]) {
                                const d = new Date(dateStr);
                                lines.push(`・${format(d, 'M/d')}: ${savedComments[dateStr]}`);
                            }
                        });

                        if (lines.length > 0) {
                            insertBelowSeparator(`【日次メモ】\n${lines.join('\n')}`);
                        }
                        setPendingMemos(null);
                    }}
                />
            )}

            {editingLogId && (
                <EditLogModal
                    log={fetchedLogs!.find(l => l.id === editingLogId)!}
                    onClose={() => setEditingLogId(null)}
                />
            )}
        </div>
    );
};
