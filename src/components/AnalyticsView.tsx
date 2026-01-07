import React from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { Period } from '../lib/types';
import { ArrowLeft, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

interface AnalyticsViewProps {
    onBack: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onBack }) => {
    const { period, setPeriod, stats } = useAnalytics();

    const formatDuration = (ms: number) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        return `${hours}h ${minutes}m`;
    };

    const chartData = {
        labels: stats.itemStats.map(stat => stat.name),
        datasets: [
            {
                label: 'Hours',
                data: stats.itemStats.map(stat => Number((stat.duration / (1000 * 60 * 60)).toFixed(2))),
                backgroundColor: [
                    'rgba(0, 229, 255, 0.7)',
                    'rgba(0, 255, 157, 0.7)',
                    'rgba(255, 215, 0, 0.7)',
                    'rgba(255, 77, 77, 0.7)',
                    'rgba(160, 160, 160, 0.7)',
                ],
                borderColor: [
                    'rgba(0, 229, 255, 1)',
                    'rgba(0, 255, 157, 1)',
                    'rgba(255, 215, 0, 1)',
                    'rgba(255, 77, 77, 1)',
                    'rgba(160, 160, 160, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: { color: '#fff' }
            },
            title: {
                display: false,
            },
        },
        scales: {
            y: {
                ticks: { color: '#aaa' },
                grid: { color: '#333' }
            },
            x: {
                ticks: { color: '#aaa' },
                grid: { display: false }
            }
        }
    };

    return (
        <div className="container animate-fade-in">
            <button
                onClick={onBack}
                className="mb-6 flex items-center gap-2 text-[var(--accent-color)] hover:underline"
            >
                <ArrowLeft size={16} /> Back to Tracker
            </button>

            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="title mb-1">Analytics</h1>
                    <p className="text-muted text-sm">Review your activity</p>
                </div>

                <div className="flex bg-[var(--bg-secondary)] p-1 rounded-lg">
                    {(['day', 'month', 'year', 'all'] as Period[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={clsx(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all capitalize",
                                period === p
                                    ? "bg-[var(--accent-color)] text-black shadow-sm"
                                    : "text-gray-400 hover:text-white"
                            )}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="card bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
                    <p className="text-muted text-sm mb-1">Total Time</p>
                    <h3 className="text-3xl font-bold text-white">
                        {formatDuration(stats.totalDuration)}
                    </h3>
                </div>
                <div className="card">
                    <p className="text-muted text-sm mb-1">Top Activity</p>
                    <h3 className="text-xl font-bold truncate text-[var(--accent-color)]">
                        {stats.itemStats[0]?.name || '-'}
                    </h3>
                </div>
            </div>

            {/* Charts */}
            {stats.totalDuration > 0 ? (
                <div className="grid gap-8">
                    <div className="card">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <Calendar size={18} className="text-[var(--accent-color)]" />
                            Activity Breakdown
                        </h3>
                        <div className="h-[300px] flex items-center justify-center">
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="font-bold mb-4">Distribution</h3>
                        <div className="h-[250px] flex items-center justify-center">
                            <Doughnut
                                data={chartData}
                                options={{
                                    ...chartOptions,
                                    cutout: '70%',
                                    scales: { x: { display: false }, y: { display: false } }
                                }}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] border border-dashed border-gray-700">
                    <p className="text-muted">No activity recorded for this period.</p>
                </div>
            )}
        </div>
    );
};
