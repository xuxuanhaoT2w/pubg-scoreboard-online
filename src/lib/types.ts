export interface Player {
  id: string;
  name: string;
}

export interface Game {
  id: string;
  matchId?: string;
  playedAt: string;
  participantIds: string[];
  /** playerId -> 本局击杀数 */
  kills: Record<string, number>;
  /** 吃鸡玩家 id 列表 */
  winnerIds: string[];
  /** 本局满足击杀条件后的定向赠分规则 */
  giftRules?: GiftRule[];
  /** playerId -> 本局得分（零和） */
  scores: Record<string, number>;
}

export interface GiftRule {
  fromId: string;
  toId: string;
}

export interface Match {
  id: string;
  roomId: string;
  name: string;
  status: 'active' | 'ended';
  startedAt: string;
  endedAt: string | null;
}

export interface PlayerStats {
  player: Player;
  totalScore: number;
  totalKills: number;
  wins: number;
  games: number;
}
