import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { useToast } from '../components/toast';
import { useConfirm } from '../components/confirm-dialog';
import { formatDateTime } from '../lib/format';
import { addGlobalPlayer, deleteGlobalPlayer, listGlobalPlayers } from '../lib/supabase';
import type { Player } from '../lib/types';

export function SettingsPage() {
  const {
    room,
    players,
    games,
    currentMatch,
    addPlayer,
    renamePlayer,
    removePlayer,
    leaveRoom,
    endCurrentMatch,
  } = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [newName, setNewName] = useState('');
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);
  const [globalPlayers, setGlobalPlayers] = useState<Player[]>([]);
  const [globalName, setGlobalName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const playerGameCount = (id: string): number =>
    games.filter((g) => g.participantIds.includes(id)).length;

  const loadGlobalPlayers = async () => {
    try {
      setGlobalPlayers(await listGlobalPlayers());
    } catch (e) {
      toast.error(e instanceof Error ? `全局人员加载失败：${e.message}` : '全局人员加载失败');
    }
  };

  useEffect(() => { void loadGlobalPlayers(); }, []);

  const handleAddGlobal = async () => {
    const name = globalName.trim();
    if (!name) return;
    try {
      await addGlobalPlayer(name);
      setGlobalName('');
      await loadGlobalPlayers();
      toast.success(`「${name}」已保存到全局人员库`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '名称已存在或保存失败');
    }
  };

  const handleDeleteGlobal = async (id: string, name: string) => {
    const ok = await confirm({ title: `删除全局人员「${name}」？`, message: '仅从全局人员库移除，不影响当前房间成员和历史对局。', confirmText: '删除', cancelText: '取消', danger: true });
    if (!ok) return;
    try {
      await deleteGlobalPlayer(id);
      setGlobalPlayers((previous) => previous.filter((player) => player.id !== id));
      toast.success('已从全局人员库移除');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await addPlayer(name);
      if (saveAsGlobal) {
        try { await addGlobalPlayer(name); } catch { /* 已存在于全局库时无需重复保存 */ }
      }
      setNewName('');
      toast.success(saveAsGlobal ? `队员「${name}」已加入房间并保存到全局库` : `队员「${name}」已加入房间并实时同步`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '添加失败');
    }
  };

  const handleRename = async (id: string) => {
    const name = editValue.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    try {
      await renamePlayer(id, name);
      setEditingId(null);
      toast.success('改名已同步');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '改名失败');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const count = playerGameCount(id);
    if (count > 0) {
      toast.error(`「${name}」已有 ${count} 局记录，请先在历史中删除相关对局`);
      return;
    }
    const ok = await confirm({
      title: `删除队员「${name}」？`,
      message: '该队员暂无对局记录，删除后所有成员的列表中都会移除。',
      confirmText: '删除',
      cancelText: '取消',
      danger: true,
    });
    if (!ok) return;
    try {
      await removePlayer(id);
      toast.success('队员已移除');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const shareUrl = room
    ? `${window.location.origin}${window.location.pathname}?join=${room.join_code}`
    : '';

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label}已复制`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败，请手动选择复制');
    }
  };

  const handleExport = () => {
    const payload = {
      app: 'pubg-scoreboard',
      exportedAt: new Date().toISOString(),
      room: room ? { name: room.name, joinCode: room.join_code } : null,
      players,
      games,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pubg-room-${room?.join_code ?? 'backup'}-${formatDateTime(new Date()).replace(/[\s:]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('备份文件已下载');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-5 font-display text-2xl font-bold tracking-wide">
        设置
        <span className="ml-2 align-middle font-body text-xs font-normal text-ink-muted">
          CONFIG
        </span>
      </h1>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 房间信息与分享 */}
        <section className="tac-card clip-tl p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
            <Share2 size={17} className="text-primary" /> 房间与邀请
          </h2>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-ink-muted">房间名称</div>
              <div className="mt-0.5 text-lg font-bold">{room?.name}</div>
            </div>
            <div className="rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2">
              <div className="text-xs text-ink-muted">当前场次</div>
              <div className="mt-0.5 flex items-center justify-between gap-3">
                <span className="font-semibold">{currentMatch?.name ?? '未创建场次'} · {games.length} 局</span>
                <button
                  type="button"
                  className="tac-btn h-8 px-3 text-xs text-primary"
                  disabled={!currentMatch}
                  onClick={async () => {
                    const ok = await confirm({ title: '结束当前场次？', message: '当前场次将归档到历史场次；排行榜与对局记录会从新场次重新开始。', confirmText: '结束并新建', cancelText: '取消', danger: true });
                    if (!ok) return;
                    try { await endCurrentMatch(); toast.success('当前场次已归档，已开启新场次'); } catch (e) { toast.error(e instanceof Error ? e.message : '结束场次失败'); }
                  }}
                >结束场次</button>
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">房间码（发给队友加入）</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="num rounded-lg border border-primary/40 bg-panel-2 px-4 py-2 text-center font-display text-2xl font-bold tracking-[0.4em] text-primary">
                  {room?.join_code}
                </span>
                <button
                  type="button"
                  className="tac-btn h-10 px-3"
                  onClick={() => handleCopy(room?.join_code ?? '', '房间码')}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">邀请链接（含自动加入）</div>
              <button
                type="button"
                onClick={() => handleCopy(shareUrl, '邀请链接')}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-left text-xs text-ink-muted hover:border-primary/40"
              >
                <Share2 size={13} className="shrink-0 text-primary" />
                <span className="truncate">{shareUrl}</span>
              </button>
            </div>
            <p className="rounded-lg bg-panel-2 px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
              队友打开链接会自动进入本房间；也可让队友在首页「输入房间码加入」输入上面 6 位码。
              数据实时云端同步，大家看到的是同一份战绩。
            </p>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: '退出当前房间？',
                  message: '退出将清空该房间的当前场次、历史场次和所有对局信息，所有成员都将无法再加入。',
                  confirmText: '清空并退出',
                  cancelText: '取消',
                  danger: true,
                });
                if (ok) {
                  try { await leaveRoom(); toast.success('房间与所有场次已清空'); } catch (e) { toast.error(e instanceof Error ? e.message : '退出失败'); }
                }
              }}
              className="tac-btn h-10 w-full text-loss"
            >
              <LogOut size={16} /> 退出房间
            </button>
          </div>
        </section>

        {/* 队员管理 */}
        <section className="tac-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
            <Users size={17} className="text-primary" /> 队员管理
            <span className="ml-auto text-xs font-normal text-ink-muted">{players.length} 人</span>
          </h2>

          <div className="mb-3 flex gap-2">
            <input
              className="tac-input h-10 flex-1"
              placeholder="输入新队员昵称"
              value={newName}
              maxLength={12}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAdd();
              }}
            />
            <button type="button" className="tac-btn tac-btn-primary h-10 px-4" onClick={handleAdd}>
              <Plus size={16} /> 添加
            </button>
          </div>
          <label className="-mt-1 mb-3 flex items-center gap-2 text-xs text-ink-muted">
            <input type="checkbox" checked={saveAsGlobal} onChange={(e) => setSaveAsGlobal(e.target.checked)} />
            同时保存为全局人员（之后建房可直接选取）
          </label>

          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2"
              >
                {editingId === p.id ? (
                  <>
                    <input
                      className="tac-input h-8 flex-1"
                      value={editValue}
                      autoFocus
                      maxLength={12}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename(p.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button
                      type="button"
                      className="tac-btn h-8 w-8 px-0 text-gain"
                      onClick={() => void handleRename(p.id)}
                    >
                      <Check size={15} />
                    </button>
                    <button
                      type="button"
                      className="tac-btn h-8 w-8 px-0 text-ink-muted"
                      onClick={() => setEditingId(null)}
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                    <span className="text-[11px] text-ink-muted">{playerGameCount(p.id)} 局</span>
                    <button
                      type="button"
                      className="tac-btn h-8 w-8 px-0 text-ink-muted"
                      onClick={() => {
                        setEditingId(p.id);
                        setEditValue(p.name);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="tac-btn h-8 w-8 px-0 text-loss"
                      onClick={() => void handleDelete(p.id, p.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {players.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-muted">还没有队员</p>
            )}
          </div>
        </section>

        {/* 全局人员库 */}
        <section className="tac-card p-5">
          <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold">
            <Users size={17} className="text-primary" /> 全局人员库
            <button type="button" className="ml-auto text-primary" aria-label="刷新全局人员库" onClick={() => void loadGlobalPlayers()}><RefreshCw size={16} /></button>
          </h2>
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">在此新增的人员可在之后创建任意房间时直接选取；删除不会影响已在房间中的队员。</p>
          <div className="mb-3 flex gap-2">
            <input
              className="tac-input h-10 flex-1"
              placeholder="输入全局人员昵称"
              value={globalName}
              maxLength={12}
              onChange={(e) => setGlobalName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAddGlobal(); }}
            />
            <button type="button" className="tac-btn tac-btn-primary h-10 px-4" onClick={() => void handleAddGlobal()}>
              <Plus size={16} /> 添加
            </button>
          </div>
          <div className="space-y-2">
            {globalPlayers.map((player) => <div key={player.id} className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2"><span className="flex-1 text-sm font-semibold">{player.name}</span><button type="button" className="tac-btn h-8 w-8 px-0 text-loss" aria-label={`删除全局人员 ${player.name}`} onClick={() => void handleDeleteGlobal(player.id, player.name)}><Trash2 size={14} /></button></div>)}
            {globalPlayers.length === 0 && <p className="py-3 text-center text-sm text-ink-muted">暂无全局人员</p>}
          </div>
        </section>

        {/* 数据备份 */}
        <section className="tac-card clip-br p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
            <Download size={17} className="text-primary" /> 数据备份
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-ink-muted">
            战绩已实时保存在云端房间中，所有成员共享同一份数据。你也可以导出本房间 JSON
            存档（用于本地留存或截图核对）。
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="tac-btn h-11 flex-1" onClick={handleExport}>
              <Download size={16} /> 导出 JSON 存档
            </button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" />
        </section>

        {/* 规则说明 */}
        <section className="tac-card clip-bl p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
            <Trophy size={17} className="text-primary" /> 计分规则
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-ink-muted">
            <div>
              <p className="mb-1 font-semibold text-ink">击杀分</p>
              <p>
                n 人参战时，每拿下 1 个人头，击杀者从其他每个参战者身上各得 1 分。
                标准 4 人队一个人头值 3 分：击杀者 <span className="text-gain">+3</span>，
                其余 3 人各 <span className="text-loss">-1</span>；不足 4 人时人头分 = 参战人数 -
                1，始终保持零和。
              </p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-ink">吃鸡分</p>
              <p>
                每名吃鸡者从未吃鸡者身上各得 5 分：吃鸡者 <span className="text-gain">+5×未吃鸡人数</span>
                ，未吃鸡者 <span className="text-loss">-5×吃鸡人数</span>。多人吃鸡分别结算；
                全员或无人吃鸡则不触发。
              </p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-ink">零和与累计</p>
              <p>
                每局所有人得分之和恒为 0；总分跨局累计，删除任意一局会自动回滚。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
