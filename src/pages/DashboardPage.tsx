import React, { useState, useEffect, useMemo } from 'react';
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
import { PieChart, Copy, FileText, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import {
    getWeeklyHeader,
    getWeeklySummary,
    getDailyCommentsAnchor,
    getDefaultEditorialTemplate
} from '../utils/reportGenerator';

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
    // const { settings } = useSettings();
    const { departments, workTypes, detailTasks } = useMaster();
    const { theme } = useTheme();

    // Period State
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
    const [targetDate, setTargetDate] = useState(new Date());

    // Data State
    const [stats, setStats] = useState<any>(null);
    const [editorialText, setEditorialText] = useState('');
    const [dailyComment, setDailyComment] = useState('');

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

    // Live Summary Calculation
    const liveSummary = useMemo(() => {
        if (period !== 'week' || !logs) return '';
        return getWeeklySummary({
            logs,
            departments,
            workTypes,
            detailTasks
        });
    }, [period, logs, departments, workTypes, detailTasks]);

    // Editorial Persistence
    useEffect(() => {
        if (period === 'week') {
            const sDate = startOfWeek(targetDate, { weekStartsOn: 1 });
            const weekKey = `weeklyReportEditorial_${format(sDate, 'yyyy-MM-dd')}`;
            const savedEditorial = localStorage.getItem(weekKey);

            if (savedEditorial) {
                setEditorialText(savedEditorial);
            } else {
                setEditorialText(getDefaultEditorialTemplate());
            }
        } else {
            setEditorialText('');
        }
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
        if (period === 'week') {
            const sDate = startOfWeek(targetDate, { weekStartsOn: 1 });
            const weekKey = `weeklyReportEditorial_${format(sDate, 'yyyy-MM-dd')}`;
            localStorage.setItem(weekKey, value);
        }
    };

    const upsertSection = (header: string, content: string, anchor: string) => {
        let currentText = editorialText;
        const headerIndex = currentText.indexOf(header);
        const anchorIndex = currentText.indexOf(anchor);

        const sectionStr = `${header}\n${content}\n\n`;

        if (headerIndex !== -1) {
            // Replace existing section
            let nextIndex = currentText.indexOf('【', headerIndex + 1);
            if (nextIndex === -1 || (anchorIndex !== -1 && nextIndex > anchorIndex)) {
                nextIndex = anchorIndex !== -1 ? anchorIndex : currentText.length;
            }
            const before = currentText.substring(0, headerIndex);
            const after = currentText.substring(nextIndex);
            saveEditorialText(before + sectionStr + after);
        } else {
            // Insert at anchor
            if (anchorIndex !== -1) {
                const before = currentText.substring(0, anchorIndex);
                const after = currentText.substring(anchorIndex);
                saveEditorialText(before + sectionStr + after);
            } else {
                saveEditorialText(currentText + '\n' + sectionStr);
            }
        }
    };

    const insertDailyComments = () => {
        const sDate = startOfWeek(targetDate, { weekStartsOn: 1 });
        const savedComments = JSON.parse(localStorage.getItem('dailyComments') || '{}');
        const lines: string[] = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(sDate);
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

        const header = '【日次コメント】';
        const content = lines.join('\n');
        const anchor = '●試したこと・工夫したことの中で上手くいったことはありますか？';
        upsertSection(header, content, anchor);
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
            const map: Record<string, { h: number; display: string }> = {};
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
                    map[compoundKey] = { h: 0, display: displayPrefix };
                }
                map[compoundKey].h += (l.durationSec || 0);
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
            const prevH = prev ? prev.h / 3600 : 0;
            const currH = curr ? curr.h / 3600 : 0;

            // Strict Intersection: Only show if present in both weeks with > 0h
            if (prevH > 0 && currH > 0) {
                const diffH = currH - prevH;
                const improvementRate = ((prevH - currH) / prevH) * 100;
                const sign = improvementRate >= 0 ? '+' : '';

                const trend = diffH > 0 ? ` (+${diffH.toFixed(1)}h)` : diffH < 0 ? ` (${diffH.toFixed(1)}h)` : ' (±0h)';
                const rateStr = `（改善率 ${sign}${improvementRate.toFixed(1)}%）`;

                matchedLines.push(`・${curr.display}：先週 ${prevH.toFixed(1)}h → 今週 ${currH.toFixed(1)}h${trend}${rateStr}`);
            }
        });

        // Debug Logs
        console.log('--- 先週比較 デバッグ出力 (v4 Intersection) ---');
        console.log('一致件数:', matchedLines.length);

        if (matchedLines.length === 0) {
            alert('先週と今週で完全一致するタスクが見つかりませんでした。');
            return;
        }

        const header = '【先週比較（完全一致タスク）】';
        const content = matchedLines.join('\n');
        const anchor = '●試したこと・工夫したことの中で上手くいったことはありますか？';
        upsertSection(header, content, anchor);
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

        let totalSec = 0;

        logs.forEach(l => {
            const sec = l.durationSec || 0;
            totalSec += sec;
            const deptId = l.departmentId;
            const wtId = l.workTypeId || 'empty';

            // Dept Level
            if (!tree[deptId]) {
                const dName = departments.find(d => d.id === deptId)?.name || '不明 (マスタ削除)';
                tree[deptId] = { id: deptId, name: dName, sec: 0, children: {} };
            }
            tree[deptId].sec += sec;

            // WT Level
            if (!tree[deptId].children[wtId]) {
                const wName = workTypes.find(w => w.id === wtId)?.name || '作業種別なし';
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
        });

        const sortedDepts = Object.values(tree).sort((a, b) => b.sec - a.sec);

        const dData: number[] = [];
        const dBg: string[] = [];
        const dLabels: string[] = [];

        const wData: number[] = [];
        const wBg: string[] = [];
        const wLabels: string[] = [];

        const dtData: number[] = [];
        const dtBg: string[] = [];
        const dtLabels: string[] = [];

        const dMeta: any[] = [];
        const wMeta: any[] = [];
        const dtMeta: any[] = [];

        sortedDepts.forEach((d) => {
            const hue = getDepartmentHue(d.name);
            dData.push(d.sec);
            dLabels.push(d.name);
            dBg.push(`hsl(${hue}, 70%, 80%)`);
            dMeta.push({ dept: d.name, type: 'dept' });

            const sortedWTs = Object.values(d.children).sort((a, b) => b.sec - a.sec);
            sortedWTs.forEach(w => {
                wData.push(w.sec);
                wBg.push(`hsl(${hue}, 70%, 60%)`);
                wLabels.push(w.name);
                wMeta.push({ dept: d.name, wt: w.name, type: 'wt' });

                const sortedDTs = Object.values(w.children).sort((a, b) => b.sec - a.sec);
                sortedDTs.forEach(dt => {
                    dtData.push(dt.sec);
                    dtBg.push(`hsl(${hue}, 70%, 40%)`);
                    dtLabels.push(dt.name);
                    dtMeta.push({ dept: d.name, wt: w.name, dt: dt.name, type: 'dt' });
                });
            });
        });

        setStats({
            totalSec,
            chartData: {
                labels: dLabels,
                datasets: [
                    {
                        label: '部門',
                        data: dData,
                        backgroundColor: dBg,
                        borderWidth: 1,
                        borderColor: theme === 'dark' ? '#0f172a' : '#fff',
                        customMetadata: dMeta,
                        totalSec: totalSec
                    } as any,
                    {
                        label: '作業種別',
                        data: wData,
                        backgroundColor: wBg,
                        borderWidth: 1,
                        borderColor: theme === 'dark' ? '#0f172a' : '#fff',
                        customMetadata: wMeta,
                        totalSec: totalSec
                    } as any,
                    {
                        label: '詳細',
                        data: dtData,
                        backgroundColor: dtBg,
                        borderWidth: 1,
                        borderColor: theme === 'dark' ? '#0f172a' : '#fff',
                        customMetadata: dtMeta,
                        totalSec: totalSec
                    } as any
                ]
            }
        });

    }, [logs, departments, workTypes, detailTasks, theme]);

    // Chart Data
    const deptData = stats?.chartData || null;

    const totalHours = (logs.reduce((acc, l) => acc + (l.durationSec || 0), 0) / 3600).toFixed(1);

    const copyReport = () => {
        const sDate = startOfWeek(targetDate, { weekStartsOn: 1 });
        const eDate = endOfWeek(targetDate, { weekStartsOn: 1 });
        const header = getWeeklyHeader(sDate, eDate);
        const anchor = getDailyCommentsAnchor();

        const fullText = `${header}\n\n${anchor}\n${liveSummary}\n--------------------------------------------------\n${editorialText}`;
        navigator.clipboard.writeText(fullText);
        alert('週報をクリップボードにコピーしました！');
    };

    const shiftDate = (amount: number) => {
        const d = new Date(targetDate);
        if (period === 'month') d.setMonth(d.getMonth() + amount);
        else if (period === 'week') d.setDate(d.getDate() + (amount * 7));
        else d.setDate(d.getDate() + amount);
        setTargetDate(d);
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-8">
                    <BarChart2 className="text-pink-500" />
                    集計・分析
                </h1>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 p-4 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 items-end">
                <div>
                    <Label>期間</Label>
                    <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
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
                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500"
                            value={period === 'month' ? format(targetDate, 'yyyy-MM') : format(targetDate, 'yyyy-MM-dd')}
                            onChange={e => e.target.valueAsDate && setTargetDate(e.target.valueAsDate)}
                        />
                        <Button variant="ghost" size="sm" onClick={() => shiftDate(1)}><ChevronRight size={20} /></Button>
                    </div>
                </div>
            </div>

            {/* Scale-up Animation Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Total Duration */}
                <Card className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-lg">
                    <div className="text-slate-500 dark:text-slate-400 text-sm mb-2 font-medium">合計作業時間</div>
                    <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 font-mono tracking-tighter">
                        {totalHours}
                    </div>
                    <div className="text-sm text-slate-400 mt-2">hours</div>
                </Card>

                {/* Department Chart */}
                <Card className="flex flex-col items-center justify-center min-h-[300px] shadow-lg">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                        <PieChart size={16} /> 詳細内訳
                    </h3>
                    {deptData && stats.totalSec > 0 ? (
                        <div className="w-64 h-64">
                            <Doughnut
                                data={deptData}
                                plugins={[centerTextPlugin]}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    cutout: '60%',
                                    plugins: {
                                        legend: {
                                            display: true,
                                            position: 'bottom',
                                            labels: {
                                                color: theme === 'dark' ? '#94a3b8' : '#475569',
                                                font: { size: 11, family: 'Inter' }
                                            }
                                        },
                                        centerText: {
                                            display: true,
                                            text: totalHours,
                                            subtext: 'hours',
                                            color: theme === 'dark' ? '#e2e8f0' : '#1e293b',
                                            subtextColor: theme === 'dark' ? '#94a3b8' : '#64748b'
                                        },
                                        tooltip: {
                                            callbacks: {
                                                title: () => '', // Suppress inappropriate title
                                                label: function (context: any) {
                                                    const value = context.raw || 0;
                                                    const total = context.dataset.totalSec || 1;
                                                    const percent = ((value / total) * 100).toFixed(1);
                                                    const meta = context.dataset.customMetadata?.[context.dataIndex];

                                                    if (!meta) return '';

                                                    const duration = formatDuration(value);
                                                    if (meta.type === 'dept') {
                                                        return [
                                                            `部門：${meta.dept}`,
                                                            `${duration} (${percent}%)`
                                                        ];
                                                    } else if (meta.type === 'wt') {
                                                        return [
                                                            meta.dept,
                                                            `作業種別：${meta.wt}`,
                                                            `${duration} (${percent}%)`
                                                        ];
                                                    } else {
                                                        return [
                                                            `${meta.dept} / ${meta.wt}`,
                                                            `詳細：${meta.dt}`,
                                                            `${duration} (${percent}%)`
                                                        ];
                                                    }
                                                }
                                            }
                                        }
                                    } as any
                                }}
                            />
                        </div>
                    ) : logs.length > 0 ? (
                        <div className="text-center p-4">
                            <div className="text-slate-400 dark:text-slate-500 text-sm mb-2">1分未満の記録は集計されません</div>
                            <div className="text-xs text-slate-500 italic">※設定により1分単位で切り捨てられています</div>
                        </div>
                    ) : (
                        <div className="text-slate-400 dark:text-slate-600 text-sm">データがありません</div>
                    )}
                </Card>
            </div>

            {/* Daily Comment Section */}
            {period === 'day' && (
                <Card className="border-l-4 border-l-cyan-500 shadow-lg p-6">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                        コメント
                    </h3>
                    <textarea
                        className="w-full min-h-[120px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all resize-y"
                        placeholder="今日の一言メモを入力..."
                        value={dailyComment}
                        onChange={e => saveDailyComment(e.target.value)}
                    />
                </Card>
            )}

            {/* Weekly Report Section */}
            {period === 'week' && (
                <Card className="border-l-4 border-l-purple-500 shadow-xl overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <FileText size={20} className="text-purple-500" />
                                週報テンプレート
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                今週の集計結果がテンプレートに自動入力されました。<br />
                                コピーして週報に貼り付けてください。
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button onClick={copyReport} className="bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 w-full md:w-auto">
                                <Copy size={16} className="mr-2" />
                                コピー
                            </Button>
                            <Button onClick={insertDailyComments} variant="secondary" size="md" className="border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 w-full md:w-auto">
                                日次コメントを挿入
                            </Button>
                            <Button onClick={insertLastWeekComparison} variant="secondary" size="md" className="border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 w-full md:w-auto">
                                先週比較を挿入
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Live Summary (Read-only)</h4>
                            <pre className="text-[10px] md:text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                                {getWeeklyHeader(startOfWeek(targetDate, { weekStartsOn: 1 }), endOfWeek(targetDate, { weekStartsOn: 1 }))}
                                {"\n\n"}
                                {getDailyCommentsAnchor()}
                                {"\n"}
                                {liveSummary}
                            </pre>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Editorial Notes (Editable/Saved)</h4>
                            <textarea
                                className="w-full min-h-[400px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-y"
                                style={{ resize: 'vertical' }}
                                value={editorialText}
                                onChange={e => saveEditorialText(e.target.value)}
                                placeholder="ここに追加コメントや振り返りを入力..."
                            />
                        </div>
                    </div>
                </Card>
            )}

            <p className="text-xs text-center text-slate-400 mt-8">
                ※ グラフは選択期間の完了済みログを集計しています
            </p>
        </div>
    );
};
