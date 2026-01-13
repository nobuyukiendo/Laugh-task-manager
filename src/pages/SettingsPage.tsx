import React, { useEffect, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Card, Button, Select, Label } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Database, Calendar, Globe } from 'lucide-react';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';

export const SettingsPage: React.FC = () => {
    const { settings, updateSettings, isLoading } = useSettings();
    const navigate = useNavigate();
    const { login } = useGoogleCalendar();
    const [timezones, setTimezones] = useState<string[]>([]);

    useEffect(() => {
        // Chrome/Edge/FF support
        if (typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf) {
            try {
                setTimezones((Intl as any).supportedValuesOf('timeZone'));
            } catch (e) {
                console.warn("TZ list not supported");
                setTimezones(['Asia/Tokyo', 'America/New_York', 'Europe/London', 'UTC']);
            }
        } else {
            setTimezones(['Asia/Tokyo', 'UTC']);
        }
    }, []);

    if (isLoading || !settings) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <SettingsIcon className="text-cyan-500 dark:text-cyan-400" />
                    設定
                </h1>
            </div>

            {/* General Settings */}
            <Card>
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <Globe size={20} />
                    一般設定
                </h2>

                <div className="grid gap-4">
                    <div>
                        <Label>タイムゾーン</Label>
                        <Select
                            value={settings.timezone}
                            onChange={(e) => updateSettings({ timezone: e.target.value })}
                        >
                            {timezones.map(tz => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                        </Select>
                        <p className="text-xs text-slate-500 mt-1">
                            ※ 表示・集計・カレンダー登録はこのタイムゾーン基準で行われます。
                        </p>
                    </div>

                    <div>
                        <Label>時間の丸め (分)</Label>
                        <Select
                            value={settings.rounding === 0 ? 'none' : settings.rounding}
                            onChange={e => updateSettings({ rounding: e.target.value === 'none' ? 0 : Number(e.target.value) })}
                        >
                            <option value="none">なし (正確に記録)</option>
                            <option value={1}>1分単位</option>
                            <option value={5}>5分単位</option>
                            <option value={10}>10分単位</option>
                            <option value={15}>15分単位</option>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* Master Data Management */}
            <Card className="border-l-4 border-l-purple-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Database size={20} />
                            マスタ管理
                        </h2>
                        <p className="text-sm text-slate-400">部門、作業種別、詳細作業の追加・編集を行います</p>
                    </div>
                    <Button variant="secondary" onClick={() => navigate('/master')}>
                        管理画面へ
                    </Button>
                </div>
            </Card>

            {/* Google Calendar Integration */}
            <Card className={settings.calendar.connected ? "border-l-4 border-l-green-500" : ""}>
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <Calendar size={20} />
                    Googleカレンダー連携
                </h2>

                <div className="space-y-4">
                    {!settings.calendar.connected ? (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm text-slate-400">
                                Googleアカウントと連携すると、完了した作業ログを自動でカレンダーに登録できます。
                            </p>
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-700 dark:text-amber-300">
                                ※Googleの仕様上、セキュリティ保護のため連携は約1時間で自動的に解除されます。転記やインポートを行う直前に接続してください。
                            </div>
                            <Button onClick={() => login()}>
                                Googleアカウントを接続
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="p-3 bg-green-900/20 text-green-400 rounded-md text-sm">
                                ✓ 接続済み
                            </div>
                            <Button variant="secondary" onClick={() => updateSettings({ calendar: { ...settings.calendar, connected: false } })}>
                                解除
                            </Button>
                        </div>
                    )}
                </div>
            </Card>

            <div className="text-center text-xs text-slate-600 pt-8">
                ラフタスク管理表 v0.1.1
            </div>
        </div>
    );
};
