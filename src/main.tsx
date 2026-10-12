import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DebugConsole from './DebugConsole';
import { ThemeProvider } from './theme';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ThemeProvider>{window.location.hash === '#debug' ? <DebugConsole /> : <App />}</ThemeProvider></React.StrictMode>,
);
