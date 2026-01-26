import React, { useState, useEffect } from 'react';
import { GripVertical } from 'lucide-react';
import type { TrelloChecklist } from '../../types/trello-types';

interface Position {
    name: string;
    fullText: string;
    checklistId: string;
}

/**
 * チェックリスト名から役職を抽出
 * 例:「■パートナー:自分の行動の結果率に責任を持つ」 → 「パートナー」
 */
export function extractPositions(checklists: TrelloChecklist[]): Position[] {
    const positions: Position[] = [];

    for (const checklist of checklists) {
        const match = checklist.name.match(/^■(.+?)[:：]/);
        if (match) {
            const positionName = match[1].trim();
            positions.push({
                name: positionName,
                fullText: checklist.name,
                checklistId: checklist.id,
            });
        }
    }

    return positions;
}

interface PositionFilterProps {
    checklists: TrelloChecklist[];
    selectedPosition: string | null;
    onPositionChange: (position: string | null) => void;
    filterMode: 'all' | 'complete' | 'incomplete';
    onFilterModeChange: (mode: 'all' | 'complete' | 'incomplete') => void;
}

const POSITION_ORDER_KEY = 'trello_position_order';
const LAST_SELECTED_POSITION_KEY = 'trello_last_selected_position';

export const PositionFilter: React.FC<PositionFilterProps> = ({
    checklists,
    selectedPosition,
    onPositionChange,
    filterMode,
    onFilterModeChange,
}) => {
    const positions = extractPositions(checklists);
    const [positionOrder, setPositionOrder] = useState<string[]>([]);
    const [showOrderManager, setShowOrderManager] = useState(false);

    // 役職の順番を初期化・復元
    useEffect(() => {
        const savedOrder = localStorage.getItem(POSITION_ORDER_KEY);
        if (savedOrder) {
            try {
                const order = JSON.parse(savedOrder);
                setPositionOrder(order);
            } catch (e) {
                console.error('Failed to parse position order:', e);
            }
        }
    }, []);

    // 最後に選択した役職を復元
    useEffect(() => {
        if (positions.length > 0 && !selectedPosition) {
            const lastSelected = localStorage.getItem(LAST_SELECTED_POSITION_KEY);
            if (lastSelected && positions.some(p => p.name === lastSelected)) {
                onPositionChange(lastSelected);
            }
        }
    }, [positions.length]);

    // 役職選択時に保存
    const handlePositionChange = (position: string | null) => {
        onPositionChange(position);
        if (position) {
            localStorage.setItem(LAST_SELECTED_POSITION_KEY, position);
        }
    };

    // 順番でソート
    const sortedPositions = [...positions].sort((a, b) => {
        const indexA = positionOrder.indexOf(a.name);
        const indexB = positionOrder.indexOf(b.name);

        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    // 順番を上に移動
    const moveUp = (positionName: string) => {
        const currentOrder = positionOrder.length > 0 ? positionOrder : positions.map(p => p.name);
        const index = currentOrder.indexOf(positionName);
        if (index > 0) {
            const newOrder = [...currentOrder];
            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
            setPositionOrder(newOrder);
            localStorage.setItem(POSITION_ORDER_KEY, JSON.stringify(newOrder));
        }
    };

    // 順番を下に移動
    const moveDown = (positionName: string) => {
        const currentOrder = positionOrder.length > 0 ? positionOrder : positions.map(p => p.name);
        const index = currentOrder.indexOf(positionName);
        if (index < currentOrder.length - 1) {
            const newOrder = [...currentOrder];
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
            setPositionOrder(newOrder);
            localStorage.setItem(POSITION_ORDER_KEY, JSON.stringify(newOrder));
        }
    };

    return (
        <div className="space-y-4">
            {/* 役職ドロップダウン */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        役職
                    </label>
                    <button
                        onClick={() => setShowOrderManager(!showOrderManager)}
                        className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                        {showOrderManager ? '閉じる' : '順番変更'}
                    </button>
                </div>

                {showOrderManager ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            ↑↓ボタンで順番を変更できます
                        </p>
                        {sortedPositions.map((position, index) => (
                            <div
                                key={position.checklistId}
                                className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                                <GripVertical size={16} className="text-slate-400" />
                                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                                    {position.name}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => moveUp(position.name)}
                                        disabled={index === 0}
                                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        onClick={() => moveDown(position.name)}
                                        disabled={index === sortedPositions.length - 1}
                                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        ↓
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <select
                        value={selectedPosition || ''}
                        onChange={(e) => handlePositionChange(e.target.value || null)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                    >
                        <option value="">役職を選択してください</option>
                        {sortedPositions.map((position) => (
                            <option key={position.checklistId} value={position.name}>
                                {position.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* 表示切替 */}
            {selectedPosition && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        表示
                    </label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onFilterModeChange('all')}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterMode === 'all'
                                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            全体
                        </button>
                        <button
                            onClick={() => onFilterModeChange('incomplete')}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterMode === 'incomplete'
                                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            未達成
                        </button>
                        <button
                            onClick={() => onFilterModeChange('complete')}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterMode === 'complete'
                                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            達成
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
