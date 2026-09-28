import { useEffect, useMemo, useState } from 'react';
import {
  Crosshair,
  Loader2,
  Minus,
  Plus,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { scoreGame } from '../lib/scoring';
import { computeStats } from '../lib/scoring';
import { formatScore } from '../lib/format';
import { useToast } from '../components/toast';
import { useConfirm } from '../components/confirm-dialog';
import type { DraftPayload } from '../lib/supabase';
import type { Game } from '../lib/types';

export function RecordPage() {
  const { players, games, draft, meId, updateDraft, commitGame, currentMatch, setEditingActivity } = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [giftFromId, setGiftFromId] = useState('');
  const [giftToId, setGiftToId] = useState('');

  useEffect(() => {
    setEditingActivity('正在录入本局');
    return () => setEditingActivity(null);
  }, [setEditingActivity]);

  // 草稿未加载完时显示骨架
  const d: DraftPayload = draft ?? { participantIds: [], kills: {}, winnerIds: [], zeroKillsAsOneIds: [], giftRules: [] };
  const participantIds = useMemo(
    () => players.filter((p) => d.participantIds.includes(p.id)),
    [players, d.participantIds],
  );
  const n = participantIds.length;

  const kills = d.kills ?? {};
  const winnerIds = d.winnerIds ?? [];
  const zeroKillsAsOneIds = d.zeroKillsAsOneIds ?? [];
  const giftRules = d.giftRules ?? [];
  const effectiveKills = useMemo(() => Object.fromEntries(participantIds.map((player) => [player.id, (kills[player.id] ?? 0) === 0 && zeroKillsAsOneIds.includes(player.id) ? 1 : (kills[player.id] ?? 0)])), [participantIds, kills, zeroKillsAsOneIds]);

  const liveScores = useMemo(
    () => (n >= 2 ? scoreGame(d.participantIds, effectiveKills, winnerIds, giftRules) : {}),
    [d.participantIds, effectiveKills, winnerIds, giftRules, n],
  );
  const statsMap = useMemo(() => {
    const arr = computeStats(players, games);
    return new Map(arr.map((s) => [s.player.id, s]));
  }, [players, games]);

  const canSave = n >= 2;

  const toggleParticipant = (id: string) =>
    void updateDraft((prev) => {
      const on = prev.participantIds.includes(id);
      return {
        ...prev,
        participantIds: on
          ? prev.participantIds.filter((x) => x !== id)
          : [...prev.participantIds, id],
        kills: { ...prev.kills, [id]: prev.kills[id] ?? 0 },
        winnerIds: on ? prev.winnerIds.filter((x) => x !== id) : prev.winnerIds,
        zeroKillsAsOneIds: on ? (prev.zeroKillsAsOneIds ?? []).filter((x) => x !== id) : (prev.zeroKillsAsOneIds ?? []),
        giftRules: on ? (prev.giftRules ?? []).filter((rule) => rule.fromId !== id && rule.toId !== id) : (prev.giftRules ?? []),
      };
    });

  const setKills = (id: string, value: number) =>
    void updateDraft((prev) => {
      const v = Math.max(0, Math.min(99, value));
      return { ...prev, kills: { ...prev.kills, [id]: v } };
    });

  const stepKills = (id: string, delta: number) =>
    void updateDraft((prev) => {
      const cur = prev.kills[id] ?? 0;
      const v = Math.max(0, cur + delta);
      return { ...prev, kills: { ...prev.kills, [id]: v } };
    });

  const toggleWinner = (id: string) =>
    void updateDraft((prev) => ({
      ...prev,
      winnerIds: prev.winnerIds.includes(id)
        ? prev.winnerIds.filter((x) => x !== id)
        : [...prev.winnerIds, id],
    }));

  const toggleZeroKillsAsOne = (id: string) =>
    void updateDraft((prev) => ({ ...prev, zeroKillsAsOneIds: (prev.zeroKillsAsOneIds ?? []).includes(id) ? (prev.zeroKillsAsOneIds ?? []).filter((item) => item !== id) : [...(prev.zeroKillsAsOneIds ?? []), id] }));

  const addGiftRule = () => {
    if (!giftFromId || !giftToId || giftFromId === giftToId) return;
    void updateDraft((prev) => ({ ...prev, giftRules: (prev.giftRules ?? []).some((rule) => rule.fromId === giftFromId && rule.toId === giftToId) ? (prev.giftRules ?? []) : [...(prev.giftRules ?? []), { fromId: giftFromId, toId: giftToId }] }));
    setGiftFromId(''); setGiftToId('');
  };

  const removeGiftRule = (fromId: string, toId: string) => void updateDraft((prev) => ({ ...prev, giftRules: (prev.giftRules ?? []).filter((rule) => rule.fromId !== fromId || rule.toId !== toId) }));

  const toggleAll = () =>
    void updateDraft((prev) => {
      const allIn = players.length > 0 && players.every((p) => prev.participantIds.includes(p.id));
      if (allIn) {
        return { ...prev, participantIds: [], winnerIds: [] };
      }
      const ids = players.map((p) => p.id);
      return {
        participantIds: ids,
        kills: Object.fromEntries(ids.map((id) => [id, prev.kills[id] ?? 0])),
        winnerIds: [],
      };
    });

  const clearCurrentRound = async () => {
    const ok = await confirm({
      title: '清理当前对局？',
      message: '将清零本局所有击杀并取消吃鸡选择，参战人员保持不变。',
      confirmText: '确认清理',
      cancelText: '取消',
      danger: true,
    });
    if (!ok) return;
    await updateDraft((prev) => ({
      ...prev,
      kills: Object.fromEntries(prev.participantIds.map((id) => [id, 0])),
      winnerIds: [],
    }));
    toast.success('当前对局已清理');
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const game: Omit<Game, 'id' | 'playedAt'> = {
        participantIds: d.participantIds,
        kills: effectiveKills,
        zeroKillsAsOneIds,
        winnerIds,
        giftRules,
        scores: liveScores,
      };
      await commitGame(game);
      toast.success('战绩已入库，总分已累计 · 可接着记下一局');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">
            记一局
            <span className="ml-2 align-middle font-body text-xs font-normal text-ink-muted">
            {currentMatch?.name ?? '当前场次'} · 多人实时协同
            </span>
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            大家各自填自己的击杀、勾吃鸡，改动会实时同步给房间内所有人。
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingActivity('正在调整本局参战人员'); toggleAll(); }}
          className="tac-btn h-9 px-4 text-sm"
          disabled={players.length === 0}
        >
          {players.length > 0 && players.every((p) => d.participantIds.includes(p.id))
            ? '全部缺席'
            : '全员参战'}
        </button>
        <button
          type="button"
          onClick={() => { setEditingActivity('正在清理本局数据'); void clearCurrentRound(); }}
          className="tac-btn h-9 px-4 text-sm text-loss"
          disabled={n === 0}
        >
          一键清理
        </button>
        <button type="button" onClick={handleSave} disabled={!canSave || saving} className="tac-btn tac-btn-primary h-10 px-5 text-sm disabled:opacity-40">
          {saving ? <Loader2 size={17} className="animate-spin" /> : <><Swords size={17} /> 保存本局</>}
        </button>
      </header>

      <section className="mb-4 rounded-lg border border-line bg-panel-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-ink-muted">赠分规则</span><span className="text-ink-muted">A ≥1 杀时，A −1 分给 B</span><select className="tac-input h-8 w-28 text-xs" value={giftFromId} onChange={(e) => { setEditingActivity('正在配置赠分规则'); setGiftFromId(e.target.value); }}><option value="">选择 A</option>{participantIds.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><select className="tac-input h-8 w-28 text-xs" value={giftToId} onChange={(e) => { setEditingActivity('正在配置赠分规则'); setGiftToId(e.target.value); }}><option value="">选择 B</option>{participantIds.filter((player) => player.id !== giftFromId).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><button type="button" className="tac-btn h-8 px-3 text-xs" disabled={!giftFromId || !giftToId || giftFromId === giftToId} onClick={() => { setEditingActivity('正在配置赠分规则'); addGiftRule(); }}>添加</button>{giftRules.map((rule) => <button key={`${rule.fromId}-${rule.toId}`} type="button" className="rounded bg-primary/15 px-2 py-1 text-xs text-primary" onClick={() => { setEditingActivity('正在配置赠分规则'); removeGiftRule(rule.fromId, rule.toId); }}>{players.find((p) => p.id === rule.fromId)?.name} → {players.find((p) => p.id === rule.toId)?.name} ×1</button>)}</div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* 左侧：录入表格 */}
        <section className="tac-card overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1.4fr)_120px_96px_84px] items-center gap-3 border-b border-line bg-panel-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            <span>队员（{n} 人参战）</span>
            <span className="text-center">击杀数</span>
            <span className="text-center">吃鸡</span>
            <span className="text-right">本局积分</span>
          </div>

          {players.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-ink-muted">
              房间还没有队员，请先到「设置」添加队员。
            </div>
          )}

          <div className="divide-y divide-line/60">
            {players.map((p) => {
              const isIn = d.participantIds.includes(p.id);
              const isWinner = winnerIds.includes(p.id);
              const k = kills[p.id] ?? 0;
              const isMe = p.id === meId;
              const zeroAsOne = zeroKillsAsOneIds.includes(p.id);
              const delta = liveScores[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-[minmax(0,1.4fr)_120px_96px_84px] items-center gap-3 px-5 py-2.5 transition-colors ${
                    isIn ? '' : 'opacity-45'
                  } ${isMe ? 'bg-primary/5' : ''}`}
                >
                  {/* 队员 + 参战勾选 */}
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      aria-label={isIn ? '取消参战' : '参战'}
                      onClick={() => { setEditingActivity(`正在调整 ${p.name} 的参战状态`); toggleParticipant(p.id); }}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-all ${
                        isIn
                          ? 'border-primary bg-primary text-bg'
                          : 'border-line bg-panel text-transparent hover:border-primary/50'
                      }`}
                    >
                      <span className="text-sm font-bold leading-none">✓</span>
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-bold">{p.name}</span>
                        {isMe && (
                          <span className="rounded bg-primary/15 px-1.5 py-px text-[10px] font-semibold text-primary">
                            我
                          </span>
                        )}
                      </div>
                      {isIn && (
                        <div className="mt-0.5 text-[11px] text-ink-muted">
                          {isWinner ? (
                            <span className="flex items-center gap-1 text-gain">
                              <Trophy size={11} /> 吃鸡
                            </span>
                          ) : (
                            <span>未吃鸡</span>
                          )}
                        </div>
                      )}
                      <button type="button" disabled={!isIn} onClick={() => { setEditingActivity(`正在设置 ${p.name} 的 0=1 规则`); toggleZeroKillsAsOne(p.id); }} className={`mt-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${zeroAsOne ? 'bg-primary/20 text-primary' : 'bg-panel-2 text-ink-muted'} disabled:opacity-40`}>0=1</button>
                    </div>
                  </div>

                  {/* 击杀数：− 输入框 + */}
                  <div className="flex justify-center">
                    <div className="kill-input flex items-stretch">
                      <button
                        type="button"
                        className="kill-btn"
                        disabled={!isIn || k <= 0}
                        onClick={() => { setEditingActivity(`正在编辑 ${p.name} 的击杀`); stepKills(p.id, -1); }}
                        aria-label="减少击杀"
                      >
                        <Minus size={15} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        inputMode="numeric"
                        disabled={!isIn}
                        className="kill-num"
                        value={isIn ? k : 0}
                        onFocus={() => setEditingActivity(`正在编辑 ${p.name} 的击杀`)}
                        onBlur={() => setEditingActivity('正在录入本局')}
                        onChange={(e) => {
                          if (isIn) setKills(p.id, Number(e.target.value) || 0);
                        }}
                      />
                      <button
                        type="button"
                        className="kill-btn kill-btn-plus"
                        disabled={!isIn}
                        onClick={() => { setEditingActivity(`正在编辑 ${p.name} 的击杀`); stepKills(p.id, 1); }}
                        aria-label="增加击杀"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>

                  {/* 吃鸡勾选 */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      disabled={!isIn}
                      onClick={() => { setEditingActivity(`正在编辑 ${p.name} 的吃鸡状态`); toggleWinner(p.id); }}
                      className={`flex h-10 w-14 items-center justify-center gap-1 rounded-lg border text-xs font-semibold transition-all ${
                        isWinner
                          ? 'border-primary bg-primary/15 text-gain'
                          : 'border-line bg-panel text-ink-muted hover:border-primary/40 disabled:opacity-40'
                      }`}
                    >
                      <Trophy size={14} />
                      {isWinner ? '吃鸡' : '—'}
                    </button>
                  </div>
                  <span className={`num text-right text-lg font-bold tabular-nums ${delta > 0 ? 'text-gain' : delta < 0 ? 'text-loss' : 'text-ink-muted'}`}>
                    {isIn && n >= 2 ? formatScore(delta) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 右侧：当前累计总分 */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="tac-card order-first border border-primary/50 bg-primary/[0.06] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users size={15} className="text-primary" />
              <h2 className="font-display text-base font-bold tracking-wider text-primary">当前累计总分</h2>
              <span className="ml-auto text-[10px] font-semibold text-ink-muted">本场排行</span>
            </div>
            <div className="space-y-1.5">
              {participantIds
                .slice()
                .sort((a, b) => {
                  const sa = statsMap.get(a.id)?.totalScore ?? 0;
                  const sb = statsMap.get(b.id)?.totalScore ?? 0;
                  return sb - sa;
                })
                .map((p, i) => {
                  const stat = statsMap.get(p.id);
                  const total = stat?.totalScore ?? 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-panel/80 px-2.5 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="num w-4 text-center text-xs text-ink-muted">{i + 1}</span>
                        <span className="min-w-0"><span className="block truncate">{p.name}</span><span className="mt-0.5 block text-[10px] text-ink-muted">{stat?.totalKills ?? 0} 杀 · {stat?.wins ?? 0} 吃鸡</span></span>
                      </span>
                      <span
                        className={`num text-base font-bold tabular-nums ${
                          total > 0 ? 'text-gain' : total < 0 ? 'text-loss' : 'text-ink-muted'
                        }`}
                      >
                        {formatScore(total)}
                      </span>
                    </div>
                  );
                })}
              {n === 0 && <p className="py-2 text-center text-xs text-ink-muted">暂无参战队员</p>}
            </div>
          </div>
        </aside>
      </div>

      {/* 记录页快捷提示 */}
      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-ink-muted">
        <Crosshair size={12} className="text-primary/60" />
        提示：每个人选好自己名字后，只需填自己那一行；保存由任一人确认即可
      </div>
    </div>
  );
}
