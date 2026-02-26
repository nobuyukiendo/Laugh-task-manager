/**
 * クロス分析 計算式テンプレート定義
 * variables は式に登場する変数の定義（varId: 'A'/'B'/'C'...）
 */

export interface FormulaTemplate {
    id: string;
    name: string;           // 計算式名（デフォルト）
    defaultUnit: string;    // 結果単位（デフォルト）
    expression: string;     // 式（例: 'B/A*100'）
    variables: { varId: string; label: string }[]; // 変数定義（順番で表示）
    description: string;    // 指標の説明
    category: string;       // カテゴリ（検索・絞り込みに使用）
}

export const FORMULA_TEMPLATES: FormulaTemplate[] = [
    // ─── 広告・マーケティング ───
    {
        id: 'ctr',
        name: 'CTR（クリック率）',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: '表示回数（インプレッション）' },
            { varId: 'B', label: 'クリック数' },
        ],
        description: '広告・コンテンツが表示された回数のうち、クリックされた割合。CTRが高いほど訴求力が高い。',
        category: '広告・マーケティング',
    },
    {
        id: 'cvr',
        name: 'CVR（コンバージョン率）',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: 'クリック数（またはセッション数）' },
            { varId: 'B', label: 'コンバージョン数（購入・登録など）' },
        ],
        description: 'アクセスしたユーザーのうち、目標行動（購入・申込など）を完了した割合。',
        category: '広告・マーケティング',
    },
    {
        id: 'roas',
        name: 'ROAS（広告費用対効果）',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: '広告費' },
            { varId: 'B', label: '売上' },
        ],
        description: '広告費1円に対して何円の売上を生んだか。100%以上で広告費を上回る売上。',
        category: '広告・マーケティング',
    },
    {
        id: 'acos',
        name: 'ACOS（広告費売上比率）',
        defaultUnit: '％',
        expression: 'A/B*100',
        variables: [
            { varId: 'A', label: '広告費' },
            { varId: 'B', label: '売上' },
        ],
        description: '売上に対する広告費の割合。値が低いほど広告効率が高い。ROASの逆数的指標。',
        category: '広告・マーケティング',
    },
    {
        id: 'cpm',
        name: 'CPM（1000インプレッション単価）',
        defaultUnit: '円',
        expression: 'A/B*1000',
        variables: [
            { varId: 'A', label: '広告費' },
            { varId: 'B', label: 'インプレッション数' },
        ],
        description: '広告を1000回表示するのにかかるコスト。メディアの費用対効果の比較に使う。',
        category: '広告・マーケティング',
    },
    {
        id: 'cpc',
        name: 'CPC（クリック単価）',
        defaultUnit: '円',
        expression: 'A/B',
        variables: [
            { varId: 'A', label: '広告費' },
            { varId: 'B', label: 'クリック数' },
        ],
        description: '1クリックあたりにかかった広告費。低いほどクリックを安く獲得できている。',
        category: '広告・マーケティング',
    },
    {
        id: 'cpa',
        name: 'CPA（獲得単価）',
        defaultUnit: '円',
        expression: 'A/B',
        variables: [
            { varId: 'A', label: '広告費' },
            { varId: 'B', label: 'コンバージョン数' },
        ],
        description: '1件のコンバージョン（購入・申込など）を獲得するのにかかったコスト。',
        category: '広告・マーケティング',
    },
    {
        id: 'roi',
        name: 'ROI（投資収益率）',
        defaultUnit: '％',
        expression: '(B-A)/A*100',
        variables: [
            { varId: 'A', label: '投資額（コスト）' },
            { varId: 'B', label: 'リターン（売上・成果）' },
        ],
        description: '投資に対してどれだけ利益を生んだか。0%が損益分岐、高いほど効率的。',
        category: '広告・マーケティング',
    },

    // ─── 採用・HR ───
    {
        id: 'hire_rate',
        name: '採用率',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: '応募数' },
            { varId: 'B', label: '採用数' },
        ],
        description: '応募者のうち採用された割合。採用プロセスの絞り込み度合いを示す。',
        category: '採用・HR',
    },
    {
        id: 'interview_pass_rate',
        name: '面接通過率',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: '面接数' },
            { varId: 'B', label: '面接通過数（次選考へ）' },
        ],
        description: '面接を受けた候補者のうち次のステップへ進んだ割合。',
        category: '採用・HR',
    },
    {
        id: 'funnel_hire',
        name: 'ファネル採用率（応募→採用）',
        defaultUnit: '％',
        expression: 'C/A*100',
        variables: [
            { varId: 'A', label: '応募数' },
            { varId: 'B', label: '面接数' },
            { varId: 'C', label: '採用数' },
        ],
        description: '応募者全体から最終採用までの通過率。採用ファネル全体の効率を把握する。',
        category: '採用・HR',
    },
    {
        id: 'offer_accept_rate',
        name: 'オファー承諾率',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: 'オファー数' },
            { varId: 'B', label: '承諾数（入社確定）' },
        ],
        description: '内定・オファーを出した候補者のうち承諾した割合。',
        category: '採用・HR',
    },

    // ─── 業務・生産性 ───
    {
        id: 'output_per_hour',
        name: '1時間あたり生産量',
        defaultUnit: '/時間',
        expression: 'A/B*60',
        variables: [
            { varId: 'A', label: '生産量（任意の単位）' },
            { varId: 'B', label: '作業時間（分）' },
        ],
        description: '1時間で生み出せる量。生産性の基本指標。文字数・件数など何でも計測可能。',
        category: '業務・生産性',
    },
    {
        id: 'time_per_unit',
        name: '単位あたり時間（分）',
        defaultUnit: '分/単位',
        expression: 'B/A',
        variables: [
            { varId: 'A', label: '成果量（件数・文字数など）' },
            { varId: 'B', label: '作業時間（分）' },
        ],
        description: '1単位を生産するのにかかる時間（分）。小さいほど効率的。',
        category: '業務・生産性',
    },
    {
        id: 'count_per_hour',
        name: '件数/時間',
        defaultUnit: '件/時間',
        expression: 'A/B*60',
        variables: [
            { varId: 'A', label: '処理件数' },
            { varId: 'B', label: '作業時間（分）' },
        ],
        description: '1時間で処理できる件数。問い合わせ対応・確認件数・作業数など汎用的に使える。',
        category: '業務・生産性',
    },
    {
        id: 'time_per_count',
        name: '時間/件',
        defaultUnit: '分/件',
        expression: 'B/A',
        variables: [
            { varId: 'A', label: '処理件数' },
            { varId: 'B', label: '作業時間（分）' },
        ],
        description: '1件あたりの処理時間（分）。対応の重さ・複雑さの指標。',
        category: '業務・生産性',
    },
    {
        id: 'utilization_rate',
        name: '稼働率',
        defaultUnit: '％',
        expression: 'A/B*100',
        variables: [
            { varId: 'A', label: '実稼働時間' },
            { varId: 'B', label: '所定時間（総時間）' },
        ],
        description: '全体の時間のうち実際に稼働に使われた割合。リソース効率の把握に。',
        category: '業務・生産性',
    },
    {
        id: 'completion_rate',
        name: '完了率',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: '全タスク数（予定数）' },
            { varId: 'B', label: '完了タスク数' },
        ],
        description: '計画したうち実際に完了した割合。進捗の全体把握に利用。',
        category: '業務・生産性',
    },

    // ─── 財務・コスト ───
    {
        id: 'gross_margin',
        name: '粗利率',
        defaultUnit: '％',
        expression: '(B-A)/B*100',
        variables: [
            { varId: 'A', label: '原価（コスト）' },
            { varId: 'B', label: '売上' },
        ],
        description: '売上から原価を引いた粗利の、売上に対する割合。事業の基本的な収益性指標。',
        category: '財務・コスト',
    },
    {
        id: 'labor_cost_rate',
        name: '人件費率',
        defaultUnit: '％',
        expression: 'A/B*100',
        variables: [
            { varId: 'A', label: '人件費' },
            { varId: 'B', label: '売上' },
        ],
        description: '売上に占める人件費の割合。業種によって適正値が異なる。',
        category: '財務・コスト',
    },

    // ─── コンテンツ・メール ───
    {
        id: 'open_rate',
        name: '開封率',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: '送信数' },
            { varId: 'B', label: '開封数' },
        ],
        description: 'メール・通知などを送ったうち開封された割合。件名・送信タイミングの良し悪しに。',
        category: 'コンテンツ・メール',
    },
    {
        id: 'response_rate',
        name: '応答率',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: 'コンタクト数（送信・架電など）' },
            { varId: 'B', label: '返信・応答数' },
        ],
        description: 'アクションに対して相手が反応した割合。営業・採用アプローチの効果測定に。',
        category: 'コンテンツ・メール',
    },
    {
        id: 'churn_rate',
        name: '離脱率',
        defaultUnit: '％',
        expression: 'B/A*100',
        variables: [
            { varId: 'A', label: '開始数（閲覧・利用・登録）' },
            { varId: 'B', label: '離脱数（未完了・解約）' },
        ],
        description: '途中で離脱したユーザーの割合。低いほどコンテンツや体験の質が高い。',
        category: 'コンテンツ・メール',
    },

    // ─── 汎用換算 ───
    {
        id: 'per_1000',
        name: '1000あたり換算',
        defaultUnit: '/1000',
        expression: 'A/B*1000',
        variables: [
            { varId: 'A', label: '対象値' },
            { varId: 'B', label: '母数' },
        ],
        description: '母数1000あたりの値に換算する汎用式。比較しやすい単位に揃えたいときに。',
        category: '汎用',
    },
    {
        id: 'ratio',
        name: '比率（A÷B）',
        defaultUnit: '倍',
        expression: 'A/B',
        variables: [
            { varId: 'A', label: '分子' },
            { varId: 'B', label: '分母' },
        ],
        description: 'AがBの何倍かを計算する最もシンプルな比率式。',
        category: '汎用',
    },
    {
        id: 'diff',
        name: '差分（A－B）',
        defaultUnit: '',
        expression: 'A-B',
        variables: [
            { varId: 'A', label: '基準値（今期・目標など）' },
            { varId: 'B', label: '比較値（前期・実績など）' },
        ],
        description: '2つの値の差。増減・過不足を数値で把握したいときに。',
        category: '汎用',
    },
    {
        id: 'improve_rate',
        name: '改善率',
        defaultUnit: '％',
        expression: '(A-B)/B*100',
        variables: [
            { varId: 'A', label: '当期値（Current）' },
            { varId: 'B', label: '前期値（Previous）' },
        ],
        description: '前期に対する今期の改善割合（％）。B=0の場合は算出不可となります。',
        category: '汎用',
    },
    {
        id: 'funnel_purchase_rate',
        name: 'ファネル購入率（3段階）',
        defaultUnit: '％',
        expression: 'C/A*100',
        variables: [
            { varId: 'A', label: 'インプレッション（表示）' },
            { varId: 'B', label: 'クリック数' },
            { varId: 'C', label: '購入数（コンバージョン）' },
        ],
        description: 'インプレッションから最終購入までの通過率。広告ファネル全体効率の把握に。',
        category: '広告・マーケティング',
    },
];

/** テンプレートのカテゴリ一覧 */
export const FORMULA_TEMPLATE_CATEGORIES = [
    ...new Set(FORMULA_TEMPLATES.map(t => t.category))
];
