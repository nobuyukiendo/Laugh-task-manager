import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Plus, Trash2, Smile, ChevronDown, ChevronUp, Settings2, AlertTriangle, Check, Pencil, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const LinksPage: React.FC = () => {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [icon, setIcon] = useState('🔗');
    const [isFormExpanded, setIsFormExpanded] = useState(() => {
        const saved = localStorage.getItem('links_form_expanded');
        return saved === null ? true : saved === 'true';
    });
    const [showIconManager, setShowIconManager] = useState(false);
    const [newMasterIcon, setNewMasterIcon] = useState('');

    // 状態管理
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const formRef = useRef<HTMLDivElement>(null);

    // リンクとアイコンマスタを取得
    const links = useLiveQuery(() => db.links.orderBy('order').toArray(), []);
    const linkIcons = useLiveQuery(() => db.linkIcons.orderBy('order').toArray(), []);

    // フォームの開閉状態を保存
    useEffect(() => {
        localStorage.setItem('links_form_expanded', String(isFormExpanded));
    }, [isFormExpanded]);

    // フォームをクリア
    const clearForm = () => {
        setName('');
        setUrl('');
        setIcon('🔗');
        setEditingId(null);
    };

    // 編集を開始
    const startEdit = (link: any) => {
        setEditingId(link.id);
        setName(link.name);
        setUrl(link.url);
        setIcon(link.icon || '🔗');
        setIsFormExpanded(true);
        // フォームへスクロール
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    // 作成または更新を実行
    const handleSubmit = async () => {
        if (!name.trim() || !url.trim()) return;

        if (editingId) {
            // 更新
            try {
                await db.links.update(editingId, {
                    name: name.trim(),
                    url: url.trim(),
                    icon: icon
                });
                clearForm();
            } catch (error) {
                console.error('Update failed:', error);
                alert('更新に失敗しました。');
            }
        } else {
            // 新規作成
            const maxOrder = links?.reduce((max, link) => Math.max(max, link.order), 0) || 0;
            await db.links.add({
                id: uuidv4(),
                name: name.trim(),
                url: url.trim(),
                icon: icon,
                order: maxOrder + 1,
            });
            clearForm();
        }
    };

    // リンクを削除
    const executeDelete = async (id: string) => {
        try {
            await db.links.delete(id);
            setConfirmingId(null);
            if (editingId === id) clearForm();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('削除に失敗しました。');
        }
    };

    // アイコンマスタに追加
    const handleAddMasterIcon = async () => {
        if (!newMasterIcon.trim()) return;
        const maxOrder = linkIcons?.reduce((max, i) => Math.max(max, i.order), 0) || 0;
        await db.linkIcons.add({
            id: uuidv4(),
            emoji: newMasterIcon.trim(),
            order: maxOrder + 1
        });
        setNewMasterIcon('');
    };

    // アイコンマスタから削除
    const handleDeleteMasterIcon = async (id: string) => {
        await db.linkIcons.delete(id);
    };

    // 順番入れ替え
    const moveLink = async (id: string, currentOrder: number, direction: 'up' | 'down') => {
        if (!links) return;
        const index = links.findIndex(l => l.id === id);
        if (direction === 'up' && index > 0) {
            const target = links[index - 1];
            await db.links.update(id, { order: target.order });
            await db.links.update(target.id, { order: currentOrder });
        } else if (direction === 'down' && index < links.length - 1) {
            const target = links[index + 1];
            await db.links.update(id, { order: target.order });
            await db.links.update(target.id, { order: currentOrder });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div>
                <h1 className="text-3xl font-black font-['Zen_Maru_Gothic'] flex items-center gap-3 text-slate-900 dark:text-white">
                    <ExternalLink className="text-cyan-500" size={32} />
                    リンク管理
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2 font-medium">
                    よく使うサイトを整理して、ワンクリックでアクセス。
                </p>
            </div>

            {/* リンク入力フォーム (新規/編集) */}
            <section
                ref={formRef}
                className={`bg-white dark:bg-slate-800 rounded-[2rem] border shadow-xl overflow-hidden transition-all border-b-4 ${editingId ? 'border-amber-500 border-slate-200 dark:border-slate-700' : 'border-cyan-500 border-slate-200 dark:border-slate-700'}`}
            >
                <button
                    onClick={() => setIsFormExpanded(!isFormExpanded)}
                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-lg ${editingId ? 'bg-amber-500 shadow-amber-500/30' : 'bg-cyan-500 shadow-cyan-500/30'}`}>
                            {editingId ? <Pencil size={20} /> : <Plus size={24} />}
                        </div>
                        <span className="text-lg font-bold font-['Zen_Maru_Gothic'] text-slate-900 dark:text-white">
                            {editingId ? 'リンクを編集する' : '新しいリンクを登録'}
                        </span>
                        {editingId && (
                            <span className="text-xs font-black bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                                編集モード
                            </span>
                        )}
                    </div>
                    {isFormExpanded ? <ChevronUp size={24} className="text-slate-400" /> : <ChevronDown size={24} className="text-slate-400" />}
                </button>

                {isFormExpanded && (
                    <div className="p-8 pt-0 border-t border-slate-100 dark:border-slate-700/50 animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                            <div className="space-y-6">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                            アイコン
                                        </label>
                                        <button
                                            onClick={() => setShowIconManager(!showIconManager)}
                                            className="text-xs font-bold text-cyan-500 flex items-center gap-1 hover:underline"
                                        >
                                            <Settings2 size={12} />
                                            {showIconManager ? '閉じる' : '追加・管理'}
                                        </button>
                                    </div>

                                    {showIconManager && (
                                        <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex gap-2 mb-4">
                                                <input
                                                    type="text"
                                                    value={newMasterIcon}
                                                    onChange={(e) => setNewMasterIcon(e.target.value)}
                                                    placeholder="絵文字"
                                                    className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                                    maxLength={2}
                                                />
                                                <button
                                                    onClick={handleAddMasterIcon}
                                                    className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                                                >
                                                    追加
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {linkIcons?.map(i => (
                                                    <div key={i.id} className="group relative">
                                                        <span className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xl">
                                                            {i.emoji}
                                                        </span>
                                                        <button
                                                            onClick={() => handleDeleteMasterIcon(i.id)}
                                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Plus size={12} className="rotate-45" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-52 overflow-y-auto">
                                        {linkIcons?.map(e => (
                                            <button
                                                key={e.id}
                                                onClick={() => setIcon(e.emoji)}
                                                className={`w-12 h-12 text-2xl flex items-center justify-center rounded-xl transition-all ${icon === e.emoji ? 'bg-cyan-500 text-white scale-110 shadow-lg shadow-cyan-500/30' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent shadow-sm'}`}
                                            >
                                                {e.emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-widest">
                                        ボタンの名前
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="例: 社内ポータル"
                                        className="w-full px-5 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col space-y-6">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-widest">
                                        リンク先 URL
                                    </label>
                                    <textarea
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://example.com"
                                        className="w-full h-full min-h-[160px] px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-700 dark:text-slate-300 font-mono text-sm leading-relaxed focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all resize-none"
                                    />
                                </div>
                                <div className="flex gap-4">
                                    {editingId && (
                                        <button
                                            onClick={clearForm}
                                            className="px-6 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center gap-2"
                                        >
                                            <X size={20} /> キャンセル
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!name.trim() || !url.trim()}
                                        className={`flex-1 py-5 text-white text-xl font-black rounded-2xl transition-all shadow-xl disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 ${editingId ? 'bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/30' : 'bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-cyan-500/30'}`}
                                    >
                                        {editingId ? <Check size={32} /> : <Plus size={32} />}
                                        {editingId ? '変更を保存する' : 'リンクを作成する'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* リンク一覧 */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-4">
                    <h2 className="text-2xl font-black font-['Zen_Maru_Gothic'] text-slate-900 dark:text-white flex items-center gap-3">
                        登録済みのリンク
                        <span className="text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                            {links?.length || 0}
                        </span>
                    </h2>
                </div>

                {links && links.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {links.map((link, index) => (
                            <div
                                key={link.id}
                                className={`group relative flex flex-col bg-white dark:bg-slate-800 border rounded-[2.5rem] shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden ${editingId === link.id ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-slate-700'}`}
                            >
                                {/* メインリンクエリア */}
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-6 p-7 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                                >
                                    <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] text-5xl shadow-inner border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform">
                                        {link.icon || '🔗'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xl font-black text-slate-900 dark:text-white truncate mb-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                            {link.name}
                                        </div>
                                        <div className="text-xs font-mono text-slate-400 dark:text-slate-500 truncate opacity-70">
                                            {link.url}
                                        </div>
                                    </div>
                                </a>

                                {/* コントロールバー */}
                                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => moveLink(link.id, link.order, 'up')}
                                            disabled={index === 0}
                                            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-cyan-500 disabled:opacity-30 transition-colors shadow-sm"
                                        >
                                            <ChevronUp size={20} />
                                        </button>
                                        <button
                                            onClick={() => moveLink(link.id, link.order, 'down')}
                                            disabled={index === links.length - 1}
                                            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-cyan-500 disabled:opacity-30 transition-colors shadow-sm"
                                        >
                                            <ChevronDown size={20} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => startEdit(link)}
                                            className={`p-3 transition-all hover:scale-110 active:scale-95 ${editingId === link.id ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-cyan-500'}`}
                                            title="編集"
                                        >
                                            <Pencil size={22} />
                                        </button>

                                        {confirmingId === link.id ? (
                                            <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                                                <button
                                                    onClick={() => executeDelete(link.id)}
                                                    className="px-4 py-2 bg-red-500 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/20 flex items-center gap-1 hover:bg-red-600 transition-colors"
                                                >
                                                    <Check size={14} /> はい
                                                </button>
                                                <button
                                                    onClick={() => setConfirmingId(null)}
                                                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                                >
                                                    いいえ
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmingId(link.id)}
                                                className="p-3 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-500 transition-all hover:scale-110 active:scale-95"
                                                title="削除"
                                            >
                                                <Trash2 size={22} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-32 bg-slate-50/50 dark:bg-slate-800/10 rounded-[3rem] border-4 border-dashed border-slate-200 dark:border-slate-800 transition-all">
                        <Smile size={100} className="mx-auto text-slate-200 dark:text-slate-800 mb-8" />
                        <h3 className="text-3xl font-black font-['Zen_Maru_Gothic'] text-slate-400 dark:text-slate-700">
                            リンクが登録されていません
                        </h3>
                        <p className="mt-4 text-slate-400 dark:text-slate-600 font-bold max-w-sm mx-auto text-lg">
                            よく使うサイトを登録して、<br />ブックマークよりも快適な操作を。
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
