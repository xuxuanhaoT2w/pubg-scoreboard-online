import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Player, Game } from './types';
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
}

export const EMPTY_DRAFT: DraftPayload = { participantIds: [], kills: {}, winnerIds: [] };

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
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .ilike('join_code', code.trim())
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('房间码不存在，请检查后重试');
  return data as RoomRow;
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
export async function listGames(roomId: string): Promise<Game[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('room_id', roomId)
    .order('played_at', { ascending: false });
  if (error) throw error;
  return (data as GameRow[]).map(rowToGame);
}

export async function insertGame(roomId: string, game: Omit<Game, 'id' | 'playedAt'>): Promise<Game> {
  const { data, error } = await db()
    .from('games')
    .insert({ room_id: roomId, data: game })
    .select('*')
    .single();
  if (error) throw error;
  return rowToGame(data as GameRow);
}

export async function deleteGameRow(gameId: string): Promise<void> {
  const { error } = await db().from('games').delete().eq('id', gameId);
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
  onChange: (table: 'players' | 'games' | 'drafts') => void,
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

// ---------- 行映射 ----------
function rowToPlayer(r: PlayerRow): Player {
  return { id: r.id, name: r.name };
}

function rowToGame(r: GameRow): Game {
  return {
    id: r.id,
    playedAt: r.played_at,
    participantIds: r.data.participantIds,
    kills: r.data.kills,
    winnerIds: r.data.winnerIds,
    scores: r.data.scores,
  };
}
