import { useState } from 'react';
import { Crosshair, Loader2, LogIn, Plus, RefreshCw, Share2, Users, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../store/app-store';

export function LobbyPage() {
  const { status, error, createRoom, joinRoom } = useAppStore();
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [roomName, setRoomName] = useState('开黑计分板');
  const [seeds, setSeeds] = useState<string[]>(['阿杰', '老K', '猴子', '狗子']);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const serviceDown = status === 'no-room' && error !== null;

  const handleCreate = async () => {
    setBusy(true);
    setLocalErr(null);
    try {
      await createRoom(roomName, seeds.map((s) => s.trim()).filter(Boolean));
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setBusy(true);
    setLocalErr(null);
    try {
      await joinRoom(code);
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : '加入失败');
    } finally {
      setBusy(false);
    }
  };

  const setSeed = (i: number, v: string) => {
    setSeeds((prev) => prev.map((s, idx) => (idx === i ? v : s)));
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 py-10">
      {/* Logo */}
      <div className="tac-chip mb-5 flex h-16 w-16 items-center justify-center">
        <Crosshair size={34} className="text-primary" />
      </div>
      <h1 className="font-display text-3xl font-bold tracking-wider">开黑计分板</h1>
      <p className="mt-2 text-center text-sm text-ink-muted">
        PUBG 固定车队 · 击杀分 + 吃鸡分 · 每局零和
      </p>
      <div
        className={`mt-3 flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${
          serviceDown
            ? 'border-loss/40 text-loss'
            : 'border-line bg-panel-2 text-gain'
        }`}
      >
        {serviceDown ? <WifiOff size={12} /> : <Wifi size={12} />}
        {serviceDown ? '实时同步服务不可用' : '实时多人同步已就绪'}
      </div>

      {serviceDown && (
        <div className="tac-card mt-5 w-full border-loss/30 px-4 py-3 text-sm text-loss">
          {error}。请稍后重试，或在 Coze 平台开通 Supabase 后刷新。
        </div>
      )}

      <div className="mt-8 w-full space-y-3">
        {mode === 'menu' && (
          <>
            <button
              type="button"
              className="tac-btn tac-btn-primary h-12 w-full"
              disabled={serviceDown}
              onClick={() => setMode('create')}
            >
              <Plus size={18} /> 创建车队房间
            </button>
            <button
              type="button"
              className="tac-btn h-12 w-full"
              disabled={serviceDown}
              onClick={() => setMode('join')}
            >
              <LogIn size={18} /> 输入房间码加入
            </button>
            <p className="flex items-start gap-1.5 pt-2 text-center text-[11px] leading-relaxed text-ink-muted">
              <Share2 size={12} className="mt-0.5 shrink-0" />
              建房后把链接或 6 位房间码发给队友，大家进同一房间，各自录击杀、网页实时同步。
            </p>
          </>
        )}

        {mode === 'create' && (
          <div className="tac-card space-y-3 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-muted">房间名称</label>
              <input
                className="tac-input h-11"
                value={roomName}
                maxLength={40}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="例如：周五晚开黑"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                <Users size={13} /> 预置队员（可稍后在设置里改名/增删）
              </label>
              <div className="grid grid-cols-2 gap-2">
                {seeds.map((s, i) => (
                  <input
                    key={i}
                    className="tac-input h-10 text-sm"
                    value={s}
                    maxLength={12}
                    onChange={(e) => setSeed(i, e.target.value)}
                    placeholder={`队员 ${i + 1}`}
                  />
                ))}
              </div>
            </div>
            {localErr && <p className="text-sm text-loss">{localErr}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="tac-btn h-11 flex-1"
                disabled={busy}
                onClick={() => setMode('menu')}
              >
                返回
              </button>
              <button
                type="button"
                className="tac-btn tac-btn-primary h-11 flex-[2] disabled:opacity-60"
                disabled={busy}
                onClick={handleCreate}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                创建并进入
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="tac-card space-y-3 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-muted">
                输入队友分享的 6 位房间码
              </label>
              <input
                className="tac-input h-12 text-center font-display text-2xl uppercase tracking-[0.5em]"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC234"
                autoFocus
              />
            </div>
            {localErr && <p className="text-sm text-loss">{localErr}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="tac-btn h-11 flex-1"
                disabled={busy}
                onClick={() => setMode('menu')}
              >
                返回
              </button>
              <button
                type="button"
                className="tac-btn tac-btn-primary h-11 flex-[2] disabled:opacity-60"
                disabled={busy || code.trim().length < 4}
                onClick={handleJoin}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                加入房间
              </button>
            </div>
          </div>
        )}

        {mode !== 'menu' && (
          <button
            type="button"
            className="mx-auto flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={12} /> 重置
          </button>
        )}
      </div>
    </div>
  );
}
