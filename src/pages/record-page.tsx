import { useMemo, useState } from 'react';
import {
  Crosshair,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
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
  const { players, games, draft, meId, updateDraft, commitGame, currentMatch } = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);

  // 草稿未加载完时显示骨架
  const d: DraftPayload = draft ?? { participantIds: [], kills: {}, winnerIds: [] };
  const participantIds = useMemo(
    () => players.filter((p) => d.participantIds.includes(p.id)),
    [players, d.participantIds],
  );
  const n = participantIds.length;

  const kills = d.kills ?? {};
  const winnerIds = d.winnerIds ?? [];
  const totalKills = participantIds.reduce((s, p) => s + (kills[p.id] ?? 0), 0);
  const w = participantIds.filter((p) => winnerIds.includes(p.id)).length;

  const liveScores = useMemo(
    () => (n >= 2 ? scoreGame(d.participantIds, kills, winnerIds) : {}),
    [d.participantIds, kills, winnerIds, n],
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
        kills,
        winnerIds,
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
          onClick={toggleAll}
          className="tac-btn h-9 px-4 text-sm"
          disabled={players.length === 0}
        >
          {players.length > 0 && players.every((p) => d.participantIds.includes(p.id))
            ? '全部缺席'
            : '全员参战'}
        </button>
        <button
          type="button"
          onClick={() => void clearCurrentRound()}
          className="tac-btn h-9 px-4 text-sm text-loss"
          disabled={n === 0}
        >
          一键清理
        </button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* 左侧：录入表格 */}
        <section className="tac-card overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1.4fr)_120px_96px] items-center gap-3 border-b border-line bg-panel-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            <span>队员（{n} 人参战）</span>
            <span className="text-center">击杀数</span>
            <span className="text-center">吃鸡</span>
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
              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-[minmax(0,1.4fr)_120px_96px] items-center gap-3 px-5 py-2.5 transition-colors ${
                    isIn ? '' : 'opacity-45'
                  } ${isMe ? 'bg-primary/5' : ''}`}
                >
                  {/* 队员 + 参战勾选 */}
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      aria-label={isIn ? '取消参战' : '参战'}
                      onClick={() => toggleParticipant(p.id)}
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
                    </div>
                  </div>

                  {/* 击杀数：− 输入框 + */}
                  <div className="flex justify-center">
                    <div className="kill-input flex items-stretch">
                      <button
                        type="button"
                        className="kill-btn"
                        disabled={!isIn || k <= 0}
                        onClick={() => stepKills(p.id, -1)}
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
                        onChange={(e) => {
                          if (isIn) setKills(p.id, Number(e.target.value) || 0);
                        }}
                      />
                      <button
                        type="button"
                        className="kill-btn kill-btn-plus"
                        disabled={!isIn}
                        onClick={() => stepKills(p.id, 1)}
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
                      onClick={() => toggleWinner(p.id)}
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
                </div>
              );
            })}
          </div>
        </section>

        {/* 右侧：实时结算 */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="tac-card clip-br p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" />
              <h2 className="font-display text-sm font-bold tracking-wider">本局结算预览</h2>
              <span className="ml-auto flex items-center gap-1 text-[11px] text-gain">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gain" /> 实时
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-panel-2 px-2 py-2">
                <div className="num text-lg font-bold text-ink">{n}</div>
                <div className="text-[10px] text-ink-muted">参战</div>
              </div>
              <div className="rounded-lg bg-panel-2 px-2 py-2">
                <div className="num flex items-center justify-center gap-1 text-lg font-bold text-ink">
                  {totalKills}
                  <Skull size={12} className="text-ink-muted" />
                </div>
                <div className="text-[10px] text-ink-muted">总击杀</div>
              </div>
              <div className="rounded-lg bg-panel-2 px-2 py-2">
                <div className="num flex items-center justify-center gap-1 text-lg font-bold text-ink">
                  {w}
                  <Trophy size={12} className="text-ink-muted" />
                </div>
                <div className="text-[10px] text-ink-muted">吃鸡</div>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              {n < 2 ? (
                <p className="rounded-lg bg-panel-2 px-3 py-3 text-center text-xs text-ink-muted">
                  勾选至少 2 名参战队员后自动结算
                </p>
              ) : (
                participantIds.map((p) => {
                  const delta = liveScores[p.id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg bg-panel-2 px-3 py-2"
                    >
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      <span
                        className={`num text-lg font-bold tabular-nums ${
                          delta > 0
                            ? 'text-gain'
                            : delta < 0
                              ? 'text-loss'
                              : 'text-ink-muted'
                        }`}
                      >
                        {formatScore(delta)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-gain/30 bg-gain/10 px-3 py-2 text-xs font-semibold text-gain">
              <ShieldCheck size={14} /> 零和校验通过（合计 {formatScore(0)}）
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="tac-btn tac-btn-primary mt-3 h-12 w-full text-base disabled:opacity-40"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Swords size={18} /> 保存本局
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-muted">
              保存后表单自动清空（保留参战人员），可立即连录下一局
            </p>
          </div>

          {/* 当前累计榜（连录时可见叠加效果） */}
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
                  const total = statsMap.get(p.id)?.totalScore ?? 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-panel/80 px-2.5 py-1.5 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="num w-4 text-center text-xs text-ink-muted">{i + 1}</span>
                        <span className="truncate">{p.name}</span>
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
