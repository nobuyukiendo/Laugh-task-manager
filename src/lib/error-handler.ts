// Trelloエラーハンドリング

import { clearTrelloToken } from './trello-auth';
import { TrelloApiError } from './trello-api';

export interface ErrorHandlerResult {
    shouldRetry: boolean;
    message: string;
    requiresReauth: boolean;
}

/**
 * Trello APIエラーをハンドリング
 */
export function handleTrelloError(error: any): ErrorHandlerResult {
    // 認証エラー（401/403）
    if (error instanceof TrelloApiError && (error.status === 401 || error.status === 403)) {
        clearTrelloToken();
        return {
            shouldRetry: false,
            message: '認証の有効期限が切れました。再度連携してください。',
            requiresReauth: true,
        };
    }

    // ネットワークエラー
    if (error instanceof TrelloApiError && !error.status) {
        return {
            shouldRetry: true,
            message: 'ネットワークエラーが発生しました。接続を確認して再試行してください。',
            requiresReauth: false,
        };
    }

    // その他のAPIエラー
    if (error instanceof TrelloApiError) {
        return {
            shouldRetry: false,
            message: error.message,
            requiresReauth: false,
        };
    }

    // 不明なエラー
    return {
        shouldRetry: false,
        message: '予期しないエラーが発生しました。',
        requiresReauth: false,
    };
}
