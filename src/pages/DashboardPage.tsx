import React, { useState, useEffect } from 'react';
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
import { generateWeeklyReport } from '../utils/reportGenerator';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export const DashboardPage: React.FC = () => {
    // const { settings } = useSettings();
    const { departments, workTypes, detailTasks } = useMaster();
    const { theme } = useTheme();

    // Period State
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
    const [targetDate, setTargetDate] = useState(new Date());

    // Data State
    const [logs, setLogs] = useState<WorkLog[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [reportText, setReportText] = useState('');

    // Load Data
    useEffect(() => {
        const load = async () => {
            let start = 0;
            let end = 0;

            let sDate = new Date();
            let eDate = new Date();

            if (period === 'month') {
                sDate = startOfMonth(targetDate);
                eDate = endOfMonth(targetDate);
            } else if (period === 'week') {
                // Monday start
                sDate = startOfWeek(targetDate, { weekStartsOn: 1 });
                eDate = endOfWeek(targetDate, { weekStartsOn: 1 });
            } else {
                // Day
                sDate = new Date(targetDate);
                sDate.setHours(0, 0, 0, 0);
                eDate = new Date(targetDate);
                eDate.setHours(23, 59, 59, 999);
            }

            start = sDate.getTime();
            end = eDate.getTime();

            // Fetch records
            const data = await db.workLogs
                .where('startAt')
                .between(start, end, true, true)
                .toArray();

            const filtered = data.filter(l => l.status === 'done');
            setLogs(filtered);

            // Generate Weekly Report
            if (period === 'week') {
                const text = generateWeeklyReport({
                    logs: filtered,
                    departments,
                    workTypes,
                    detailTasks,
                    startDate: sDate,
                    endDate: eDate
                });
                setReportText(text);
            } else {
                setReportText('');
            }
        };
        load();
    }, [period, targetDate, departments, workTypes, detailTasks]);

    // Calculate Stats
    useEffect(() => {
        if (!logs.length) {
            setStats(null);
            return;
        }

        // Hierarchy Aggregation for Nested Chart
        // Tree: Dept -> WorkType -> Detail
        type Node = { id: string; name: string; sec: number; children: Record<string, Node> };
        const tree: Record<string, Node> = {};

        // Define colors per dept (cycling)
        const deptColors = [
            [6, 182, 212],  // Cyan
            [168, 85, 247], // Purple
            [59, 130, 246], // Blue
            [16, 185, 129], // Emerald
            [244, 63, 94],  // Rose
            [245, 158, 11], // Amber
        ];

        let totalSec = 0;

        logs.forEach(l => {
            const sec = l.durationSec || 0;
            totalSec += sec;
            const deptId = l.departmentId;
            const wtId = l.workTypeId || 'unknown';

            // Dept Level
            if (!tree[deptId]) {
                const dName = departments.find(d => d.id === deptId)?.name || '未所属';
                tree[deptId] = { id: deptId, name: dName, sec: 0, children: {} };
            }
            tree[deptId].sec += sec;

            // WT Level
            if (!tree[deptId].children[wtId]) {
                const wName = workTypes.find(w => w.id === wtId)?.name || '未分類';
                tree[deptId].children[wtId] = { id: wtId, name: wName, sec: 0, children: {} };
            }
            tree[deptId].children[wtId].sec += sec;

            // Detail Level
            // Logic: A log can have specific details or none. 
            // If multiple details, we split time? Or just 'Mixed'?
            // User requirement: "inner... detail work graph". 
            // Logs store `detailTaskIds: string[]`. 
            // Simplified: If detail exists, we group by detail. If multiple, we just call it "Multiple" or split.
            // But splitting duration is tricky if not tracked separately. 
            // Assuming 1 log = 1 main detail focus or we group by the combined key.
            // Let's use the first detail or "Detailed" for simplicity, or "None".
            const details = l.detailTaskIds.map(did => detailTasks.find(d => d.id === did)?.name).filter(Boolean);
            const detailKey = details.length > 0 ? details.join(', ') : '詳細なし';

            if (!tree[deptId].children[wtId].children[detailKey]) {
                tree[deptId].children[wtId].children[detailKey] = { id: detailKey, name: detailKey, sec: 0, children: {} };
            }
            tree[deptId].children[wtId].children[detailKey].sec += sec;
        });

        // Flatten for ChartJS
        // We need 3 datasets matching index-wise? No, ChartJS handles pie slices independently unless we stack them.
        // But to make them concentric and aligned, we should sort them consistently.
        // Actually, distinct datasets don't auto-align in ChartJS doughnut unless they share labels? 
        // No, they are independent rings.
        // To align visually (parent arc covers child arcs), we must ensure the order and value sums match.
        // Data format:
        // Dataset 0 (Outer?): Depts. values: [100, 50]. 
        // Dataset 1 (Middle): WTs. values: [60, 40, 50]. (Must follow Dept order)
        // Dataset 2 (Inner): Details. values: [30, 30, 20, 20, 50]. (Must follow WT order)

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

        sortedDepts.forEach((d, i) => {
            dData.push(Math.round(d.sec / 60)); // Minutes
            dLabels.push(d.name);
            const color = deptColors[i % deptColors.length];
            dBg.push(`rgba(${color.join(',')}, 0.8)`);

            const sortedWTs = Object.values(d.children).sort((a, b) => b.sec - a.sec);
            sortedWTs.forEach(w => {
                wData.push(Math.round(w.sec / 60)); // Minutes
                wBg.push(`rgba(${color.join(',')}, 0.6)`); // Lighter/Translucent
                wLabels.push(w.name);

                const sortedDTs = Object.values(w.children).sort((a, b) => b.sec - a.sec);
                sortedDTs.forEach(dt => {
                    dtData.push(Math.round(dt.sec / 60)); // Minutes
                    dtBg.push(`rgba(${color.join(',')}, 0.4)`);
                    dtLabels.push(dt.name);
                });
            });
        });

        setStats({
            totalSec,
            chartData: {
                labels: dLabels, // Top level labels (default)
                datasets: [
                    {
                        label: '部門',
                        data: dData,
                        backgroundColor: dBg,
                        borderWidth: 1,
                        borderColor: theme === 'dark' ? '#0f172a' : '#fff',
                        customLabels: dLabels
                    } as any,
                    {
                        label: '作業種別',
                        data: wData,
                        backgroundColor: wBg,
                        borderWidth: 1,
                        borderColor: theme === 'dark' ? '#0f172a' : '#fff',
                        customLabels: wLabels
                    } as any,
                    {
                        label: '詳細',
                        data: dtData,
                        backgroundColor: dtBg,
                        borderWidth: 1,
                        borderColor: theme === 'dark' ? '#0f172a' : '#fff',
                        customLabels: dtLabels
                    } as any
                ]
            }
        });

    }, [logs, departments, workTypes, detailTasks, theme]);

    // Chart Data
    const deptData = stats?.chartData || null;

    const totalHours = stats ? (stats.totalSec / 3600).toFixed(1) : "0.0";

    const copyReport = () => {
        navigator.clipboard.writeText(reportText);
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
                    {deptData ? (
                        <div className="w-64 h-64">
                            <Doughnut
                                data={deptData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            display: true,
                                            position: 'bottom',
                                            labels: {
                                                color: theme === 'dark' ? '#94a3b8' : '#475569',
                                                font: { size: 11, family: 'Inter' }
                                            }
                                        },
                                        tooltip: {
                                            callbacks: {
                                                label: function (context: any) {
                                                    const value = context.parsed || 0;
                                                    const datasetLabel = context.dataset.label || '';
                                                    // Access custom labels from dataset
                                                    const customLabels = context.dataset.customLabels;
                                                    const label = customLabels ? customLabels[context.dataIndex] : (context.chart.data.labels[context.dataIndex] || '');
                                                    return `[${datasetLabel}] ${label}: ${value} min`;
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <div className="text-slate-400 dark:text-slate-600 text-sm">データがありません</div>
                    )}
                </Card>
            </div>

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
                        <Button onClick={copyReport} className="bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20">
                            <Copy size={16} className="mr-2" />
                            コピー
                        </Button>
                    </div>
                    <textarea
                        className="w-full h-full min-h-[300px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-y"
                        style={{ resize: 'vertical' }}
                        value={reportText}
                        onChange={e => setReportText(e.target.value)}
                    />
                </Card>
            )}

            <p className="text-xs text-center text-slate-400 mt-8">
                ※ グラフは選択期間の完了済みログを集計しています
            </p>
        </div>
    );
};
