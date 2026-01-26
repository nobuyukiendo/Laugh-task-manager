import {
    getTrelloAuthConfig,
    clearTrelloToken
} from './trello-auth';

import type {
    TrelloCard,
    TrelloChecklist,
    TrelloAttachment,
    TrelloLabel,
} from '../types/trello-types';

const TRELLO_API_BASE = 'https://api.trello.com/1';
const BASE_URL = TRELLO_API_BASE; // エイリアスを追加
const TRELLO_API_KEY = import.meta.env.VITE_TRELLO_API_KEY || '';

/**
 * APIエラー
 */
export class TrelloApiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public response?: any
    ) {
        super(message);
        this.name = 'TrelloApiError';
    }
}

/**
 * カードURLからshortLinkを抽出
 */
export function extractShortLinkFromUrl(cardUrl: string): string | null {
    // https://trello.com/c/eIsokRvc/1-遠藤テスト
    const match = cardUrl.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

/**
 * カード情報を取得
 */
export async function getCardByUrl(cardUrl: string, token: string): Promise<TrelloCard> {
    const shortLink = extractShortLinkFromUrl(cardUrl);
    if (!shortLink) {
        throw new TrelloApiError('カードURLが正しくありません。');
    }

    const url = `${TRELLO_API_BASE}/cards/${shortLink}?key=${TRELLO_API_KEY}&token=${token}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new TrelloApiError('認証エラー。再連携が必要です。', response.status);
            }
            throw new TrelloApiError(`カード取得エラー: ${response.statusText}`, response.status);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof TrelloApiError) throw error;
        throw new TrelloApiError('ネットワークエラー。接続を確認してください。');
    }
}

/**
 * カードのチェックリスト一覧を取得
 */
export async function getCardChecklists(cardId: string, token: string): Promise<TrelloChecklist[]> {
    const url = `${TRELLO_API_BASE}/cards/${cardId}/checklists?` +
        `checkItems=all&checkItem_fields=all&` +
        `key=${TRELLO_API_KEY}&token=${token}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new TrelloApiError('認証エラー。再連携が必要です。', response.status);
            }
            throw new TrelloApiError(`チェックリスト取得エラー: ${response.statusText}`, response.status);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof TrelloApiError) throw error;
        throw new TrelloApiError('ネットワークエラー。接続を確認してください。');
    }
}

/**
 * チェックリスト名を更新（自己マーキング用）
 */
export async function updateChecklistName(
    checklistId: string,
    newName: string,
    token: string
): Promise<TrelloChecklist> {
    const url = `${TRELLO_API_BASE}/checklists/${checklistId}?` +
        `key=${TRELLO_API_KEY}&token=${token}`;

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: newName }),
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new TrelloApiError('認証エラー。再連携が必要です。', response.status);
            }
            throw new TrelloApiError(`チェックリスト更新エラー: ${response.statusText}`, response.status);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof TrelloApiError) throw error;
        throw new TrelloApiError('ネットワークエラー。接続を確認してください。');
    }
}

/**
 * カードの添付ファイル一覧を取得
 */
export async function getCardAttachments(cardId: string, token: string): Promise<TrelloAttachment[]> {
    const url = `${TRELLO_API_BASE}/cards/${cardId}/attachments?` +
        `key=${TRELLO_API_KEY}&token=${token}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new TrelloApiError('認証エラー。再連携が必要です。', response.status);
            }
            throw new TrelloApiError(`添付ファイル取得エラー: ${response.statusText}`, response.status);
        }

        const attachments: TrelloAttachment[] = await response.json();
        // 新しい順にソート
        return attachments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
        if (error instanceof TrelloApiError) throw error;
        throw new TrelloApiError('ネットワークエラー。接続を確認してください。');
    }
}

/**
 * カードに添付ファイルを追加
 */
export async function createCardAttachment(
    cardId: string,
    file: File,
    token: string
): Promise<TrelloAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', TRELLO_API_KEY);
    formData.append('token', token);

    const url = `${TRELLO_API_BASE}/cards/${cardId}/attachments`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new TrelloApiError('認証エラー。再連携が必要です。', response.status);
            }
            throw new TrelloApiError(`添付ファイルアップロードエラー: ${response.statusText}`, response.status);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof TrelloApiError) throw error;
        throw new TrelloApiError('ネットワークエラー。接続を確認してください。');
    }
}

/**
 * カード情報を取得（プレビュー用：カード名、説明、添付、ラベル）
 */
export async function getCardPreview(
    cardId: string,
    token: string
): Promise<{ card: TrelloCard; attachments: TrelloAttachment[]; labels: TrelloLabel[] }> {
    const url = `${TRELLO_API_BASE}/cards/${cardId}?` +
        `fields=name,desc,url,shortLink&` +
        `attachments=true&` +
        `attachment_fields=name,url,date,mimeType,previews&` +
        `labels=all&` +
        `key=${TRELLO_API_KEY}&token=${token}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new TrelloApiError('認証エラー。再連携が必要です。', response.status);
            }
            throw new TrelloApiError(`カードプレビュー取得エラー: ${response.statusText}`, response.status);
        }

        const data = await response.json();

        // 添付ファイルを新しい順にソート（最新3件のみ）
        const attachments = (data.attachments || [])
            .sort((a: TrelloAttachment, b: TrelloAttachment) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            .slice(0, 3);

        return {
            card: data,
            attachments,
            labels: data.labels || [],
        };
    } catch (error) {
        if (error instanceof TrelloApiError) throw error;
        throw new TrelloApiError('ネットワークエラー。接続を確認してください。');
    }
}

/**
 * 指定したカードの詳細情報を取得
 */
export async function getCard(cardIdOrShortLink: string): Promise<TrelloCard> {
    const config = getTrelloAuthConfig();
    if (!config) throw new Error('Not authenticated');

    const url = `${BASE_URL}/cards/${cardIdOrShortLink}?key=${TRELLO_API_KEY}&token=${config.token}&fields=name,desc,url,shortUrl,idList,labels`;
    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 401) {
            clearTrelloToken();
            throw new Error('Unauthorized');
        }
        throw new Error('Failed to fetch card');
    }

    return response.json();
}

/**
 * チェック項目の更新（名前変更、完了状態変更）
 */
export async function updateCheckItem(
    cardId: string,
    checkItemId: string,
    params: { name?: string; state?: 'complete' | 'incomplete' }
): Promise<void> {
    const config = getTrelloAuthConfig();
    if (!config) throw new Error('Not authenticated');

    const queryParams = new URLSearchParams({
        key: TRELLO_API_KEY,
        token: config.token,
    });

    if (params.name) queryParams.append('name', params.name);
    if (params.state) queryParams.append('state', params.state);

    const url = `${BASE_URL}/cards/${cardId}/checkItem/${checkItemId}?${queryParams.toString()}`;
    const response = await fetch(url, {
        method: 'PUT',
    });

    if (!response.ok) {
        if (response.status === 401) {
            clearTrelloToken();
            throw new Error('Unauthorized');
        }
        throw new Error('Failed to update check item');
    }
}
