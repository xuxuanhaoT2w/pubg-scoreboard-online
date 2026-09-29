import { useEffect, useMemo, useState } from 'react';
import {
  Crosshair,
  Crown,
  ChevronDown,
  Gift,
  Loader2,
  Minus,
  Plus,
  Skull,
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
  const [showGiftRules, setShowGiftRules] = useState(false);
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
  const rankedPlayers = players.filter((player) => (statsMap.get(player.id)?.games ?? 0) > 0);
  const totalKills = games.reduce(
    (sum, game) => sum + Object.values(game.kills).reduce((killsSum, kills) => killsSum + kills, 0),
    0,
  );
  const totalWinningGames = games.filter((game) => game.winnerIds.length > 0).length;
  const currentKills = Object.values(effectiveKills).reduce((sum, kills) => sum + kills, 0);
  const highestNegativeScore = rankedPlayers.reduce<number | null>((lowest, player) => {
    const score = statsMap.get(player.id)?.totalScore ?? 0;
    return score < 0 && (lowest === null || score < lowest) ? score : lowest;
  }, null);

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
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
      <header className="mb-4 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/[0.12] to-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary"><span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(245,166,35,0.9)]" /> 当前待保存对局</div>
            <h1 className="font-display text-2xl font-bold tracking-wide sm:text-3xl">录入对局 <span className="ml-2 align-middle font-body text-xs font-normal text-ink-muted">{currentMatch?.name ?? '当前场次'} · 第 {games.length + 1} 局</span></h1>
            <p className="mt-1 text-xs text-ink-muted">填写击杀、选择吃鸡；所有变动会实时同步给房间成员。</p>
          </div>
          <button type="button" onClick={handleSave} disabled={!canSave || saving} className="tac-btn tac-btn-primary h-12 min-w-36 gap-2 px-6 text-base disabled:opacity-40">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <><Swords size={18} /> 确认保存本局</>}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-primary/20 pt-3 text-xs">
          <span><b className="num text-base text-primary">{n}</b> 人参战</span><span><b className="num text-base text-ink">{currentKills}</b> 总击杀</span><span><b className="num text-base text-gain">{winnerIds.length}</b> 人吃鸡</span>
          <span className={`ml-auto font-semibold ${canSave ? 'text-gain' : 'text-primary'}`}>{canSave ? '已满足保存条件' : '至少选择 2 名参战队员'}</span>
        </div>
      </header>

      <section className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2.5">
        <button type="button" onClick={() => { setEditingActivity('正在调整本局参战人员'); toggleAll(); }} className="tac-btn h-9 px-4 text-sm" disabled={players.length === 0}>{players.length > 0 && players.every((p) => d.participantIds.includes(p.id)) ? '全部缺席' : '全员参战'}</button>
        <button type="button" onClick={() => { setEditingActivity('正在清理本局数据'); void clearCurrentRound(); }} className="tac-btn h-9 px-4 text-sm text-loss" disabled={n === 0}>一键清理</button>
        <button type="button" onClick={() => setShowGiftRules((open) => !open)} className={`tac-btn ml-auto h-9 gap-1.5 px-3 text-xs ${showGiftRules || giftRules.length > 0 ? 'border border-primary/40 bg-primary/10 text-primary' : 'text-ink-muted'}`}><Gift size={14} /> 赠分规则{giftRules.length > 0 ? `（${giftRules.length}）` : ''}<ChevronDown size={14} className={showGiftRules ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>
      </section>

      {showGiftRules && <section className="mb-4 rounded-lg border border-line bg-panel-2 px-4 py-3 animate-fade-in"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-ink">赠分规则</span><span className="mr-1 text-ink-muted">A ≥1 杀时，A −1 分给 B</span><select className="tac-input h-8 w-28 text-xs" value={giftFromId} onChange={(e) => { setEditingActivity('正在配置赠分规则'); setGiftFromId(e.target.value); }}><option value="">选择 A</option>{participantIds.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><span className="text-ink-muted">→</span><select className="tac-input h-8 w-28 text-xs" value={giftToId} onChange={(e) => { setEditingActivity('正在配置赠分规则'); setGiftToId(e.target.value); }}><option value="">选择 B</option>{participantIds.filter((player) => player.id !== giftFromId).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><button type="button" className="tac-btn h-8 px-3 text-xs" disabled={!giftFromId || !giftToId || giftFromId === giftToId} onClick={() => { setEditingActivity('正在配置赠分规则'); addGiftRule(); }}>添加</button>{giftRules.map((rule) => <button key={`${rule.fromId}-${rule.toId}`} type="button" className="rounded bg-primary/15 px-2 py-1 text-xs text-primary" onClick={() => { setEditingActivity('正在配置赠分规则'); removeGiftRule(rule.fromId, rule.toId); }}>{players.find((p) => p.id === rule.fromId)?.name} → {players.find((p) => p.id === rule.toId)?.name} ×1</button>)}</div></section>}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* 左侧：录入表格 */}
        <section className="tac-card overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1.4fr)_120px_96px_84px] items-center gap-3 border-b border-line bg-panel-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            <span>选择参战队员</span>
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

        {/* 右侧：当场排行榜 */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="tac-card order-first border border-primary/50 bg-primary/[0.06] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users size={15} className="text-primary" />
              <h2 className="font-display text-base font-bold tracking-wider text-primary">当场排行榜</h2>
            </div>
            <div className="mb-3 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-panel/70 py-2">
              <div className="text-center"><div className="flex items-center justify-center gap-1 text-[10px] text-ink-muted"><Swords size={10} />已录入</div><div className="num mt-0.5 text-base font-bold text-ink">{games.length}<span className="ml-0.5 text-[10px] font-normal">局</span></div></div>
              <div className="text-center"><div className="flex items-center justify-center gap-1 text-[10px] text-ink-muted"><Skull size={10} />总击杀</div><div className="num mt-0.5 text-base font-bold text-primary">{totalKills}<span className="ml-0.5 text-[10px] font-normal">杀</span></div></div>
              <div className="text-center"><div className="flex items-center justify-center gap-1 text-[10px] text-ink-muted"><Trophy size={10} />吃鸡局数</div><div className="num mt-0.5 text-base font-bold text-gain">{totalWinningGames}<span className="ml-0.5 text-[10px] font-normal">局</span></div></div>
            </div>
            <div className="space-y-1.5">
              {rankedPlayers
                .slice()
                .sort((a, b) => {
                  const sa = statsMap.get(a.id)?.totalScore ?? 0;
                  const sb = statsMap.get(b.id)?.totalScore ?? 0;
                  return sb - sa;
                })
                .map((p, i) => {
                  const stat = statsMap.get(p.id);
                  const total = stat?.totalScore ?? 0;
                  const isHighestNegative = highestNegativeScore !== null && total === highestNegativeScore;
                  return (
                    <div key={p.id} className={`relative overflow-hidden rounded-lg border px-3 py-2.5 text-sm ${isHighestNegative ? 'border-primary bg-gradient-to-r from-primary/25 via-amber-400/10 to-primary/20 shadow-[0_0_0_1px_rgba(245,166,35,0.45),0_0_20px_rgba(245,166,35,0.22)]' : 'border-line/70 bg-panel/80'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="relative flex min-w-0 items-center gap-2"><span className={`num flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold ${i === 0 ? 'bg-primary text-black' : isHighestNegative ? 'bg-primary text-black shadow-[0_0_12px_rgba(245,166,35,0.7)]' : 'bg-panel-2 text-ink-muted'}`}>{i + 1}</span><span className="min-w-0"><span className="block truncate font-semibold">{p.name}</span>{isHighestNegative && <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-primary"><Crown size={11} fill="currentColor" />尊贵老板席位</span>}</span></span>
                        <span className={`relative min-w-[92px] rounded-lg border px-2.5 py-1 text-center ${isHighestNegative ? 'border-primary/55 bg-panel/85' : total > 0 ? 'border-gain/40 bg-gain/10' : total < 0 ? 'border-loss/40 bg-loss/10' : 'border-line bg-panel-2'}`}><span className={`flex items-center justify-center gap-1 text-[9px] font-semibold tracking-wider ${isHighestNegative ? 'text-primary/85' : 'text-ink-muted'}`}>{isHighestNegative ? <><Crown size={10} fill="currentColor" />老板积分</> : <><Trophy size={9} />总积分</>}</span><span
                          className={`num block text-xl font-bold leading-5 tabular-nums ${
                            total > 0 ? 'text-gain' : total < 0 ? 'text-loss' : 'text-ink-muted'
                          }`}
                        >
                          {formatScore(total)}
                        </span></span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 divide-x divide-line/80 rounded bg-panel-2/80 py-1.5 text-center"><div><span className="flex items-center justify-center gap-0.5 text-[9px] text-ink-muted"><Swords size={9} />参战</span><b className="num text-sm text-ink">{stat?.games ?? 0}</b></div><div><span className="flex items-center justify-center gap-0.5 text-[9px] text-ink-muted"><Skull size={9} />击杀</span><b className="num text-sm text-primary">{stat?.totalKills ?? 0}</b></div><div><span className="flex items-center justify-center gap-0.5 text-[9px] text-ink-muted"><Trophy size={9} />吃鸡</span><b className="num text-sm text-gain">{stat?.wins ?? 0}</b></div></div>
                    </div>
                  );
                })}
              {rankedPlayers.length === 0 && <p className="py-2 text-center text-xs text-ink-muted">暂无已记分队员</p>}
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
