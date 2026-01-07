import React, { useState } from 'react';
import { Card, Button, Input } from '../components/ui';
import { db, WorkLog } from '../db';
import { Search as SearchIcon } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useSettings } from '../contexts/SettingsContext';
import { useMaster } from '../contexts/MasterContext';

export const SearchPage: React.FC = () => {
    const { settings } = useSettings();
    const { departments, workTypes, detailTasks } = useMaster();
    const tz = settings?.timezone || 'UTC';
    const [keyword, setKeyword] = useState('');
    const [results, setResults] = useState<WorkLog[]>([]);
    const [searched, setSearched] = useState(false);

    const handleSearch = async () => {
        if (!keyword.trim()) return;

        // Basic keyword search on Note field
        // For a real app, would index more fields or scan multiple.
        const r = await db.workLogs
            .filter(l => (l.note || '').includes(keyword))
            .reverse()
            .sortBy('startAt');

        setResults(r);
        setSearched(true);
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <SearchIcon className="text-cyan-400" />
                    ログ検索
                </h1>
            </div>

            <Card>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Input
                            placeholder="キーワード (メモ)..."
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <Button onClick={handleSearch}><SearchIcon size={20} /></Button>
                </div>
            </Card>

            <div className="space-y-3">
                {searched && results.length === 0 && (
                    <div className="text-center py-8 text-slate-500">見つかりませんでした</div>
                )}

                {results.map(log => (
                    <Card key={log.id} className="p-4 hover:bg-slate-800/80 transition-colors">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-1">
                                    {formatInTimeZone(log.startAt, tz, 'yyyy-MM-dd HH:mm')}
                                    {log.endAt && ` - ${formatInTimeZone(log.endAt, tz, 'HH:mm')} `}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-slate-100">
                                        {departments.find(d => d.id === log.departmentId)?.name || 'Unknown'}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {workTypes.find(w => w.id === log.workTypeId)?.name}
                                    </span>
                                </div>
                                <div className="flex gap-1 mt-1">
                                    {log.detailTaskIds.map(did => (
                                        <span key={did} className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] text-slate-600 dark:text-slate-300">
                                            {detailTasks.find(dt => dt.id === did)?.name || did}
                                        </span>
                                    ))}
                                </div>
                                {log.note && <div className="mt-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 p-2 rounded">{log.note}</div>}
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                                    {((log.durationSec || 0) / 60).toFixed(0)} <span className="text-xs font-sans text-slate-400">min</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};
