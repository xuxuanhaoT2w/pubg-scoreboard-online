import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Crosshair, Loader2 } from 'lucide-react';
import './index.css';
import { RoomStoreProvider, useAppStore } from './store/app-store';
import { NavBar, type TabKey } from './components/nav-bar';
import { LeaderboardPage } from './pages/leaderboard-page';
import { RecordPage } from './pages/record-page';
import { HistoryPage } from './pages/history-page';
import { SettingsPage } from './pages/settings-page';
import { LobbyPage } from './pages/lobby-page';
import { ToastProvider } from './components/toast';
import { ConfirmProvider } from './components/confirm-dialog';
import { IdentityBar } from './components/identity-bar';

function App() {
  const { status, joinRoom, ready } = useAppStore();
  const [tab, setTab] = useState<TabKey>('record');

  // 支持通过分享链接自动加入：?join=房间码
  useEffect(() => {
    if (status !== 'no-room') return;
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join') || params.get('c');
    if (joinCode) {
      void joinRoom(joinCode).catch(() => {
        /* 加入失败时停留在入口页，由页面展示错误 */
      });
    }
  }, [status, joinRoom]);

  if (status === 'checking' || status === 'no-room') {
    if (status === 'checking') {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 text-ink-muted">
          <Crosshair size={28} className="animate-spin text-primary" />
          <p className="text-sm">正在连接计分服务…</p>
        </div>
      );
    }
    return <LobbyPage />;
  }

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 text-ink-muted">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar active={tab} onChange={setTab} />
      <IdentityBar />
      <main className="mx-auto w-full max-w-6xl">
        {tab === 'leaderboard' && <LeaderboardPage onNavigate={setTab} />}
        {tab === 'record' && <RecordPage />}
        {tab === 'history' && <HistoryPage onNavigate={setTab} />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <RoomStoreProvider>
    <ToastProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ToastProvider>
  </RoomStoreProvider>,
);

// PWA Service Worker（仅生产环境注册，离线 App Shell）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW 注册失败不影响使用 */
    });
  });
}
