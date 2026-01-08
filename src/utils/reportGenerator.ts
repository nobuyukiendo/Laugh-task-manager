import { WorkLog, Department, WorkType, DetailTask } from '../db';
import { format } from 'date-fns';

interface ReportData {
    logs: WorkLog[];
    departments: Department[];
    workTypes: WorkType[];
    detailTasks: DetailTask[];
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

        // Detail Task Aggregation
        // Use detailTaskNames if present, otherwise fallback to detailTaskIds lookup
        let namesToAggregate: string[] = [];
        if (l.detailTaskNames && l.detailTaskNames.length > 0) {
            namesToAggregate = l.detailTaskNames;
        } else if (l.detailTaskIds.length > 0) {
            namesToAggregate = l.detailTaskIds.map(did => {
                const master = detailTasks.find(d => d.id === did);
                return master ? master.name : '不明 (マスタ削除)';
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

    // Sort and Format Helper
    const formatMap = (map: Record<string, number>, limit = 5) => {
        return Object.entries(map)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([name, sec]) => `・${name}: ${Math.round(sec / 60)}min`)
            .join('\n');
    };

    const deptStr = formatMap(deptMap);
    const wtStr = formatMap(wtMap);
    const dtStr = formatMap(dtMap, 8); // Top 8 details

    return `【週合計】 ${totalMinutes} 分\n\n【部門別】\n${deptStr}\n\n【作業種別】\n${wtStr}\n\n【詳細作業 (Top 8)】\n${dtStr}`;
};

export const getDefaultEditorialTemplate = (): string => {
    return `
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
    const header = getWeeklyHeader(data.startDate, data.endDate);
    const anchor = getDailyCommentsAnchor();
    const summary = getWeeklySummary(data);
    const editorial = getDefaultEditorialTemplate();

    return `${header}\n\n${anchor}\n${summary}\n--------------------------------------------------\n${editorial}`;
};
