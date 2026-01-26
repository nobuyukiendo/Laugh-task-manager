import React, { useState, useEffect } from 'react';
import { Upload, ExternalLink, Copy, Image as ImageIcon, File } from 'lucide-react';
import type { TrelloAttachment } from '../../types/trello-types';
import { getTrelloToken } from '../../lib/trello-auth';
import { getCardAttachments, createCardAttachment } from '../../lib/trello-api';
import { format } from 'date-fns';

interface AttachmentManagerProps {
    cardId: string | null;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({ cardId }) => {
    const [attachments, setAttachments] = useState<TrelloAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCopyToast, setShowCopyToast] = useState(false);

    useEffect(() => {
        if (cardId) {
            loadAttachments();
        }
    }, [cardId]);

    const loadAttachments = async () => {
        if (!cardId) return;

        setIsLoading(true);
        setError(null);

        try {
            const token = getTrelloToken();
            if (!token) {
                setError('Trelloと連携してください');
                setIsLoading(false);
                return;
            }

            const atts = await getCardAttachments(cardId, token);
            setAttachments(atts);
        } catch (err: any) {
            setError(err.message || '添付ファイルの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !cardId) return;

        // png/jpgのみ許可
        if (!file.type.match(/^image\/(png|jpeg)$/)) {
            setError('png/jpg形式の画像のみアップロードできます');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const token = getTrelloToken();
            if (!token) {
                setError('Trelloと連携してください');
                setIsUploading(false);
                return;
            }

            await createCardAttachment(cardId, file, token);
            // アップロード後、一覧を再取得
            await loadAttachments();
        } catch (err: any) {
            setError(err.message || 'アップロードに失敗しました');
        } finally {
            setIsUploading(false);
            // inputをリセット
            event.target.value = '';
        }
    };

    const copyToClipboard = (url: string) => {
        navigator.clipboard.writeText(url);
        setShowCopyToast(true);
        setTimeout(() => setShowCopyToast(false), 3000);
    };

    if (!cardId) {
        return (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
                カードを読み込んでください
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    添付ファイル管理
                </h3>
                <label className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-2">
                    <Upload size={16} />
                    {isUploading ? 'アップロード中...' : 'スクショ添付'}
                    <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="hidden"
                    />
                </label>
            </div>

            {/* エラー表示 */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* 添付一覧 */}
            {isLoading ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    読み込み中...
                </div>
            ) : attachments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    添付ファイルがありません
                </div>
            ) : (
                <div className="space-y-3 max-h-96 overflow-auto">
                    {attachments.map((att) => (
                        <AttachmentCard
                            key={att.id}
                            attachment={att}
                            onCopyLink={() => copyToClipboard(att.url)}
                        />
                    ))}
                </div>
            )}

            {/* コピー成功トースト */}
            {showCopyToast && (
                <div className="fixed bottom-4 right-4 px-4 py-3 bg-green-500 text-white rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Copy size={16} />
                    URLをコピーしました
                </div>
            )}
        </div>
    );
};

interface AttachmentCardProps {
    attachment: TrelloAttachment;
    onCopyLink: () => void;
}

const AttachmentCard: React.FC<AttachmentCardProps> = ({ attachment, onCopyLink }) => {
    const isImage = attachment.mimeType?.startsWith('image/');
    const thumbnailUrl = attachment.previews?.[0]?.url;

    return (
        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-cyan-300 dark:hover:border-cyan-700 transition-all">
            <div className="flex gap-3">
                {/* サムネイル */}
                <div className="flex-shrink-0 w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                    {isImage && thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt={attachment.name}
                            className="w-full h-full object-cover"
                        />
                    ) : isImage ? (
                        <ImageIcon size={24} className="text-slate-400" />
                    ) : (
                        <File size={24} className="text-slate-400" />
                    )}
                </div>

                {/* 情報 */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {attachment.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {format(new Date(attachment.date), 'yyyy/MM/dd HH:mm')}
                    </p>
                    {attachment.bytes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {(attachment.bytes / 1024).toFixed(1)} KB
                        </p>
                    )}
                </div>

                {/* アクション */}
                <div className="flex flex-col gap-2">
                    <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
                        title="開く"
                    >
                        <ExternalLink size={16} />
                    </a>
                    <button
                        onClick={onCopyLink}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="リンクコピー"
                    >
                        <Copy size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
