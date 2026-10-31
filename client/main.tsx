import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import NextApp from './NextApp';
import './styles.css';

const Workspace = window.location.pathname.replace(/\/$/, '') === '/next' ? NextApp : App;
createRoot(document.getElementById('root')!).render(<React.StrictMode><Workspace /></React.StrictMode>);
