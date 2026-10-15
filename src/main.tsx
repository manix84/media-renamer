import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DebugConsole from './DebugConsole';
import { ThemeProvider } from './theme';
import { I18nProvider } from './i18n';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><I18nProvider><ThemeProvider>{window.location.hash === '#debug' ? <DebugConsole /> : <App />}</ThemeProvider></I18nProvider></React.StrictMode>,
);
