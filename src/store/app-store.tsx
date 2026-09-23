import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Game, Player } from '../lib/types';
import {
  addPlayer as apiAddPlayer,
  createRoom as apiCreateRoom,
  deleteGameRow,
  deletePlayer as apiDeletePlayer,
  getDraft,
  getRoomById,
  getRoomByCode,
  initSupabase,
  insertGame,
  listGames,
  listPlayers,
  renamePlayer as apiRenamePlayer,
  saveDraft as apiSaveDraft,
  subscribeRoom,
  type DraftPayload,
  type RoomRow,
} from '../lib/supabase';

export type RoomStatus = 'checking' | 'no-room' | 'ready';

interface RoomStore {
  status: RoomStatus;
  ready: boolean;
  error: string | null;
  room: RoomRow | null;
  players: Player[];
  games: Game[];
  draft: DraftPayload | null;
  meId: string | null;
  // 房间
  createRoom: (name: string, seeds: string[]) => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => void;
  // 身份
  setMe: (playerId: string | null) => void;
  // 队员
  addPlayer: (name: string) => Promise<Player>;
  renamePlayer: (id: string, name: string) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  // 对局
  commitGame: (game: Omit<Game, 'id' | 'playedAt'>) => Promise<void>;
  removeGame: (id: string) => Promise<void>;
  // 草稿（多人协同当前一局），函数式更新：基于最新草稿计算，避免覆盖他人填写
  updateDraft: (updater: (prev: DraftPayload) => DraftPayload) => Promise<void>;
  // 工具
  playerName: (id: string) => string;
}

const RoomStoreContext = createContext<RoomStore | null>(null);

const ROOM_KEY = 'pubg.roomId';
const meKey = (roomId: string): string => `pubg.me.${roomId}`;

const DEFAULT_SEEDS = ['阿杰', '老K', '猴子', '狗子'];
const MAX_PLAYERS = 16;

function readRoomId(): string | null {
  try {
    return localStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}

export function RoomStoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RoomStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [draft, setDraftState] = useState<DraftPayload | null>(null);
  const draftRef = useRef<DraftPayload | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const [supabaseOk, setSupabaseOk] = useState(false);

  const setDraft = useCallback((next: DraftPayload | null) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);

  // 载入某房间的全部数据并建立实时订阅
  const loadRoom = useCallback(async (roomId: string) => {
    const [p, g, d] = await Promise.all([
      listPlayers(roomId),
      listGames(roomId),
      getDraft(roomId),
    ]);
    setPlayers(p);
    setGames(g);
    const playerIds = new Set(p.map((player) => player.id));
    setDraft({
      participantIds: d.participantIds.filter((id) => playerIds.has(id)),
      kills: Object.fromEntries(Object.entries(d.kills).filter(([id]) => playerIds.has(id))),
      winnerIds: d.winnerIds.filter((id) => playerIds.has(id)),
    });
    roomIdRef.current = roomId;
    try {
      localStorage.setItem(ROOM_KEY, roomId);
      setMeId(localStorage.getItem(meKey(roomId)));
    } catch {
      setMeId(null);
    }
  }, []);

  // 初始化 Supabase 并尝试进入上次房间
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await initSupabase();
        if (!alive) return;
        setSupabaseOk(true);
        const savedId = readRoomId();
        if (savedId) {
          const existing = await getRoomById(savedId);
          if (existing) {
            await loadRoom(savedId);
            if (alive) setRoom(existing);
            if (alive) setStatus('ready');
            return;
          }
          try {
            localStorage.removeItem(ROOM_KEY);
          } catch {
            /* ignore */
          }
        }
        if (alive) setStatus('no-room');
      } catch (e) {
        if (alive) {
          setSupabaseOk(false);
          setError(e instanceof Error ? e.message : '实时同步服务初始化失败');
          setStatus('no-room');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadRoom]);

  // 实时订阅：房间内 players/games/drafts 变化即重拉对应数据
  useEffect(() => {
    if (status !== 'ready' || !room) return;
    const unsubscribe = subscribeRoom(room.id, async (table) => {
      try {
        if (table === 'players') {
          setPlayers(await listPlayers(room.id));
        } else if (table === 'games') {
          setGames(await listGames(room.id));
        } else {
          setDraft(await getDraft(room.id));
        }
      } catch {
        /* 订阅回调中静默处理，下次会再同步 */
      }
    });
    return unsubscribe;
  }, [status, room]);

  const createRoom = useCallback(
    async (name: string, seeds: string[]) => {
      setError(null);
      const seedNames = seeds.length ? seeds : DEFAULT_SEEDS;
      if (seedNames.length > MAX_PLAYERS) throw new Error(`一个房间最多 ${MAX_PLAYERS} 名队员`);
      const normalized = seedNames.map((item) => item.trim()).filter(Boolean);
      if (new Set(normalized).size !== normalized.length) throw new Error('队员昵称不能重复');
      const { room: r, players: seedPlayers } = await apiCreateRoom(
        name.trim() || '开黑计分板',
        normalized,
      );
      // 草稿默认全员参战、击杀全 0、无人吃鸡
      const initial: DraftPayload = {
        participantIds: seedPlayers.map((p) => p.id),
        kills: Object.fromEntries(seedPlayers.map((p) => [p.id, 0])),
        winnerIds: [],
      };
      await apiSaveDraft(r.id, initial, 'system');
      await loadRoom(r.id);
      setPlayers(seedPlayers);
      setRoom(r);
      setStatus('ready');
      if (seedPlayers[0]) {
        try {
          localStorage.setItem(meKey(r.id), seedPlayers[0].id);
        } catch {
          /* ignore */
        }
        setMeId(seedPlayers[0].id);
      }
    },
    [loadRoom],
  );

  const joinRoom = useCallback(
    async (code: string) => {
      setError(null);
      const r = await getRoomByCode(code);
      await loadRoom(r.id);
      setRoom(r);
      setStatus('ready');
    },
    [loadRoom],
  );

  const leaveRoom = useCallback(() => {
    try {
      Object.keys(localStorage)
        .filter((key) => key === ROOM_KEY || key.startsWith('pubg.me.'))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      /* ignore */
    }
    roomIdRef.current = null;
    setRoom(null);
    setPlayers([]);
    setGames([]);
    setDraft(null);
    setMeId(null);
    setStatus('no-room');
  }, []);

  const setMe = useCallback(
    (playerId: string | null) => {
      setMeId(playerId);
      if (room) {
        try {
          if (playerId) localStorage.setItem(meKey(room.id), playerId);
          else localStorage.removeItem(meKey(room.id));
        } catch {
          /* ignore */
        }
      }
    },
    [room],
  );

  const addPlayer = useCallback(
    async (name: string) => {
      if (!room) throw new Error('尚未进入房间');
      const normalized = name.trim();
      if (!normalized) throw new Error('队员昵称不能为空');
      if (players.length >= MAX_PLAYERS) throw new Error(`一个房间最多 ${MAX_PLAYERS} 名队员`);
      if (players.some((player) => player.name === normalized)) throw new Error('队员昵称不能重复');
      const p = await apiAddPlayer(room.id, normalized);
      setPlayers((prev) => [...prev, p]);
      return p;
    },
    [room],
  );

  const renamePlayer = useCallback(
    async (id: string, name: string) => {
      const normalized = name.trim();
      if (!normalized) return;
      if (players.some((player) => player.id !== id && player.name === normalized)) {
        throw new Error('队员昵称不能重复');
      }
      await apiRenamePlayer(id, normalized);
      setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name: normalized } : p)));
    },
    [players],
  );

  const removePlayer = useCallback(
    async (id: string) => {
      if (games.some((g) => g.participantIds.includes(id))) {
        throw new Error('该队员已有对局记录，请先在历史中删除相关对局');
      }
      await apiDeletePlayer(id);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
      if (meId === id) setMe(null);
    },
    [games, meId, setMe],
  );

  const commitGame = useCallback(
    async (game: Omit<Game, 'id' | 'playedAt'>) => {
      if (!room) throw new Error('尚未进入房间');
      await insertGame(room.id, game);
      // 清空草稿，准备连录下一局（保留参战人员）
      const reset: DraftPayload = {
        participantIds: game.participantIds,
        kills: Object.fromEntries(game.participantIds.map((id) => [id, 0])),
        winnerIds: [],
      };
      await apiSaveDraft(room.id, reset, meId ?? 'system');
      // 房间只保留最近 5 场，避免历史无限增长。
      const allGames = await listGames(room.id);
      const staleGames = allGames
        .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
        .slice(5);
      await Promise.all(staleGames.map((stale) => deleteGameRow(stale.id)));
      const [g, d] = await Promise.all([listGames(room.id), getDraft(room.id)]);
      setGames(g);
      setDraft(d);
    },
    [room, meId],
  );

  const removeGame = useCallback(
    async (id: string) => {
      await deleteGameRow(id);
      if (room) setGames(await listGames(room.id));
    },
    [room],
  );

  const updateDraft = useCallback(
    async (updater: (prev: DraftPayload) => DraftPayload) => {
      if (!room) return;
      // 基于最新草稿计算，降低多人同时填写时整包覆盖的风险
      const base = draftRef.current ?? { participantIds: [], kills: {}, winnerIds: [] };
      const next = updater(base);
      setDraft(next); // 乐观更新，本地即时反馈
      try {
        await apiSaveDraft(room.id, next, meId ?? 'anon');
      } catch {
        // 保存失败时下次实时订阅会回拉，这里不打断输入
      }
    },
    [room, meId, setDraft],
  );

  const playerName = useCallback(
    (id: string): string => players.find((p) => p.id === id)?.name ?? '已移除队员',
    [players],
  );

  const value = useMemo<RoomStore>(
    () => ({
      status,
      ready: status === 'ready',
      error,
      room,
      players,
      games,
      draft,
      meId,
      createRoom,
      joinRoom,
      leaveRoom,
      setMe,
      addPlayer,
      renamePlayer,
      removePlayer,
      commitGame,
      removeGame,
      updateDraft,
      playerName,
    }),
    [
      status,
      error,
      room,
      players,
      games,
      draft,
      meId,
      createRoom,
      joinRoom,
      leaveRoom,
      setMe,
      addPlayer,
      renamePlayer,
      removePlayer,
      commitGame,
      removeGame,
      updateDraft,
      playerName,
    ],
  );

  // supabaseOk 用于让入口页区分「服务未开通」与「未进入房间」
  void supabaseOk;

  return <RoomStoreContext.Provider value={value}>{children}</RoomStoreContext.Provider>;
}

export function useAppStore(): RoomStore {
  const ctx = useContext(RoomStoreContext);
  if (!ctx) throw new Error('useAppStore 必须在 RoomStoreProvider 内使用');
  return ctx;
}
