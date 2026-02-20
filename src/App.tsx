// import React from 'react';
import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import { MasterProvider } from './contexts/MasterContext';
import { TimerProvider } from './contexts/TimerContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';

import { MasterPage } from './pages/MasterPage';
import { TimerPage } from './pages/TimerPage';
import { TimelinePage } from './pages/TimelinePage';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { SearchPage } from './pages/SearchPage';
import { HelpPage } from './pages/HelpPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { LinksPage } from './pages/LinksPage';
import { MemoPage } from './pages/MemoPage';
import { SchedulePage } from './pages/SchedulePage';

// Placeholder Pages - Will replace with real ones
// (Removed)


function App() {
    // 絵文字マスタの初期化
    useEffect(() => {
        const initializeMasters = async () => {
            // チェックリスト用
            const emojiCount = await db.emojiMasters.count();
            if (emojiCount === 0) {
                await db.emojiMasters.bulkAdd([
                    { id: uuidv4(), emoji: '✅', order: 1 },
                    { id: uuidv4(), emoji: '👀', order: 2 },
                    { id: uuidv4(), emoji: '🚧', order: 3 },
                ]);
            }

            // リンク用
            const linkIconCount = await db.linkIcons.count();
            if (linkIconCount === 0) {
                const defaultIcons = ['🔗', '🏠', '📅', '📊', '📝', '📂', '💡', '🚀', '🛠️', '⚙️', '✨', '🔥'];
                await db.linkIcons.bulkAdd(
                    defaultIcons.map((emoji, i) => ({
                        id: uuidv4(),
                        emoji,
                        order: i + 1
                    }))
                );
                console.log('Default link icons initialized');
            }
        };
        initializeMasters();
    }, []);
    return (
        <SettingsProvider>
            <ThemeProvider>
                <MasterProvider>
                    <TimerProvider>
                        <HashRouter>
                            <Routes>
                                {/* 全画面ページ（Layout外） */}
                                <Route path="/evaluation" element={<EvaluationPage />} />

                                {/* 通常ページ（Layout内） */}
                                <Route path="/" element={<Layout />}>
                                    <Route index element={<TimerPage />} />
                                    <Route path="memo" element={<MemoPage />} />
                                    <Route path="schedule" element={<SchedulePage />} />
                                    <Route path="timeline" element={<TimelinePage />} />
                                    <Route path="dashboard" element={<DashboardPage />} />
                                    <Route path="search" element={<SearchPage />} />
                                    <Route path="settings" element={<SettingsPage />} />
                                    <Route path="master" element={<MasterPage />} />
                                    <Route path="links" element={<LinksPage />} />
                                    <Route path="help" element={<HelpPage />} />
                                </Route>
                            </Routes>
                        </HashRouter>
                    </TimerProvider>
                </MasterProvider>
            </ThemeProvider>
        </SettingsProvider>
    );
}

export default App;
