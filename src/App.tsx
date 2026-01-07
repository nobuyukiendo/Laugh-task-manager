// import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import { MasterProvider } from './contexts/MasterContext';
import { TimerProvider } from './contexts/TimerContext';
import { Layout } from './components/Layout';

import { MasterPage } from './pages/MasterPage';
import { TimerPage } from './pages/TimerPage';
import { TimelinePage } from './pages/TimelinePage';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { SearchPage } from './pages/SearchPage';

// Placeholder Pages - Will replace with real ones
// (Removed)


function App() {
    return (
        <SettingsProvider>
            <MasterProvider>
                <TimerProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/" element={<Layout />}>
                                <Route index element={<TimerPage />} />
                                <Route path="timeline" element={<TimelinePage />} />
                                <Route path="dashboard" element={<DashboardPage />} />
                                <Route path="search" element={<SearchPage />} />
                                <Route path="settings" element={<SettingsPage />} />
                                <Route path="master" element={<MasterPage />} />
                            </Route>
                        </Routes>
                    </BrowserRouter>
                </TimerProvider>
            </MasterProvider>
        </SettingsProvider>
    );
}

export default App;
