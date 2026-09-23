import { useMemo } from 'react';
import { ClipboardList, Crosshair, Skull, Trash2, Trophy, Users } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { useConfirm } from '../components/confirm-dialog';
import { useToast } from '../components/toast';
import { formatDateTime, formatScore } from '../lib/format';
import type { Game } from '../lib/types';
import type { TabKey } from '../components/nav-bar';

interface HistoryPageProps {
  onNavigate: (tab: TabKey) => void;
}

export function HistoryPage({ onNavigate }: HistoryPageProps) {
  const { games, removeGame, playerName } = useAppStore();
  const confirm = useConfirm();
  const toast = useToast();

  const sorted = useMemo(
    () => [...games].sort((a, b) => b.playedAt.localeCompare(a.playedAt)),
    [games],
  );

  const handleDelete = async (game: Game) => {
    const ok = await confirm({
      title: '删除这局战绩？',
      message: '删除后该局的击杀分与吃鸡分将从所有人累计总分中自动回滚，此操作不可恢复。',
      confirmText: '确认删除',
      cancelText: '再想想',
      danger: true,
    });
    if (!ok) return;
    try {
      await removeGame(game.id);
      toast.success('对局已删除，总分已回滚');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  if (sorted.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-line">
          <ClipboardList size={32} className="text-ink-muted" />
        </div>
        <h2 className="font-display text-xl font-semibold">暂无历史记录</h2>
        <p className="mt-2 text-sm text-ink-muted">每局结算后会在这里展示明细，可随时删除回滚</p>
        <button
          type="button"
          className="tac-btn tac-btn-primary mt-6 h-11 px-8"
          onClick={() => onNavigate('record')}
        >
          <Crosshair size={17} /> 去记一局
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-wide">
          历史战绩
          <span className="ml-2 align-middle font-body text-xs font-normal text-ink-muted">
            MATCH LOG · 共 {sorted.length} 局
          </span>
        </h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((game, idx) => {
          const winnerSet = new Set(game.winnerIds);
          const totalKills = Object.values(game.kills).reduce((a, b) => a + b, 0);
          const winNames = game.winnerIds.map(playerName).filter((n) => n !== '已离队');
          return (
            <div key={game.id} className="tac-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-panel-2 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="num rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                    第 {sorted.length - idx} 局
                  </span>
                  <span className="text-xs text-ink-muted">{formatDateTime(game.playedAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Skull size={11} /> {totalKills}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {game.participantIds.length}
                  </span>
                  <button
                    type="button"
                    aria-label="删除本局"
                    onClick={() => handleDelete(game)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-loss/20 hover:text-loss"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {winNames.length > 0 && (
                <div className="flex items-center gap-1.5 border-b border-line/50 bg-primary/[0.06] px-4 py-1.5 text-xs font-bold text-primary">
                  <Trophy size={13} /> 吃鸡：{winNames.join('、')}
                </div>
              )}
              <div className="divide-y divide-line/50">
                {game.participantIds.map((id) => {
                  const score = game.scores[id] ?? 0;
                  const isWinner = winnerSet.has(id);
                  return (
                    <div key={id} className="flex items-center gap-2 px-4 py-2">
                      {isWinner ? (
                        <Trophy size={13} className="shrink-0 text-primary" />
                      ) : (
                        <span className="w-[13px] shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {playerName(id)}
                      </span>
                      <span className="num w-12 text-right text-xs text-ink-muted">
                        {game.kills[id] ?? 0} 杀
                      </span>
                      <span
                        className={`num w-14 text-right text-base font-bold ${
                          score > 0 ? 'text-gain' : score < 0 ? 'text-loss' : 'text-ink-muted'
                        }`}
                      >
                        {formatScore(score)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
