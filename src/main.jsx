import React from 'react';
import ReactDOM from 'react-dom/client';
import { initFirebase } from './lib/firebase';
import App from './components/App';
import AppErrorBoundary from './components/AppErrorBoundary';
import './index.css';

initFirebase();

const rootEl = document.getElementById('root');
if (rootEl) {
  const app = (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
  ReactDOM.createRoot(rootEl).render(app);
}
