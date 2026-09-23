import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import { deleteAllRooms, deleteRoom, listRooms, type RoomRow } from '../lib/supabase';
import { useAppStore } from '../store/app-store';
import { useConfirm } from '../components/confirm-dialog';
import { useToast } from '../components/toast';
import type { TabKey } from '../components/nav-bar';

export function RoomManagerPage({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { room, leaveRoom } = useAppStore();
  const confirm = useConfirm();
  const toast = useToast();
  const load = async () => { setLoading(true); try { setRooms(await listRooms()); } catch (e) { toast.error(e instanceof Error ? e.message : '房间加载失败'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const remove = async (target: RoomRow) => {
    const ok = await confirm({ title: `删除房间「${target.name}」？`, message: `房间码 ${target.join_code} 及全部数据将永久删除。`, confirmText: '删除', cancelText: '取消', danger: true });
    if (!ok) return;
    try { await deleteRoom(target.id); if (room?.id === target.id) await leaveRoom(); setRooms((items) => items.filter((item) => item.id !== target.id)); toast.success('房间已删除'); } catch (e) { toast.error(e instanceof Error ? e.message : '删除失败'); }
  };
  const clearAll = async () => {
    if (!rooms.length) return;
    const ok = await confirm({ title: '清空全部房间？', message: `将永久删除 ${rooms.length} 个房间及其中所有成员、场次和对局。`, confirmText: '全部清空', cancelText: '取消', danger: true });
    if (!ok) return;
    try { await deleteAllRooms(); if (room) await leaveRoom(); setRooms([]); toast.success('全部房间已清空'); } catch (e) { toast.error(e instanceof Error ? e.message : '清空失败'); }
  };
  return <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6"><header className="mb-5 flex items-center justify-between gap-3"><div><h1 className="font-display text-2xl font-bold">房间管理</h1><p className="mt-1 text-xs text-ink-muted">共 {rooms.length} 个房间</p></div><button type="button" className="tac-btn h-9 px-3" onClick={() => onNavigate('settings')}><ArrowLeft size={15} /> 返回</button></header><div className="tac-card p-4"><div className="mb-3 flex gap-2"><button type="button" className="tac-btn h-9 px-3" onClick={() => void load()}><RefreshCw size={15} /> 刷新</button><button type="button" className="tac-btn ml-auto h-9 px-3 text-loss" disabled={!rooms.length} onClick={() => void clearAll()}><Trash2 size={15} /> 清空全部</button></div>{loading ? <p className="py-8 text-center text-sm text-ink-muted">加载中…</p> : rooms.length === 0 ? <p className="py-8 text-center text-sm text-ink-muted">暂无房间</p> : <div className="space-y-2">{rooms.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-3 py-3"><div className="min-w-0 flex-1"><div className="truncate font-semibold">{item.name}</div><div className="mt-0.5 font-display text-xs tracking-widest text-primary">{item.join_code}</div></div><button type="button" className="tac-btn h-8 w-8 px-0 text-loss" aria-label={`删除房间 ${item.name}`} onClick={() => void remove(item)}><Trash2 size={15} /></button></div>)}</div>}</div></div>;
}
