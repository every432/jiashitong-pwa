import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App/></React.StrictMode>
);
// 开发期间不启用离线缓存，防止 VS Code 改完代码却显示旧页面。
// 生产部署后启用网络优先的 Service Worker，支持已访问页面离线打开。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(err=>console.warn('PWA 离线缓存注册失败',err));
  });
}
