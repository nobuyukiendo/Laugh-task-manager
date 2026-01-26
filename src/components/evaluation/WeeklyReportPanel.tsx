import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Department, type WorkLog } from '../../db';
import { useMaster } from '../../contexts/MasterContext';
import { ChevronDown, ChevronRight, Edit } from 'lucide-react';
import { startOfWeek, endOfWeek, format, subWeeks, isWithinInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getWeeklySummary } from '../../utils/reportGenerator';

interface WeeklyData {
    weekStart: Date;
    weekEnd: Date;
    logs: WorkLog[];
    summaryText: string;
    editorialText: string;
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

            // 既存の週次集計ロジックを使用
            const summaryText = logsInWeek.length > 0
                ? getWeeklySummary({
                    logs: logsInWeek,
                    departments,
                    workTypes,
                    detailTasks
                })
                : '';

            // Editorial Notes（既存のDashboardPageと同じロジック）
            const weekKey = format(weekStart, 'yyyy-MM-dd');
            const fullKey = `weeklyReportEditorial_${weekKey}_${selectedDepartmentId}`;
            const savedEditorial = localStorage.getItem(fullKey) || '';

            weeks.push({
                weekStart,
                weekEnd,
                logs: logsInWeek,
                summaryText,
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
                                                        {/* 週次サマリー */}
                                                        <div>
                                                            <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                                                週次サマリー
                                                            </h4>
                                                            <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-['Zen_Maru_Gothic']">
                                                                {week.summaryText}
                                                            </pre>
                                                        </div>

                                                        {/* Editorial Notes */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                                                    Editorial Notes (Editable/Saved)
                                                                </h4>
                                                                {!isEditing && (
                                                                    <button
                                                                        onClick={() => startEditing(weekKey, week.editorialText)}
                                                                        className="p-1 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded transition-colors"
                                                                        title="編集"
                                                                    >
                                                                        <Edit size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {isEditing ? (
                                                                <div className="space-y-2">
                                                                    <textarea
                                                                        value={editorialDraft}
                                                                        onChange={(e) => setEditorialDraft(e.target.value)}
                                                                        rows={8}
                                                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 font-['Zen_Maru_Gothic']"
                                                                        placeholder="Editorial Notesを入力..."
                                                                    />
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => saveEditorial(weekKey)}
                                                                            className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg transition-all shadow-sm"
                                                                        >
                                                                            保存
                                                                        </button>
                                                                        <button
                                                                            onClick={cancelEditing}
                                                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                                        >
                                                                            キャンセル
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-['Zen_Maru_Gothic'] bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                                                                    {week.editorialText || '（未入力）'}
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
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
