import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider } from './contexts/ThemeContext';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "682999477164-vqf5d4dvvnq1cdlluoo8ajh1718ihvsj.apps.googleusercontent.com";

if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    console.warn(
        "⚠️ VITE_GOOGLE_CLIENT_ID is not set. Using fallback Google Client ID.\n" +
        "For optimal security, please set the environment variable in GitHub Secrets."
    );
}

// Trelloリダイレクト時のURL修正
// Trelloは #/evaluation&token=... の形式でリダイレクトしてくるが、
// HashRouterは /evaluation&token=... を1つのパスとして認識してしまう
// これを #/evaluation?token=... に修正する
if (window.location.hash.includes('&token=')) {
    const fixedHash = window.location.hash.replace('&token=', '?token=');
    window.location.hash = fixedHash;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={clientId}>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </GoogleOAuthProvider>
    </React.StrictMode>,
)
