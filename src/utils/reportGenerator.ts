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

export const generateWeeklyReport = ({ logs, departments, workTypes, detailTasks, startDate, endDate }: ReportData): string => {
    // Helpers to resolve names
    const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || '不明な部門';
    const getWTName = (id: string) => workTypes.find(w => w.id === id)?.name || '未分類'; // Handle empty too?
    const getDTName = (id: string) => detailTasks.find(d => d.id === id)?.name || '不明';

    // 1. Total Duration
    const totalSec = logs.reduce((acc, l) => acc + (l.durationSec || 0), 0);
    const totalHours = (totalSec / 3600).toFixed(1);

    // 2. Aggregations
    const deptMap: Record<string, number> = {};
    const wtMap: Record<string, number> = {};
    const dtMap: Record<string, number> = {};
    const notes: string[] = [];

    logs.forEach(l => {
        const sec = l.durationSec || 0;

        // Dept
        const dName = getDeptName(l.departmentId);
        deptMap[dName] = (deptMap[dName] || 0) + sec;

        // Work Type
        const wName = l.workTypeId ? getWTName(l.workTypeId) : '未選択';
        wtMap[wName] = (wtMap[wName] || 0) + sec;

        // Details - Split multiple logic?
        // User wants "Detail Task Sum". If a log has multiple details, how do we split time?
        // Simple approach: Divide time equally or just count occurrence?
        // Time tracking usually implies the duration applies to the set of details.
        // Let's attribute the full duration to the combo? Or simply list top details by frequency?
        // Request says "Detail Task Total". Let's assume full duration for simplicity, or 
        // if multiple, we can't easily split. Let's tag them as "Compound" or just count frequency.
        // BETTER: Just list unique details found and maybe total duration where they appeared.
        // OR: Divide duration by count of details.
        if (l.detailTaskIds.length > 0) {
            const splitSec = sec / l.detailTaskIds.length;
            l.detailTaskIds.forEach(did => {
                const dtName = getDTName(did);
                dtMap[dtName] = (dtMap[dtName] || 0) + splitSec;
            });
        } else {
            dtMap['(詳細なし)'] = (dtMap['(詳細なし)'] || 0) + sec;
        }

        // Notes
        if (l.note) {
            notes.push(l.note);
        }
    });

    // Sort and Format Helper
    const formatMap = (map: Record<string, number>, limit = 5) => {
        return Object.entries(map)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([name, sec]) => `・${name}: ${(sec / 3600).toFixed(1)}h`)
            .join('\n');
    };

    const deptStr = formatMap(deptMap);
    const wtStr = formatMap(wtMap);
    const dtStr = formatMap(dtMap, 8); // Top 8 details

    // Unique notes
    const uniqueNotes = Array.from(new Set(notes)).filter(Boolean);
    const notesStr = uniqueNotes.length > 0
        ? uniqueNotes.map(n => `・${n}`).join('\n')
        : '・(なし)';


    // 3. Build Template
    const startStr = format(startDate, 'M月d日');
    const endStr = format(endDate, 'M月d日');

    return `【週次レビュー】
${startStr}～${endStr}

●先週試したこと・工夫したことの結果と数値を書いてみましょう
--------------------------------------------------
【週合計】 ${totalHours} 時間

【部門別】
${deptStr}

【作業種別】
${wtStr}

【詳細作業 (Top 8)】
${dtStr}

【自由入力メモ】
${notesStr}
--------------------------------------------------

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
