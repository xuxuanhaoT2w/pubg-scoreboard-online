export interface Player {
  id: string;
  name: string;
}

export interface Game {
  id: string;
  playedAt: string;
  participantIds: string[];
  /** playerId -> 本局击杀数 */
  kills: Record<string, number>;
  /** 吃鸡玩家 id 列表 */
  winnerIds: string[];
  /** playerId -> 本局得分（零和） */
  scores: Record<string, number>;
}

export interface PlayerStats {
  player: Player;
  totalScore: number;
  totalKills: number;
  wins: number;
  games: number;
}
