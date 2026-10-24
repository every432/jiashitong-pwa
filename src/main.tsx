import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import PwaUpdates from './pwa/PwaUpdates';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App/><PwaUpdates/></React.StrictMode>
);
