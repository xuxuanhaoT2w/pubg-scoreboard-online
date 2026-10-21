import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Copy, Crosshair, Loader2, Radio } from 'lucide-react';
import './index.css';
import { RoomStoreProvider, useAppStore } from './store/app-store';
import { NavBar, type TabKey } from './components/nav-bar';
import { RecordPage } from './pages/record-page';
import { HistoryPage } from './pages/history-page';
import { MatchesPage } from './pages/matches-page';
import { SettingsPage } from './pages/settings-page';
import { RoomManagerPage } from './pages/room-manager-page';
import { LobbyPage } from './pages/lobby-page';
import { ToastProvider } from './components/toast';
import { ConfirmProvider } from './components/confirm-dialog';
import { useToast } from './components/toast';

function App() {
  const { status, joinRoom, ready, room, currentMatch, games, onlinePlayerIds, onlineTemporaryCount } = useAppStore();
  const toast = useToast();
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
      <div className="border-b border-line bg-panel-2/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-xs sm:flex-nowrap sm:px-6">
          <span className="rounded bg-primary/15 px-2 py-1 font-semibold text-primary">当前场次</span>
          <span className="font-bold text-ink">{currentMatch?.name ?? '未创建场次'}</span>
          <span className="hidden text-ink-muted sm:inline">第 {games.length + 1} 局待录入</span>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded border border-line bg-panel px-2 py-1 font-display text-[11px] font-bold tracking-widest text-primary transition-colors hover:border-primary/60"
            title="点击复制房间码"
            onClick={async () => {
              if (!room?.join_code) return;
              try {
                await navigator.clipboard.writeText(room.join_code);
                toast.success(`房间码 ${room.join_code} 已复制`);
              } catch {
                toast.error('复制失败，请前往房间页查看房间码');
              }
            }}
          >
            <Copy size={12} /> {room?.join_code}
          </button>
          <span className={`ml-auto flex shrink-0 items-center gap-1.5 font-semibold ${onlinePlayerIds.length + onlineTemporaryCount > 0 ? 'text-gain' : 'text-ink-muted'}`}><Radio size={13} className={onlinePlayerIds.length + onlineTemporaryCount > 0 ? 'animate-pulse' : ''} /><span className="hidden sm:inline">实时协作中</span><span className="sm:hidden">协作</span></span>
        </div>
      </div>
      <main className="mx-auto w-full max-w-6xl">
        {tab === 'record' && <RecordPage />}
        {tab === 'history' && <HistoryPage onNavigate={setTab} />}
        {tab === 'matches' && <MatchesPage />}
        {tab === 'settings' && <SettingsPage onNavigate={setTab} />}
        {tab === 'room-manager' && <RoomManagerPage onNavigate={setTab} />}
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

// 早期版本的离线缓存可能让设备长期停留在旧代码；上线多人协作后改为始终使用网络最新版本。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.getRegistrations().then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())),
    );
    if ('caches' in window) {
      void caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('pubg-scoreboard')).map((key) => caches.delete(key)),
      ));
    }
  });
}
