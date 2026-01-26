// Trello認証管理

const TRELLO_AUTH_STORAGE_KEY = 'trello_auth_config';
const TRELLO_API_KEY = import.meta.env.VITE_TRELLO_API_KEY || '';
const TRELLO_APP_NAME = 'Laugh Task Manager';

export interface TrelloAuthConfig {
    token: string;
    expiresAt?: number; // timestamp in ms
    scope?: string;
}

/**
 * Trello認証フローを開始
 * @param expiration 有効期限（'1hour', '1day', '30days', 'never'）
 */
export function initTrelloAuth(expiration: '1hour' | '1day' | '30days' | 'never' = '30days'): void {
    if (!TRELLO_API_KEY) {
        throw new Error('Trello API Keyが設定されていません。環境変数VITE_TRELLO_API_KEYを設定してください。');
    }

    // 完全なURLを指定（Hashを含む）
    const returnUrl = window.location.origin + window.location.pathname + '#/evaluation';
    const scope = 'read,write';

    const authUrl = `https://trello.com/1/authorize?` +
        `expiration=${expiration}&` +
        `name=${encodeURIComponent(TRELLO_APP_NAME)}&` +
        `scope=${scope}&` +
        `response_type=token&` +
        `key=${TRELLO_API_KEY}&` +
        `return_url=${encodeURIComponent(returnUrl)}`;

    // 同一ウィンドウでリダイレクト（ポップアップは廃止）
    window.location.href = authUrl;
}

/**
 * URLからトークンを抽出（認可後のリダイレクト時）
 * ハッシュ内のtoken、クエリパラメータのtokenの両方に対応
 */
export function extractTokenFromUrl(): string | null {
    const fullUrl = window.location.href;
    // ?token=xxx, &token=xxx, #token=xxx, #/evaluation&token=xxx などに対応
    const match = fullUrl.match(/[?&#]token=([^&#]+)/);
    if (match) {
        try {
            return decodeURIComponent(match[1]);
        } catch {
            return match[1];
        }
    }
    return null;
}

/**
 * 認証後の処理を実行
 * tokenを抽出→保存→URLクリーンアップ
 */
export function handleAuthReturn(): boolean {
    const token = extractTokenFromUrl();
    if (token) {
        saveTrelloToken(token);

        // URLをクリーンアップ（tokenを削除）
        // Trelloは #/evaluation&token=... の形式でリダイレクトしてくるため、
        // これを #/evaluation に修正する必要がある
        const cleanUrl = window.location.origin + window.location.pathname + '#/evaluation';

        // 即座にURLを修正してからreplaceState
        // これにより、HashRouterが正しくルーティングできる
        window.location.hash = '/evaluation';

        // 少し待ってからreplaceStateで履歴をクリーンアップ
        setTimeout(() => {
            window.history.replaceState(null, '', cleanUrl);
        }, 100);

        return true;
    }
    return false;
}

/**
 * Trelloトークンを保存
 */
export function saveTrelloToken(token: string, expiresAt?: number): void {
    const config: TrelloAuthConfig = {
        token,
        expiresAt,
        scope: 'read,write'
    };
    localStorage.setItem(TRELLO_AUTH_STORAGE_KEY, JSON.stringify(config));
}

/**
 * 保存されたTrelloトークンを取得
 */
export function getTrelloToken(): string | null {
    const configStr = localStorage.getItem(TRELLO_AUTH_STORAGE_KEY);
    if (!configStr) return null;

    try {
        const config: TrelloAuthConfig = JSON.parse(configStr);

        // 有効期限チェック
        if (config.expiresAt && config.expiresAt < Date.now()) {
            clearTrelloToken();
            return null;
        }

        return config.token;
    } catch {
        return null;
    }
}

/**
 * Trelloトークンを削除（連携解除）
 */
export function clearTrelloToken(): void {
    localStorage.removeItem(TRELLO_AUTH_STORAGE_KEY);
}

/**
 * Trelloトークンの有効性チェック
 */
export function isTrelloTokenValid(): boolean {
    return getTrelloToken() !== null;
}

/**
 * Trello認証設定を取得
 */
export function getTrelloAuthConfig(): TrelloAuthConfig | null {
    const configStr = localStorage.getItem(TRELLO_AUTH_STORAGE_KEY);
    if (!configStr) return null;

    try {
        return JSON.parse(configStr);
    } catch {
        return null;
    }
}
