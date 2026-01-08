import React, { useEffect, useState } from 'react';
import { WorkLog } from '../db';
import { Button, Card } from './ui';
import { StopCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ActiveTimerProps {
    log: WorkLog;
    onStop: () => void;
}

export const ActiveTimer: React.FC<ActiveTimerProps> = ({ log, onStop }) => {
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setDuration(Math.floor((Date.now() - log.startAt) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [log.startAt]);

    const formatDuration = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Card className="border-t-4 border-t-pink-500 animate-pulse-subtle bg-white dark:bg-slate-900 border-pink-100 dark:border-pink-900/20 shadow-xl shadow-pink-100 dark:shadow-none">
            <div className="text-center space-y-4 py-8">
                <div className="text-slate-500 dark:text-slate-400 font-bold tracking-widest text-sm uppercase">計測中</div>
                <div className="text-6xl font-black font-mono tracking-tighter text-slate-800 dark:text-slate-100 tabular-nums">
                    {formatDuration(duration)}
                </div>
                <div className="text-slate-400 dark:text-slate-500 text-sm font-['Zen_Maru_Gothic']">
                    開始時刻 {format(log.startAt, 'HH:mm')}
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div></div>

                <Button
                    onClick={onStop}
                    className="w-full h-16 text-xl rounded-2xl bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                >
                    <StopCircle className="mr-2" /> 終了
                </Button>
            </div>
        </Card>
    );
};
