import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider } from './contexts/ThemeContext';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";

if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    console.error(
        "⚠️ VITE_GOOGLE_CLIENT_ID is not set. Google Calendar integration will not work.\n" +
        "Please set the environment variable in .env file for local development,\n" +
        "or in GitHub Secrets for production deployment."
    );
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
