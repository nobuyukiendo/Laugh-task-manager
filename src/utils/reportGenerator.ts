import { WorkLog, Department, WorkType, DetailTask, DailyMetric } from '../db';
import { format } from 'date-fns';

interface ReportData {
    logs: WorkLog[];
    departments: Department[];
    workTypes: WorkType[];
    detailTasks: DetailTask[];
    dailyMetrics?: DailyMetric[];
    startDate: Date;
    endDate: Date;
}

export const getWeeklyHeader = (startDate: Date, endDate: Date): string => {
    const startStr = format(startDate, 'M月d日');
    const endStr = format(endDate, 'M月d日');
    return `【週次レビュー】\n${startStr}～${endStr}`;
};

export const getDailyCommentsAnchor = (): string => {
    return '●先週試したこと・工夫したことの結果と数値を書いてみましょう\n--------------------------------------------------';
};

export const getWeeklySummary = ({ logs, departments, workTypes, detailTasks }: Omit<ReportData, 'startDate' | 'endDate'>): string => {
    const blocks = getSummaryBlocks({ logs, departments, workTypes, detailTasks });
    return [
        blocks.total,
        blocks.departments,
        blocks.workTypes,
        blocks.details,
        blocks.metrics
    ].filter(Boolean).join('\n\n');
};

export interface SummaryBlocks {
    total: string;
    departments: string;
    workTypes: string;
    details: string;
    metrics: string;
}

export const getSummaryBlocks = ({ logs, departments, workTypes, detailTasks, dailyMetrics }: Omit<ReportData, 'startDate' | 'endDate'>, periodLabel: string = '週'): SummaryBlocks => {
    // Helpers to resolve names
    const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || '不明な部門';
    const getWTName = (id: string) => workTypes.find(w => w.id === id)?.name || '未分類';

    // 1. Total Duration
    const totalSec = logs.reduce((acc, l) => acc + (l.durationSec || 0), 0);
    const totalMinutes = Math.round(totalSec / 60);

    // 2. Aggregations
    const deptMap: Record<string, number> = {};
    const wtMap: Record<string, number> = {};
    const dtMap: Record<string, number> = {};

    logs.forEach(l => {
        const sec = l.durationSec || 0;

        // Dept
        const dName = getDeptName(l.departmentId);
        deptMap[dName] = (deptMap[dName] || 0) + sec;

        // Work Type
        const wName = l.workTypeId ? getWTName(l.workTypeId) : '未選択';
        wtMap[wName] = (wtMap[wName] || 0) + sec;

        // Detail Task
        let namesToAggregate: string[] = [];
        if (l.detailTaskNames && l.detailTaskNames.length > 0) {
            namesToAggregate = l.detailTaskNames;
        } else if (l.detailTaskIds.length > 0) {
            namesToAggregate = l.detailTaskIds.map(did => {
                const master = detailTasks.find(d => d.id === did);
                return master ? master.name : '不明';
            });
        }

        if (namesToAggregate.length > 0) {
            const splitSec = sec / namesToAggregate.length;
            namesToAggregate.forEach(name => {
                dtMap[name] = (dtMap[name] || 0) + splitSec;
            });
        } else {
            dtMap['(詳細なし)'] = (dtMap['(詳細なし)'] || 0) + sec;
        }
    });

    const formatMap = (map: Record<string, number>, limit = 5) => {
        return Object.entries(map)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([name, sec]) => `・${name}: ${Math.round(sec / 60)}min`)
            .join('\n');
    };

    // 3. Metrics Aggregation
    const metricGroups: Record<string, { values: number[], unit: string }> = {};
    logs.forEach(l => {
        if (l.metrics) {
            l.metrics.forEach(m => {
                const key = `${m.name}|${m.unit}`;
                if (!metricGroups[key]) metricGroups[key] = { values: [], unit: m.unit };
                metricGroups[key].values.push(m.value);
            });
        }
    });

    const metricLines = Object.entries(metricGroups).map(([key, group]) => {
        const [name] = key.split('|');
        return getMetricSummary(name, group.unit, group.values);
    });

    // 4. Daily Metrics Aggregation
    const dailyMetricGroups: Record<string, { total: number, count: number, unit: string }> = {};
    if (dailyMetrics) {
        dailyMetrics.forEach((dm: DailyMetric) => {
            dm.entries.forEach(e => {
                const key = `${e.name}|${e.unit}`;
                if (!dailyMetricGroups[key]) dailyMetricGroups[key] = { total: 0, count: 0, unit: e.unit };
                dailyMetricGroups[key].total += e.value;
                dailyMetricGroups[key].count += 1;
            });
        });
    }

    const dailyMetricLines = Object.entries(dailyMetricGroups).map(([key, group]) => {
        const [name] = key.split('|');
        return `・[日次] ${name}: 合計 ${parseFloat(group.total.toFixed(2))}${group.unit} (平均 ${(group.total / group.count).toFixed(1)}${group.unit} / ${group.count}日)`;
    });

    const allMetricLines = [...metricLines, ...dailyMetricLines];

    return {
        total: `【${periodLabel}合計】 ${totalMinutes} 分`,
        departments: `【部門別】\n${formatMap(deptMap)}`,
        workTypes: `【作業種別】\n${formatMap(wtMap)}`,
        details: `【詳細作業 (Top 8)】\n${formatMap(dtMap, 8)}`,
        metrics: `【メトリクス】\n${allMetricLines.length > 0 ? allMetricLines.join('\n') : '(なし)'}`
    };
};

export const getMetricSummary = (name: string, unit: string, values: number[]): string => {
    const vals = [...values].sort((a, b) => a - b);
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    const median = vals.length % 2 === 0
        ? (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2
        : vals[Math.floor(vals.length / 2)];

    return `・${name}: 合計 ${sum}${unit} (平均 ${avg.toFixed(1)}${unit} / 中央値 ${median.toFixed(1)}${unit})`;
};

export const getDefaultEditorialTemplate = (startDate?: Date, endDate?: Date): string => {
    const header = startDate && endDate ? getWeeklyHeader(startDate, endDate) : '【週次レビュー】\n〇月〇日～〇月〇日';
    const anchor = getDailyCommentsAnchor();

    return `${header}

${anchor}

●試したこと・工夫したことの中で上手くいったことはありますか？
・施策：
・結果：
・うまくいった仮説：

●上手くいったことをさらに改善・拡大するアイディア・方法はありますか？
(ここに入力)

●上手くいった施策で他社がさらに拡大している事例を見つけましょう→今週の施策へ記載しましょう
(ここに入力)

●試したこと・工夫したことの中で上手くいかなかったことはありますか？
(ここに入力)

●上手くいかなかった施策で他社が上手くやれている事例を見つけましょう→今週の施策へ記載しましょう
(ここに入力)

●上手くいかず改善行動をしたけれど改善しなかったことは停止しましょう
(ここに入力)

●今週停止の手続き（フロー改善）を今週の施策に記載しましょう
(ここに入力)

●意図せずたまたま先週上手くいったことはありますか？なぜ上手くいったのか仮説を立てて仕組み化するヒントを探し、その仮説を再現するテストを実施しましょう！（テスト内容は今週の施策へ記載）
・たまたま上手くいったこと：
・上手くいった仮説：

●相談したいことはありますか？（相談したい方に@つけてコメントを書きましょう）
(ここに入力)

【今週施策】※数値目標を設定できる業務は数値も設定してみましょう♪
(ここに入力)
`;
};

export const generateWeeklyReport = (data: ReportData): string => {
    const summary = getWeeklySummary(data);
    const editorial = getDefaultEditorialTemplate(data.startDate, data.endDate);

    // This is now just a helper for backward compatibility if needed, 
    // but the system is moving away from combined generation.
    return `${editorial}\n\n${summary}`;
};
