// Trello関連の型定義

export interface TrelloCard {
    id: string;
    name: string;
    desc: string;
    url: string;
    shortLink: string;
    idBoard: string;
    idList: string;
    labels?: TrelloLabel[];
}

export interface TrelloCheckItem {
    id: string;
    name: string;
    state: 'complete' | 'incomplete';
    pos: number;
    idChecklist: string;
}

export interface TrelloChecklist {
    id: string;
    name: string;
    idCard: string;
    pos: number;
    checkItems: TrelloCheckItem[];
}

export interface TrelloAttachment {
    id: string;
    name: string;
    url: string;
    date: string;
    bytes?: number;
    mimeType?: string;
    previews?: Array<{
        id: string;
        scaled: boolean;
        url: string;
        bytes: number;
        height: number;
        width: number;
    }>;
}

export interface TrelloAuthConfig {
    token: string;
    expiresAt?: number; // timestamp in ms
    scope?: string;
}

export interface Position {
    name: string; // 役職名（例：「パートナー」）
    fullText: string; // 元のチェックリスト名（例：「■パートナー：自分の行動の結果率に責任を持つ」）
    checklistId: string;
}

// チェック項目のプレビュー用
export interface CheckItemPreview {
    checkItem: TrelloCheckItem;
    links: ExtractedLink[];
    trelloCardPreviews?: TrelloCardPreview[];
}

export interface ExtractedLink {
    url: string;
    displayText: string; // URLドメインまたはカード名
    isTrelloCard: boolean;
    cardShortLink?: string;
}

export interface TrelloCardPreview {
    card: TrelloCard;
    attachments: TrelloAttachment[];
    labels?: TrelloLabel[];
}

export interface TrelloLabel {
    id: string;
    name: string;
    color: string;
}
