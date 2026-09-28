import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Player, Game, GiftRule, Match } from './types';
import { publicSupabaseConfig } from './public-supabase-config';

// ---------- 数据库行类型（snake_case，与表结构对应） ----------
export interface RoomRow {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  name: string;
  created_at: string;
}

export interface GameRow {
  id: string;
  room_id: string;
  data: Omit<Game, 'id' | 'playedAt'>;
  played_at: string;
  match_id: string | null;
}

export interface MatchRow {
  id: string;
  room_id: string;
  name: string;
  status: 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
}

export interface DraftRow {
  id: string;
  room_id: string;
  payload: DraftPayload;
  updated_by: string | null;
  updated_at: string;
}

// 当前进行中一局的共享草稿
export interface DraftPayload {
  participantIds: string[];
  kills: Record<string, number>;
  winnerIds: string[];
  zeroKillsAsOneIds?: string[];
  giftRules?: GiftRule[];
}

export const EMPTY_DRAFT: DraftPayload = { participantIds: [], kills: {}, winnerIds: [], zeroKillsAsOneIds: [], giftRules: [] };

let client: SupabaseClient | null = null;
let clientConfig: { url: string; anonKey: string } | null = null;

/**
 * 直接使用公开 publishable key，兼容 GitHub Pages 等纯静态托管。
 * 公开 key 不包含服务端权限，所有数据访问仍由 Supabase RLS 控制。
 */
export async function initSupabase(): Promise<SupabaseClient> {
  if (client) return client;
  clientConfig = { url: publicSupabaseConfig.url, anonKey: publicSupabaseConfig.publishableKey };
  client = createClient(clientConfig.url, clientConfig.anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

function db(): SupabaseClient {
  if (!client) throw new Error('Supabase 尚未初始化');
  return client;
}

// ---------- 房间 ----------
export function genJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆字符
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function createRoom(
  name: string,
  seedPlayers: string[],
): Promise<{ room: RoomRow; players: Player[] }> {
  const supabase = db();
  // 房间码极小概率碰撞，重试几次
  let roomRow: RoomRow | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = genJoinCode();
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ name, join_code: code })
      .select('*')
      .single();
    if (error) {
      if (String(error.message).includes('duplicate') || String(error.code) === '23505') continue;
      throw error;
    }
    roomRow = room as RoomRow;
    break;
  }
  if (!roomRow) throw new Error('房间创建失败，请重试');

  // 预置队员
  const rows = seedPlayers.map((pname) => ({ room_id: roomRow!.id, name: pname }));
  const { data: created, error: pErr } = await supabase
    .from('players')
    .insert(rows)
    .select('*');
  if (pErr) throw pErr;
  const players = (created as PlayerRow[]).map(rowToPlayer);
  return { room: roomRow, players };
}

export async function getRoomByCode(code: string): Promise<RoomRow> {
  const supabase = db();
  const normalizedCode = extractJoinCode(code);
  if (!normalizedCode) throw new Error('请提供有效的 6 位房间码或完整邀请链接');
  return retryCloudRead(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('join_code', normalizedCode)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('房间码不存在，请检查后重试');
    return data as RoomRow;
  });
}

/** 支持 6 位房间码、完整邀请链接及带版本参数的历史分享链接。 */
export function extractJoinCode(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const code = url.searchParams.get('join') ?? url.searchParams.get('c');
    if (code) return extractJoinCode(code);
  } catch {
    // 不是 URL 时按普通房间码处理
  }
  const match = raw.match(/[A-HJ-NP-Z2-9]{6}/i);
  return match ? match[0].toUpperCase() : null;
}

export async function getRoomById(id: string): Promise<RoomRow | null> {
  const supabase = db();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as RoomRow) ?? null;
}

export async function listRooms(): Promise<RoomRow[]> {
  return retryCloudRead(async () => {
    const { data, error } = await db().from('rooms').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data as RoomRow[];
  });
}

/** 中国网络下偶发的连接建立失败会在短时间内恢复；只对网络错误退避重试。 */
async function retryCloudRead<T>(read: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/failed to fetch|network|timeout/i.test(message) || attempt === 4) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function deleteRoom(roomId: string): Promise<void> {
  const { error } = await db().from('rooms').delete().eq('id', roomId);
  if (error) throw error;
}

export async function deleteAllRooms(): Promise<void> {
  const rooms = await listRooms();
  await Promise.all(rooms.map((room) => deleteRoom(room.id)));
}

// ---------- 全局人员库 ----------
export async function listGlobalPlayers(): Promise<Player[]> {
  const { data, error } = await db().from('global_players').select('*').order('created_at');
  if (error) throw error;
  return (data as Array<{ id: string; name: string }>).map((row) => ({ id: row.id, name: row.name }));
}

export async function addGlobalPlayer(name: string): Promise<Player> {
  const { data, error } = await db()
    .from('global_players')
    .insert({ name: name.trim() })
    .select('*')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name };
}

export async function deleteGlobalPlayer(id: string): Promise<void> {
  const { error } = await db().from('global_players').delete().eq('id', id);
  if (error) throw error;
}

// ---------- 队员 ----------
export async function listPlayers(roomId: string): Promise<Player[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as PlayerRow[]).map(rowToPlayer);
}

export async function addPlayer(roomId: string, name: string): Promise<Player> {
  const supabase = db();
  const { data, error } = await supabase
    .from('players')
    .insert({ room_id: roomId, name: name.trim() })
    .select('*')
    .single();
  if (error) throw error;
  return rowToPlayer(data as PlayerRow);
}

export async function renamePlayer(playerId: string, name: string): Promise<void> {
  const { error } = await db()
    .from('players')
    .update({ name: name.trim() })
    .eq('id', playerId);
  if (error) throw error;
}

export async function deletePlayer(playerId: string): Promise<void> {
  const { error } = await db().from('players').delete().eq('id', playerId);
  if (error) throw error;
}

// ---------- 对局 ----------
export async function listGames(roomId: string, matchId?: string): Promise<Game[]> {
  let query = db()
    .from('games')
    .select('*')
    .eq('room_id', roomId)
    .order('played_at', { ascending: false });
  if (matchId) query = query.eq('match_id', matchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as GameRow[]).map(rowToGame);
}

export async function insertGame(
  roomId: string,
  matchId: string,
  game: Omit<Game, 'id' | 'playedAt' | 'matchId'>,
): Promise<Game> {
  const { data, error } = await db()
    .from('games')
    .insert({ room_id: roomId, match_id: matchId, data: game })
    .select('*')
    .single();
  if (error) throw error;
  return rowToGame(data as GameRow);
}

// ---------- 场次 ----------
export async function createMatch(roomId: string, name: string): Promise<Match> {
  const { data, error } = await db()
    .from('matches')
    .insert({ room_id: roomId, name })
    .select('*')
    .single();
  if (error) throw error;
  return rowToMatch(data as MatchRow);
}

export async function listMatches(roomId: string): Promise<Match[]> {
  const { data, error } = await db()
    .from('matches')
    .select('*')
    .eq('room_id', roomId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data as MatchRow[]).map(rowToMatch);
}

export async function endMatch(matchId: string): Promise<void> {
  const { error } = await db()
    .from('matches')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', matchId);
  if (error) throw error;
}

export async function deleteGameRow(gameId: string): Promise<void> {
  const { error } = await db().from('games').delete().eq('id', gameId);
  if (error) throw error;
}

export async function deleteMatchGames(roomId: string, matchId: string): Promise<void> {
  const { error } = await db().from('games').delete().eq('room_id', roomId).eq('match_id', matchId);
  if (error) throw error;
}

// ---------- 草稿 ----------
export async function getDraft(roomId: string): Promise<DraftPayload> {
  const supabase = db();
  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as DraftRow).payload : { ...EMPTY_DRAFT };
}

export async function saveDraft(roomId: string, payload: DraftPayload, updatedBy: string): Promise<void> {
  const supabase = db();
  const { data: existing } = await supabase
    .from('drafts')
    .select('id')
    .eq('room_id', roomId)
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    const { error } = await supabase
      .from('drafts')
      .update({ payload, updated_by: updatedBy, updated_at: now })
      .eq('room_id', roomId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('drafts')
      .insert({ room_id: roomId, payload, updated_by: updatedBy, updated_at: now });
    if (error) throw error;
  }
}

// ---------- 实时订阅 ----------
export function subscribeRoom(
  roomId: string,
  onChange: (table: 'players' | 'games' | 'drafts' | 'matches') => void,
): () => void {
  const supabase = db();
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
      () => onChange('players'),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches', filter: `room_id=eq.${roomId}` },
      () => onChange('matches'),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${roomId}` },
      () => onChange('games'),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'drafts', filter: `room_id=eq.${roomId}` },
      () => onChange('drafts'),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeRoomPresence(
  roomId: string,
  playerId: string | null,
  initialActivity: string | null,
  onChange: (playerIds: string[], temporaryCount: number, editingPlayerIds: string[], activities: Record<string, string>, temporaryActivities: string[]) => void,
): { setActivity: (activity: string | null) => void; unsubscribe: () => void } {
  const channel = db().channel(`presence:${roomId}`, { config: { presence: { key: crypto.randomUUID() } } });
  let activity = initialActivity;
  const publish = () => {
    const ids = new Set<string>();
    const editingIds = new Set<string>();
    const activities: Record<string, string> = {};
    const temporaryActivities: string[] = [];
    let temporaryCount = 0;
    Object.values(channel.presenceState()).flat().forEach((item) => {
      const member = item as { playerId?: unknown; activity?: unknown };
      const id = member.playerId;
      if (typeof id === 'string') {
        ids.add(id);
        if (typeof member.activity === 'string' && member.activity) {
          editingIds.add(id);
          activities[id] = member.activity;
        }
      }
      else {
        temporaryCount += 1;
        if (typeof member.activity === 'string' && member.activity) temporaryActivities.push(member.activity);
      }
    });
    onChange([...ids], temporaryCount, [...editingIds], activities, temporaryActivities);
  };
  channel
    .on('presence', { event: 'sync' }, publish)
    .on('presence', { event: 'join' }, publish)
    .on('presence', { event: 'leave' }, publish)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track({ playerId, activity }).then(publish);
    });
  return {
    setActivity: (nextActivity) => {
      activity = nextActivity;
      void channel.track({ playerId, activity }).then(publish);
    },
    unsubscribe: () => { void db().removeChannel(channel); },
  };
}

// ---------- 行映射 ----------
function rowToPlayer(r: PlayerRow): Player {
  return { id: r.id, name: r.name };
}

function rowToGame(r: GameRow): Game {
  return {
    id: r.id,
    matchId: r.match_id ?? undefined,
    playedAt: r.played_at,
    participantIds: r.data.participantIds,
    kills: r.data.kills,
    zeroKillsAsOneIds: r.data.zeroKillsAsOneIds,
    winnerIds: r.data.winnerIds,
    giftRules: r.data.giftRules,
    scores: r.data.scores,
  };
}

function rowToMatch(r: MatchRow): Match {
  return {
    id: r.id,
    roomId: r.room_id,
    name: r.name,
    status: r.status,
    startedAt: r.started_at,
    endedAt: r.ended_at,
  };
}
