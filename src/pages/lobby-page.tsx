import { useEffect, useMemo, useState } from 'react';
import { Crosshair, Loader2, LogIn, Plus, RefreshCw, Share2, Trash2, Users, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { addGlobalPlayer, deleteGlobalPlayer, listGlobalPlayers } from '../lib/supabase';
import type { Player } from '../lib/types';

export function LobbyPage() {
  const { status, error, serviceUnavailable, createRoom, joinRoom } = useAppStore();
  const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'global'>('menu');
  const [roomName, setRoomName] = useState('开黑计分板');
  const [globalPlayers, setGlobalPlayers] = useState<Player[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [temporaryNames, setTemporaryNames] = useState<string[]>(['']);
  const [newGlobalName, setNewGlobalName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const serviceDown = serviceUnavailable;

  const loadGlobalPlayers = async () => {
    try {
      setLocalErr(null);
      setGlobalPlayers(await listGlobalPlayers());
    } catch (e) {
      setLocalErr(e instanceof Error ? `全局人员加载失败：${e.message}` : '全局人员加载失败，请刷新重试');
    }
  };
  useEffect(() => { void loadGlobalPlayers(); }, []);
  const seedNames = useMemo(() => [
    ...globalPlayers.filter((player) => selectedIds.includes(player.id)).map((player) => player.name),
    ...temporaryNames.map((name) => name.trim()).filter(Boolean),
  ], [globalPlayers, selectedIds, temporaryNames]);
  const handleCreate = async () => { setBusy(true); setLocalErr(null); try { await createRoom(roomName, seedNames); } catch (e) { setLocalErr(e instanceof Error ? e.message : '创建失败'); } finally { setBusy(false); } };
  const handleJoin = async () => { setBusy(true); setLocalErr(null); try { await joinRoom(code); } catch (e) { const message = e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message?: unknown }).message === 'string' ? (e as { message: string }).message : '无法加入该房间。请确认房间码或邀请链接完整有效。'); setLocalErr(message); } finally { setBusy(false); } };
  const addGlobal = async () => { const name = newGlobalName.trim(); if (!name) return; try { await addGlobalPlayer(name); setNewGlobalName(''); await loadGlobalPlayers(); } catch { setLocalErr('名称已存在或保存失败'); } };
  const removeGlobal = async (id: string) => { await deleteGlobalPlayer(id); setGlobalPlayers((prev) => prev.filter((player) => player.id !== id)); setSelectedIds((prev) => prev.filter((item) => item !== id)); };
  const toggleGlobal = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);

  return <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 py-10">
    <div className="tac-chip mb-5 flex h-16 w-16 items-center justify-center"><Crosshair size={34} className="text-primary" /></div>
    <h1 className="font-display text-3xl font-bold tracking-wider">开黑计分板</h1><p className="mt-2 text-center text-sm text-ink-muted">PUBG 固定车队 · 场次积分 · 实时协作</p>
    <div className={`mt-3 flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${serviceDown ? 'border-loss/40 text-loss' : 'border-line bg-panel-2 text-gain'}`}>{serviceDown ? <WifiOff size={12} /> : <Wifi size={12} />}{serviceDown ? '实时同步服务不可用' : '实时多人同步已就绪'}</div>
    {serviceDown && <div className="tac-card mt-4 w-full border-loss/30 px-4 py-3 text-sm text-loss">{error ?? '无法连接实时同步服务，请稍后重试。'}</div>}
    {!serviceDown && error && <div className="tac-card mt-4 w-full border-loss/30 px-4 py-3 text-sm text-loss">{error}</div>}
    <div className="mt-8 w-full space-y-3">
      {mode === 'menu' && <><button type="button" className="tac-btn tac-btn-primary h-12 w-full" disabled={serviceDown} onClick={() => setMode('create')}><Plus size={18} /> 创建车队房间</button><button type="button" className="tac-btn h-12 w-full" disabled={serviceDown} onClick={() => setMode('join')}><LogIn size={18} /> 输入房间码加入</button><button type="button" className="tac-btn h-11 w-full" onClick={() => setMode('global')}><Users size={17} /> 管理全局人员库</button><p className="flex items-start gap-1.5 pt-2 text-center text-[11px] leading-relaxed text-ink-muted"><Share2 size={12} className="mt-0.5 shrink-0" />建房后分享房间码，队友进入同一房间即可共同录入。</p></>}
      {mode === 'create' && <div className="tac-card space-y-4 p-5"><div><label className="mb-1.5 block text-xs font-semibold text-ink-muted">房间名称</label><input className="tac-input h-11" value={roomName} maxLength={40} onChange={(e) => setRoomName(e.target.value)} /></div><div><label className="mb-1.5 block text-xs font-semibold text-ink-muted">从全局人员库选择</label><div className="grid grid-cols-2 gap-2">{globalPlayers.map((player) => <button key={player.id} type="button" onClick={() => toggleGlobal(player.id)} className={`rounded-lg border px-3 py-2 text-left text-sm ${selectedIds.includes(player.id) ? 'border-primary bg-primary/15 text-primary' : 'border-line bg-panel-2 text-ink-muted'}`}>{selectedIds.includes(player.id) ? '✓ ' : ''}{player.name}</button>)}{globalPlayers.length === 0 && <p className="col-span-2 text-xs text-ink-muted">全局人员库为空，可先返回管理后再选择。</p>}</div></div><div><label className="mb-1.5 block text-xs font-semibold text-ink-muted">本房间临时人员</label><div className="space-y-2">{temporaryNames.map((name, index) => <input key={index} className="tac-input h-10 text-sm" value={name} maxLength={12} onChange={(e) => setTemporaryNames((prev) => prev.map((item, i) => i === index ? e.target.value : item))} placeholder="输入临时人员昵称" />)}</div><button type="button" className="mt-2 text-xs text-primary" onClick={() => setTemporaryNames((prev) => [...prev, ''])}>+ 新增临时人员</button></div><p className="text-xs text-ink-muted">已选 {seedNames.length} 人；名称不可重复。</p>{localErr && <p className="text-sm text-loss">{localErr}</p>}<div className="flex gap-2"><button type="button" className="tac-btn h-11 flex-1" disabled={busy} onClick={() => setMode('menu')}>返回</button><button type="button" className="tac-btn tac-btn-primary h-11 flex-[2]" disabled={busy} onClick={handleCreate}>{busy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}创建并进入</button></div></div>}
      {mode === 'global' && <div className="tac-card space-y-3 p-5"><div className="flex items-center gap-2"><h2 className="font-display text-lg font-bold">全局人员库</h2><button type="button" className="ml-auto text-primary" aria-label="刷新人员库" onClick={() => void loadGlobalPlayers()}><RefreshCw size={16} /></button></div><p className="text-xs text-ink-muted">可在新建房间时直接选取；同名人员不会重复保存。</p><div className="flex gap-2"><input className="tac-input h-10 flex-1" value={newGlobalName} maxLength={12} placeholder="新增全局人员" onChange={(e) => setNewGlobalName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addGlobal(); }} /><button type="button" className="tac-btn tac-btn-primary h-10 px-3" onClick={() => void addGlobal()}><Plus size={16} /></button></div>{localErr && <p className="text-sm text-loss">{localErr}</p>}<div className="space-y-2">{globalPlayers.map((player) => <div key={player.id} className="flex items-center rounded-lg border border-line bg-panel-2 px-3 py-2"><span className="flex-1 text-sm font-semibold">{player.name}</span><button type="button" className="text-loss" aria-label="删除全局人员" onClick={() => void removeGlobal(player.id)}><Trash2 size={15} /></button></div>)}{globalPlayers.length === 0 && <p className="py-4 text-center text-sm text-ink-muted">暂无全局人员</p>}</div><button type="button" className="tac-btn h-11 w-full" onClick={() => setMode('menu')}>返回</button></div>}
      {mode === 'join' && <div className="tac-card space-y-3 p-5"><label className="mb-1.5 block text-xs font-semibold text-ink-muted">输入队友分享的 6 位房间码</label><input className="tac-input h-12 text-center font-display text-2xl uppercase tracking-[0.5em]" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC234" autoFocus />{localErr && <p className="text-sm text-loss">{localErr}</p>}<div className="flex gap-2"><button type="button" className="tac-btn h-11 flex-1" disabled={busy} onClick={() => setMode('menu')}>返回</button><button type="button" className="tac-btn tac-btn-primary h-11 flex-[2]" disabled={busy || code.trim().length < 4} onClick={handleJoin}>{busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}加入房间</button></div></div>}
      {mode !== 'menu' && <button type="button" className="mx-auto flex items-center gap-1.5 text-xs text-ink-muted" onClick={() => window.location.reload()}><RefreshCw size={12} /> 重置</button>}
    </div>
  </div>;
}
