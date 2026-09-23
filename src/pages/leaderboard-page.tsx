import { useMemo } from 'react';
import { Crosshair, Crown, Skull, Trophy, Users } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { computeStats } from '../lib/scoring';
import { formatScore } from '../lib/format';
import type { TabKey } from '../components/nav-bar';

interface LeaderboardPageProps {
  onNavigate: (tab: TabKey) => void;
}

const RANK_BADGE = ['text-gain', 'text-ink-muted', 'text-[#d09a5d]'];

export function LeaderboardPage({ onNavigate }: LeaderboardPageProps) {
  const { players, games } = useAppStore();

  const stats = useMemo(() => computeStats(players, games), [players, games]);

  const totalKills = games.reduce(
    (sum, g) => sum + Object.values(g.kills).reduce((a, b) => a + b, 0),
    0,
  );
  const totalWins = games.reduce((sum, g) => sum + g.winnerIds.length, 0);

  if (games.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-line">
          <Trophy size={32} className="text-ink-muted" />
        </div>
        <h2 className="font-display text-xl font-semibold">还没有战绩</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          打完一局后点顶部「记一局」，录入每位队员的击杀数与吃鸡情况，
          <br />
          排行榜会逐局自动累计总分
        </p>
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
          总分排行榜
          <span className="ml-2 align-middle font-body text-xs font-normal text-ink-muted">
            SCOREBOARD · 跨局累计
          </span>
        </h1>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="tac-card px-4 py-3">
            <div className="num text-2xl font-bold text-primary">{games.length}</div>
            <div className="mt-0.5 text-xs text-ink-muted">累计对局</div>
          </div>
          <div className="tac-card px-4 py-3">
            <div className="num flex items-center gap-1.5 text-2xl font-bold text-primary">
              {totalKills} <Skull size={15} className="text-ink-muted" />
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">总击杀</div>
          </div>
          <div className="tac-card px-4 py-3">
            <div className="num flex items-center gap-1.5 text-2xl font-bold text-primary">
              {totalWins} <Trophy size={15} className="text-ink-muted" />
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">总吃鸡人次</div>
          </div>
          <div className="tac-card px-4 py-3">
            <div className="num flex items-center gap-1.5 text-2xl font-bold text-primary">
              {players.length} <Users size={15} className="text-ink-muted" />
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">固定队员</div>
          </div>
        </div>
      </header>

      <div className="tac-card overflow-hidden">
        <div className="hidden grid-cols-[56px_1fr_90px_90px_80px_120px] items-center gap-3 border-b border-line bg-panel-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted sm:grid">
          <span>排名</span>
          <span>队员</span>
          <span className="text-center">击杀</span>
          <span className="text-center">吃鸡</span>
          <span className="text-center">对局</span>
          <span className="text-right">累计总分</span>
        </div>
        <div className="divide-y divide-line/60">
          {stats.map((s, i) => {
            const top = i < 3;
            return (
              <div
                key={s.player.id}
                className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 sm:grid-cols-[56px_minmax(0,1fr)_90px_90px_80px_120px]"
              >
                {/* 排名徽章 */}
                <span
                  className={`num flex h-9 w-9 items-center justify-center rounded-lg bg-panel-2 font-display text-lg font-bold ${
                    top ? RANK_BADGE[i] : 'text-ink-muted'
                  }`}
                >
                  {i === 0 ? <Crown size={18} /> : i + 1}
                </span>
                {/* 队员名（独立列，不被排名列挤压） */}
                <div className="min-w-0">
                  <div className="whitespace-normal break-words text-[15px] font-bold leading-snug">
                    {s.player.name}
                  </div>
                  {/* 窄屏：次要信息行 */}
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-muted sm:hidden">
                    <span className="flex items-center gap-1">
                      <Skull size={11} /> {s.totalKills}
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy size={11} /> {s.wins}
                    </span>
                    <span>{s.games} 局</span>
                  </div>
                </div>
                <span className="hidden text-center text-sm text-ink-muted sm:block">
                  <span className="num font-semibold text-ink">{s.totalKills}</span> 杀
                </span>
                <span className="hidden text-center text-sm text-ink-muted sm:block">
                  <span className="num font-semibold text-ink">{s.wins}</span> 鸡
                </span>
                <span className="num hidden text-center text-sm text-ink-muted sm:block">
                  {s.games}
                </span>
                <div className="text-right">
                  <span
                    className={`num text-2xl font-bold ${
                      s.totalScore > 0
                        ? 'text-gain'
                        : s.totalScore < 0
                          ? 'text-loss'
                          : 'text-ink-muted'
                    }`}
                  >
                    {formatScore(s.totalScore)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
