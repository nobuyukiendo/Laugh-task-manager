// Trello認証管理

const TRELLO_AUTH_STORAGE_KEY = 'trello_auth_config';
const TRELLO_API_KEY_STORAGE_KEY = 'trello.apiKey';
const TRELLO_TOKEN_MODE_STORAGE_KEY = 'trello.tokenMode';
const TRELLO_APP_NAME = 'Laugh Task Manager';

// セッション用トークン保持（「今回のみ」用）
let sessionToken: string | null = null;

export interface TrelloAuthConfig {
    token: string;
    expiresAt?: number; // timestamp in ms
    scope?: string;
}

/**
 * Trello API Keyを取得（解決順: .env -> localStorage）
 */
export function getTrelloApiKey(): string {
    // 1. 環境変数を最優先
    const envKey = import.meta.env.VITE_TRELLO_API_KEY;
    if (envKey && envKey.trim() !== '') {
        return envKey.trim();
    }

    // 2. localStorageをチェック
    const storedKey = localStorage.getItem(TRELLO_API_KEY_STORAGE_KEY);
    return (storedKey || '').trim();
}

/**
 * Trello認証フローを開始
 * @param expiration 有効期限（'1hour', '1day', '30days', 'never'）
 */
export function initTrelloAuth(expiration: '1hour' | '1day' | '30days' | 'never' = '30days'): void {
    const apiKey = getTrelloApiKey();
    if (!apiKey) {
        throw new Error('Trello API Keyが設定されていません。設定から入力してください。');
    }

    // 完全なURLを指定（Hashを含む）
    // Allowed Origins の不一致を避けるため、window.location をベースに構築
    const returnUrl = window.location.origin + window.location.pathname + '#/evaluation';
    const scope = 'read,write';

    const authUrl = `https://trello.com/1/authorize?` +
        `expiration=${expiration}&` +
        `name=${encodeURIComponent(TRELLO_APP_NAME)}&` +
        `scope=${scope}&` +
        `response_type=token&` +
        `key=${apiKey}&` +
        `return_url=${encodeURIComponent(returnUrl)}`;

    // 同一ウィンドウでリダイレクト
    window.location.href = authUrl;
}

/**
 * URLからトークンを抽出（認可後のリダイレクト時）
 * 以前の真っ暗画面バグを防ぐため、非常に頑強な正規表現を使用
 */
export function extractTokenFromUrl(): string | null {
    const fullUrl = window.location.href;
    // [?&#]token=([^&#]+) で確実にtoken=以降の文字列をキャプチャ
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
        // 保存モードを確認（localStorageに保存されている設定があればそれに従う。なければデフォルトpersist）
        const mode = (localStorage.getItem(TRELLO_TOKEN_MODE_STORAGE_KEY) as 'persist' | 'session') || 'persist';
        saveTrelloToken(token, undefined, mode);

        // URLをクリーンアップ（tokenを削除して #/evaluation に戻す）
        const cleanUrl = window.location.origin + window.location.pathname + '#/evaluation';

        // HashRouterが正しく検知できるようハッシュを明示的にクリア・再設定
        window.location.hash = '/evaluation';

        // 履歴を置換
        window.history.replaceState(null, '', cleanUrl);

        return true;
    }
    return false;
}

/**
 * Trelloトークンを保存
 * @param mode 'persist' (永続) か 'session' (メモリのみ)
 */
export function saveTrelloToken(token: string, expiresAt?: number, mode: 'persist' | 'session' = 'persist'): void {
    const config: TrelloAuthConfig = {
        token,
        expiresAt,
        scope: 'read,write'
    };

    if (mode === 'persist') {
        localStorage.setItem(TRELLO_AUTH_STORAGE_KEY, JSON.stringify(config));
        sessionToken = null; // 念のためメモリはクリア
    } else {
        sessionToken = token;
        // メモリのみの場合、localStorageからは削除（不整合防止）
        localStorage.removeItem(TRELLO_AUTH_STORAGE_KEY);
    }
}

/**
 * 保存されたTrelloトークンを取得
 */
export function getTrelloToken(): string | null {
    // 1. メモリ（session）をチェック
    if (sessionToken) return sessionToken;

    // 2. localStorageをチェック
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
    sessionToken = null;
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
    if (sessionToken) {
        return { token: sessionToken, scope: 'read,write' };
    }

    const configStr = localStorage.getItem(TRELLO_AUTH_STORAGE_KEY);
    if (!configStr) return null;

    try {
        return JSON.parse(configStr);
    } catch {
        return null;
    }
}
