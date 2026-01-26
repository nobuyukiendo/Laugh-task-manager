import React, { useState } from 'react';
import type { TrelloCard, TrelloChecklist } from '../../types/trello-types';
import { TrelloConnectionHeader } from './TrelloConnectionHeader';
import { PositionFilter, extractPositions } from './PositionFilter';
import { CheckItemList } from './CheckItemList';
import { SelfMarkingEditor } from './SelfMarkingEditor';
import { AttachmentManager } from './AttachmentManager';
import { getTrelloToken } from '../../lib/trello-auth';
import { getCardChecklists } from '../../lib/trello-api';

export const TrelloPanel: React.FC = () => {
    const [currentCard, setCurrentCard] = useState<TrelloCard | null>(null);
    const [checklists, setChecklists] = useState<TrelloChecklist[]>([]);
    const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<'all' | 'complete' | 'incomplete'>('all');
    const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);

    const handleCardLoaded = async (card: TrelloCard) => {
        setCurrentCard(card);
        setSelectedPosition(null);
        setIsLoadingChecklists(true);

        try {
            const token = getTrelloToken();
            if (!token) return;

            const lists = await getCardChecklists(card.id, token);
            setChecklists(lists);
        } catch (err) {
            console.error('チェックリスト取得エラー:', err);
        } finally {
            setIsLoadingChecklists(false);
        }
    };

    const handleUpdate = async () => {
        if (!currentCard) return;

        // チェックリストを再取得
        setIsLoadingChecklists(true);
        try {
            const token = getTrelloToken();
            if (!token) return;

            const lists = await getCardChecklists(currentCard.id, token);
            setChecklists(lists);
        } catch (err) {
            console.error('チェックリスト再取得エラー:', err);
        } finally {
            setIsLoadingChecklists(false);
        }
    };

    // 選択された役職のチェックリストを取得
    const selectedChecklist = checklists.find((cl) => {
        const positions = extractPositions([cl]);
        return positions.some((p) => p.name === selectedPosition);
    });

    // 選択された役職のチェック項目を取得
    const checkItems = selectedChecklist?.checkItems || [];

    return (
        <div className="space-y-6">
            {/* 接続ヘッダー */}
            <TrelloConnectionHeader
                onCardLoaded={handleCardLoaded}
                currentCard={currentCard}
            />

            {/* 役職フィルタ */}
            {currentCard && checklists.length > 0 && (
                <PositionFilter
                    checklists={checklists}
                    selectedPosition={selectedPosition}
                    onPositionChange={setSelectedPosition}
                    filterMode={filterMode}
                    onFilterModeChange={setFilterMode}
                />
            )}

            {/* チェック項目一覧 */}
            {selectedPosition && (
                <>
                    <div>
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            チェック項目
                        </h3>
                        {isLoadingChecklists ? (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                読み込み中...
                            </div>
                        ) : (
                            <CheckItemList
                                checkItems={checkItems}
                                filterMode={filterMode}
                                cardId={currentCard?.id || ''}
                                onItemUpdate={handleUpdate}
                            />
                        )}
                    </div>

                    {/* 自己マーキング編集 */}
                    <SelfMarkingEditor
                        checklist={selectedChecklist || null}
                    />
                </>
            )}

            {/* 添付ファイル管理 */}
            {currentCard && (
                <AttachmentManager cardId={currentCard.id} />
            )}
        </div>
    );
};
