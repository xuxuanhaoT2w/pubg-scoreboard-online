import { useEffect, useMemo, useState } from 'react';
import { Archive, ClipboardList, Download, FileSpreadsheet, Trash2, Trophy } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { useConfirm } from '../components/confirm-dialog';
import { useToast } from '../components/toast';
import { listGames } from '../lib/supabase';
import { computeStats, playersWithGameSnapshots } from '../lib/scoring';
import { formatDateTime, formatScore } from '../lib/format';
import type { Game, Match } from '../lib/types';

function downloadFile(content: BlobPart, type: string, filename: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function MatchesPage() {
  const { room, matches, players, playerName, deleteEndedMatch } = useAppStore();
  const confirm = useConfirm();
  const toast = useToast();
  const ended = matches.filter((match) => match.status === 'ended');
  const [selected, setSelected] = useState<Match | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!selected || !room) { setGames([]); return; }
    void listGames(room.id, selected.id).then(setGames).catch(() => setGames([]));
  }, [selected, room]);

  const stats = useMemo(() => computeStats(playersWithGameSnapshots(players, games), games).filter((item) => item.games > 0), [players, games]);
  const nameForGame = (game: Game, id: string) => game.playerNames?.[id] ?? playerName(id);
  const handleDelete = async (match: Match) => {
    const ok = await confirm({ title: `删除历史场次「${match.name}」？`, message: '将永久删除该场次的全部对局、积分和排名，无法恢复。', confirmText: '永久删除', cancelText: '取消', danger: true });
    if (!ok) return;
    try {
      await deleteEndedMatch(match.id);
      if (selected?.id === match.id) setSelected(null);
      toast.success('历史场次已删除');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除历史场次失败');
    }
  };

  const handleExport = async () => {
    if (!room || exporting || ended.length === 0) return;
    setExporting(true);
    try {
      const orderedMatches = [...ended].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      const gamesByMatch = await Promise.all(orderedMatches.map(async (match) => ({
        matchId: match.id,
        games: await listGames(room.id, match.id),
      })));
      const backup = {
        format: 'pubg-scoreboard-history-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        room: { id: room.id, name: room.name, joinCode: room.join_code },
        players,
        matches: orderedMatches,
        gamesByMatch,
      };
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadFile(JSON.stringify(backup, null, 2), 'application/json;charset=utf-8', `${room.name.replace(/[\\/:*?"<>|]/g, '_')}-历史场次备份-${stamp}.json`);
      toast.success(`已导出 ${orderedMatches.length} 个历史场次备份`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '历史场次导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleExportTable = async () => {
    if (!room || exporting || ended.length === 0) return;
    setExporting(true);
    try {
      const orderedMatches = [...ended].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      const gamesByMatch = await Promise.all(orderedMatches.map(async (match) => ({ match, games: await listGames(room.id, match.id) })));
      const header = ['房间名称', '房间码', '场次', '对局序号', '对局时间', '队员昵称', '击杀', '是否吃鸡', '本局积分', '零杀按一杀', '赠分给'];
      const rows = gamesByMatch.flatMap(({ match, games: matchGames }) => matchGames.flatMap((game, gameIndex) => game.participantIds.map((id) => {
        const gifts = game.giftRules?.filter((rule) => rule.fromId === id)
          .map((rule) => game.playerNames?.[rule.toId] ?? players.find((player) => player.id === rule.toId)?.name ?? '已移除队员') ?? [];
        return [room.name, room.join_code, match.name, matchGames.length - gameIndex, formatDateTime(game.playedAt), game.playerNames?.[id] ?? playerName(id), game.kills[id] ?? 0, game.winnerIds.includes(id) ? '是' : '否', game.scores[id] ?? 0, game.zeroKillsAsOneIds?.includes(id) ? '是' : '否', gifts.join('、')];
      })));
      const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadFile(csv, 'text/csv;charset=utf-8', `${room.name.replace(/[\\/:*?"<>|]/g, '_')}-历史对局表-${stamp}.csv`);
      toast.success(`已导出 ${rows.length} 条对局明细`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '历史对局表格导出失败');
    } finally {
      setExporting(false);
    }
  };

  if (ended.length === 0) return <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center"><div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-line"><Archive size={32} className="text-ink-muted" /></div><h2 className="font-display text-xl font-semibold">暂无历史场次</h2><p className="mt-2 text-sm text-ink-muted">在录入页结束当前场次后，这里会保留该场的积分和对局明细。</p></div>;

  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6"><header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl font-bold tracking-wide">查看历史场次 <span className="ml-2 font-body text-xs font-normal text-ink-muted">MATCH HISTORY</span></h1><div className="flex flex-wrap gap-2"><button type="button" className="tac-btn h-10 gap-2 px-4 text-sm" onClick={() => void handleExportTable()} disabled={exporting}><FileSpreadsheet size={16} />{exporting ? '正在导出…' : '导出对局表格'}</button><button type="button" className="tac-btn h-10 gap-2 px-4 text-sm" onClick={() => void handleExport()} disabled={exporting}><Download size={16} />{exporting ? '正在导出…' : '导出完整备份'}</button></div></header><p className="-mt-2 mb-5 text-xs text-ink-muted">表格可直接用 Excel 打开；完整备份保留全部历史数据，适合本地留存和应急恢复。</p><div className="grid gap-5 lg:grid-cols-[280px_1fr]"><aside className="space-y-2">{ended.map((match) => <div key={match.id} className={`flex rounded-lg border ${selected?.id === match.id ? 'border-primary bg-primary/10' : 'border-line bg-panel-2'}`}><button type="button" onClick={() => setSelected(match)} className="min-w-0 flex-1 p-3 text-left"><div className="truncate font-semibold">{match.name}</div><div className="mt-1 text-xs text-ink-muted">结束：{match.endedAt ? formatDateTime(match.endedAt) : '—'}</div></button><button type="button" aria-label={`删除${match.name}`} className="m-2 flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-loss/15 hover:text-loss" onClick={() => void handleDelete(match)}><Trash2 size={15} /></button></div>)}</aside><section className="tac-card p-5">{!selected ? <p className="py-10 text-center text-sm text-ink-muted">选择左侧场次查看积分和明细</p> : <><div className="mb-4 flex items-center gap-2"><Trophy size={18} className="text-primary" /><h2 className="font-display text-lg font-bold">{selected.name} · {games.length} 局</h2></div><div className="space-y-2">{stats.map((item, index) => <div key={item.player.id} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2"><span className="num w-5 text-ink-muted">{index + 1}</span><span className="flex-1 font-semibold">{item.player.name}</span><span className="text-xs text-ink-muted">{item.games} 局 · {item.totalKills} 杀 · {item.wins} 鸡</span><span className={`num text-lg font-bold ${item.totalScore > 0 ? 'text-gain' : item.totalScore < 0 ? 'text-loss' : 'text-ink-muted'}`}>{formatScore(item.totalScore)}</span></div>)}</div><div className="mt-5 border-t border-line pt-4"><h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold"><ClipboardList size={15} className="text-primary" /> 对局明细</h3><div className="space-y-2">{games.map((game, index) => <div key={game.id} className="rounded-lg border border-line bg-panel-2 p-3"><div className="mb-2 text-xs text-ink-muted">第 {games.length - index} 局 · {formatDateTime(game.playedAt)}</div>{game.participantIds.map((id) => <div key={id} className="flex justify-between py-0.5 text-sm"><span>{nameForGame(game, id)} · {game.kills[id] ?? 0} 杀</span><span className="num">{formatScore(game.scores[id] ?? 0)}</span></div>)}</div>)}</div></div></>}</section></div></div>;
}
