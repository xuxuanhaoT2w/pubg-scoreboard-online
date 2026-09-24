import type { Game, GiftRule, Player, PlayerStats } from './types';

/**
 * 计算一局中每名参战玩家的得分（严格零和）。
 *
 * 击杀分：每 1 个人头，击杀者从其他每个参战者身上各得 1 分。
 *   - n 人参战时，一个人头值 n-1 分：击杀者 +(n-1)，其余每人 -1。
 *   - player i 的击杀分 = kills[i]*(n-1) - (总击杀 - kills[i]) = kills[i]*n - 总击杀。
 *
 * 吃鸡分：每名吃鸡者从未吃鸡者身上各得 5 分。
 *   - 吃鸡者 +5*(n-w)，未吃鸡者 -5*w；w=0 或 w=n 时不触发。
 */
export function scoreGame(
  participantIds: string[],
  kills: Record<string, number>,
  winnerIds: string[],
  giftRules: GiftRule[] = [],
): Record<string, number> {
  const n = participantIds.length;
  const winnerSet = new Set(winnerIds);
  const totalKills = participantIds.reduce((sum, id) => sum + (kills[id] ?? 0), 0);
  const w = participantIds.filter((id) => winnerSet.has(id)).length;
  const chickenActive = w > 0 && w < n;

  const scores: Record<string, number> = {};
  for (const id of participantIds) {
    const k = kills[id] ?? 0;
    // 击杀分
    let score = k * n - totalKills;
    // 吃鸡分
    if (chickenActive) {
      score += winnerSet.has(id) ? 5 * (n - w) : -5 * w;
    }
    scores[id] = score;
  }
  for (const rule of giftRules) {
    if (rule.fromId === rule.toId || !(rule.fromId in scores) || !(rule.toId in scores)) continue;
    if ((kills[rule.fromId] ?? 0) < 1) continue;
    scores[rule.fromId] -= 1;
    scores[rule.toId] += 1;
  }
  return scores;
}

/**
 * 基于全部对局重算每名玩家的累计数据（删除对局后自动回滚）。
 */
export function computeStats(players: Player[], games: Game[]): PlayerStats[] {
  const map = new Map<string, PlayerStats>();
  for (const player of players) {
    map.set(player.id, {
      player: { id: player.id, name: player.name },
      totalScore: 0,
      totalKills: 0,
      wins: 0,
      games: 0,
    });
  }

  for (const game of games) {
    const winnerSet = new Set(game.winnerIds);
    for (const id of game.participantIds) {
      const stats = map.get(id);
      if (!stats) continue;
      stats.games += 1;
      stats.totalScore += game.scores[id] ?? 0;
      stats.totalKills += game.kills[id] ?? 0;
      if (winnerSet.has(id)) stats.wins += 1;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      b.wins - a.wins ||
      b.totalKills - a.totalKills ||
      a.player.name.localeCompare(b.player.name, 'zh'),
  );
}
