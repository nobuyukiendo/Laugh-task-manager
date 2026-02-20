import React, { useEffect, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Card, Button, Select, Label } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Database, Calendar, Globe } from 'lucide-react';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { googleDriveService } from '../services/googleDriveService';
import { importAllData } from '../utils/dbExportImport';

import { ThemeSettings } from '../components/ThemeSettings';

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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <div className="flex items-center justify-between">
                <h2
                    className="text-xl font-bold text-main-text flex items-center gap-2"
                    data-theme-role="text"
                >
                    <SettingsIcon
                        className="text-icon"
                        data-theme-role="icon"
                    />
                    設定
                </h2>
            </div>

            {/* Theme Settings */}
            <Card>
                <ThemeSettings />
            </Card>

            {/* General Settings */}
            <Card>
                <h2
                    className="text-lg font-semibold text-main-text mb-4 flex items-center gap-2"
                    data-theme-role="text"
                >
                    <Globe
                        size={20}
                        className="text-primary"
                        data-theme-role="primary"
                    />
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
                        <Label>計測終了後の画面</Label>
                        <Select
                            value={settings.afterMeasurement || 'stay'}
                            onChange={e => updateSettings({ afterMeasurement: e.target.value as 'stay' | 'navigate' })}
                        >
                            <option value="stay">計測画面に戻る (推奨)</option>
                            <option value="navigate">履歴へ移動して最新を表示</option>
                        </Select>
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
                        <h2
                            className="text-lg font-semibold text-main-text flex items-center gap-2"
                            data-theme-role="text"
                        >
                            <Database
                                size={20}
                                className="text-primary"
                                data-theme-role="primary"
                            />
                            マスタ管理
                        </h2>
                        <p className="text-sm text-sub-text" data-theme-role="subText">部門、作業種別、詳細作業の追加・編集を行います</p>
                    </div>
                    <Button variant="secondary" onClick={() => navigate('/master')}>
                        管理画面へ
                    </Button>
                </div>
            </Card>

            {/* Google Calendar Integration */}
            <Card className={settings.calendar.connected ? "border-l-4 border-l-green-500" : ""}>
                <h2
                    className="text-lg font-semibold text-main-text mb-4 flex items-center gap-2"
                    data-theme-role="text"
                >
                    <Calendar
                        size={20}
                        className="text-primary"
                        data-theme-role="primary"
                    />
                    Googleカレンダー連携
                </h2>

                <div className="space-y-4">
                    {!settings.calendar.connected ? (
                        <div className="flex flex-col gap-3">
                            <p
                                className="text-sm text-sub-text"
                                data-theme-role="subText"
                            >
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

                            {/* Backup Status */}
                            <div className="p-3 bg-surface rounded-md border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-sub-text mb-1" data-theme-role="subText">最終バックアップ (Google Drive)</div>
                                <div
                                    className="text-sm font-mono font-bold text-main-text"
                                    data-theme-role="text"
                                >
                                    {settings.calendar.lastBackupAt
                                        ? new Date(settings.calendar.lastBackupAt).toLocaleString()
                                        : 'まだ保存されていません'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="secondary" onClick={() => updateSettings({
                                    calendar: {
                                        ...settings.calendar,
                                        connected: false,
                                        accessToken: undefined,
                                        refreshToken: undefined,
                                        tokenExpiresAt: 0
                                    }
                                })}>
                                    連携解除
                                </Button>

                                <Button
                                    variant="secondary"
                                    className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                                    onClick={async () => {
                                        if (!settings.calendar.accessToken) return;
                                        if (!confirm('Google Driveに保存されているデータをロードします。\n現在のローカルデータはすべて上書きされます。\n\n本当にロードしますか？')) return;

                                        try {
                                            const file = await googleDriveService.findFile(settings.calendar.accessToken, 'laugh-task-manager-data.json');
                                            if (!file) {
                                                alert('Google Driveにバックアップファイルが見つかりませんでした。');
                                                return;
                                            }

                                            const json = await googleDriveService.downloadFile(settings.calendar.accessToken, file.id);
                                            await importAllData(json);

                                            alert('データの復元が完了しました。画面をリロードします。');
                                            window.location.reload();
                                        } catch (e) {
                                            console.error(e);
                                            alert('復元に失敗しました。');
                                        }
                                    }}
                                >
                                    Driveから復元
                                </Button>
                            </div>
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
