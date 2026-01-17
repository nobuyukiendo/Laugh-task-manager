import React from 'react';
import { Card, Button } from '../components/ui';
import { ExternalLink, HelpCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LAST_UPDATED = '2026-01-17';

export const HelpPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                    <ArrowLeft size={20} />
                </Button>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <HelpCircle className="text-cyan-500" />
                    ヘルプ
                </h1>
            </div>

            <Card className="p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
                    このアプリについて
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    日々の詳細な作業時間を記録し、スプレッドシートやカレンダーと連携して管理するためのツールです。<br />
                    「計測」→「履歴確認」→「集計」という流れで日々の業務を可視化します。
                </p>
            </Card>

            <Card className="p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
                    基本操作
                </h2>

                <div className="space-y-4">
                    <div>
                        <h3 className="font-bold text-slate-700 dark:text-cyan-400 text-sm mb-1">⏱️ 計測画面</h3>
                        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1 pl-1">
                            <li>部門・作業種別・詳細作業を選択して「計測開始」ボタンでタイマーをスタートします。</li>
                            <li>作業が終わったら「停止」ボタンを押すと、自動的に履歴に保存されます。</li>
                            <li>「詳細作業テキスト生成」機能を使うと、社内メッセージ用の定型文を簡単に作成できます。</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-700 dark:text-cyan-400 text-sm mb-1">📝 履歴画面</h3>
                        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1 pl-1">
                            <li>保存された作業ログの一覧を確認・編集・削除できます。</li>
                            <li>日ごとの合計時間や、作業内容の修正もここで行います。</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-700 dark:text-cyan-400 text-sm mb-1">📅 カレンダー連携</h3>
                        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1 pl-1">
                            <li>設定画面からGoogleカレンダーと連携すると、作業ログをカレンダーに登録できます。</li>
                            <li><strong>有効期限</strong>：セキュリティのため、定期的に再ログインが必要です（期限切れ時はバナーでお知らせします）。</li>
                        </ul>
                    </div>
                </div>
            </Card>

            <Card className="p-6 space-y-4 bg-violet-50 dark:bg-violet-900/10 border-violet-100 dark:border-violet-800">
                <h2 className="text-lg font-bold text-violet-800 dark:text-violet-300 border-b border-violet-200 dark:border-violet-800 pb-2">
                    運用ルール
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    詳細な運用ルールや入力規則については、以下のスプレッドシートを確認してください。
                </p>
                <a
                    href="https://docs.google.com/spreadsheets/d/13wwS-ojLbPS5LMwqRQlGzj_y7zdXZvzt3Ik-7up2ys4/edit?gid=46327637#gid=46327637"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm shadow-violet-200 dark:shadow-none"
                >
                    <ExternalLink size={16} />
                    運用ルール（スプレッドシート）を開く
                </a>
            </Card>

            <div className="text-center text-xs text-slate-400 mt-8">
                最終更新：{LAST_UPDATED}
            </div>
        </div>
    );
};
