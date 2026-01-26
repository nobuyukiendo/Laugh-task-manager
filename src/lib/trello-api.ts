import {
    getTrelloAuthConfig,
    clearTrelloToken,
    getTrelloApiKey, // 追加
} from './trello-auth';

import type {
    TrelloCard,
    TrelloChecklist,
    TrelloAttachment,
    TrelloLabel,
} from '../types/trello-types';

const TRELLO_API_BASE = 'https://api.trello.com/1';
const BASE_URL = TRELLO_API_BASE; // エイリアスを追加

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
    const match = cardUrl.match(/trello\.com\/c\/([^/?#]+)/);
    return match ? match[1] : null;
}

/**
 * カード情報を取得
 */
export async function getCardByUrl(cardUrl: string, token: string): Promise<TrelloCard> {
    const shortLink = extractShortLinkFromUrl(cardUrl);
    if (!shortLink) {
        throw new Error('無効なTrelloカードURLです');
    }

    const apiKey = getTrelloApiKey(); // 動的に取得
    if (!apiKey) throw new Error('API Keyが設定されていません');

    const response = await fetch(`${BASE_URL}/cards/${shortLink}?key=${apiKey}&token=${token}`);

    if (!response.ok) {
        const status = response.status;
        const errorData = await response.json().catch(() => ({}));
        throw new TrelloApiError(errorData.message || 'カード情報の取得に失敗しました', status, errorData);
    }

    return await response.json();
}

/**
 * カードのチェックリスト一覧を取得
 */
export async function getCardChecklists(cardId: string, token: string): Promise<TrelloChecklist[]> {
    const apiKey = getTrelloApiKey(); // 動的に取得
    if (!apiKey) throw new Error('API Keyが設定されていません');

    const response = await fetch(
        `${BASE_URL}/cards/${cardId}/checklists?key=${apiKey}&token=${token}`
    );

    if (!response.ok) {
        const status = response.status;
        const errorData = await response.json().catch(() => ({}));
        throw new TrelloApiError(errorData.message || 'チェックリストの取得に失敗しました', status, errorData);
    }

    return await response.json();
}

/**
 * チェックリスト名を更新（自己マーキング用）
 */
export async function updateChecklistName(
    checklistId: string,
    newName: string,
    token: string
): Promise<TrelloChecklist> {
    const apiKey = getTrelloApiKey(); // 動的に取得
    if (!apiKey) throw new Error('API Keyが設定されていません');

    const response = await fetch(
        `${BASE_URL}/checklists/${checklistId}/name?value=${encodeURIComponent(newName)}&key=${apiKey}&token=${token}`,
        { method: 'PUT' }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new TrelloApiError(errorData.message || 'チェックリスト名の更新に失敗しました', response.status, errorData);
    }

    return await response.json();
}

/**
 * カードの添付ファイル一覧を取得
 */
export async function getCardAttachments(cardId: string, token: string): Promise<TrelloAttachment[]> {
    const apiKey = getTrelloApiKey(); // 動的に取得
    if (!apiKey) throw new Error('API Keyが設定されていません');

    const response = await fetch(
        `${BASE_URL}/cards/${cardId}/attachments?key=${apiKey}&token=${token}`
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new TrelloApiError(errorData.message || '添付ファイルの取得に失敗しました', response.status, errorData);
    }

    return await response.json();
}

/**
 * カードに添付ファイルを追加
 */
export async function createCardAttachment(
    cardId: string,
    file: File,
    token: string
): Promise<TrelloAttachment> {
    const apiKey = getTrelloApiKey(); // 動的に取得
    if (!apiKey) throw new Error('API Keyが設定されていません');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', apiKey);
    formData.append('token', token);

    const response = await fetch(`${BASE_URL}/cards/${cardId}/attachments`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new TrelloApiError(errorData.message || 'ファイルのアップロードに失敗しました', response.status, errorData);
    }

    return await response.json();
}

/**
 * カード情報を取得（プレビュー用：カード名、説明、添付、ラベル）
 */
export async function getCardPreview(
    cardId: string,
    token: string
): Promise<{ card: TrelloCard; attachments: TrelloAttachment[]; labels: TrelloLabel[] }> {
    const apiKey = getTrelloApiKey(); // 動的に取得
    if (!apiKey) throw new Error('API Keyが設定されていません');

    const [cardRes, attachRes] = await Promise.all([
        fetch(`${BASE_URL}/cards/${cardId}?key=${apiKey}&token=${token}`),
        fetch(`${BASE_URL}/cards/${cardId}/attachments?key=${apiKey}&token=${token}`),
    ]);

    if (!cardRes.ok || !attachRes.ok) {
        throw new Error('プレビュー情報の取得に失敗しました');
    }

    const card = await cardRes.json();
    const attachments = await attachRes.json();

    return {
        card,
        attachments,
        labels: card.labels || [],
    };
}

/**
 * 指定したカードの詳細情報を取得
 */
export async function getCard(cardIdOrShortLink: string): Promise<TrelloCard> {
    const token = getTrelloAuthConfig()?.token;
    if (!token) throw new Error('Trelloと連携されていません');

    const apiKey = getTrelloApiKey(); // 動的に取得
    if (!apiKey) throw new Error('API Keyが設定されていません');

    const response = await fetch(`${BASE_URL}/cards/${cardIdOrShortLink}?key=${apiKey}&token=${token}`);
    if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) {
            clearTrelloToken();
        }
        throw new Error('カードの取得に失敗しました');
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
    const token = getTrelloAuthConfig()?.token;
    if (!token) throw new Error('Trelloと連携されていません');

    const apiKey = getTrelloApiKey(); // 動的に取得
    if (!apiKey) throw new Error('API Keyが設定されていません');

    const query = new URLSearchParams({
        key: apiKey,
        token: token,
        ...(params.name ? { name: params.name } : {}),
        ...(params.state ? { state: params.state } : {}),
    });

    const response = await fetch(
        `${BASE_URL}/cards/${cardId}/checkItem/${checkItemId}?${query.toString()}`,
        { method: 'PUT' }
    );

    if (!response.ok) {
        throw new Error('チェック項目の更新に失敗しました');
    }
}
