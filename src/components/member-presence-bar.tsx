import { PencilLine, Radio, UserRound, Users } from 'lucide-react';
import { useAppStore } from '../store/app-store';

/** 全局显示房间成员的实时在线和录入状态。 */
export function MemberPresenceBar() {
  const { players, onlinePlayerIds, editingPlayerIds, editingActivities, onlineTemporaryCount, temporaryActivities } = useAppStore();
  const onlineCount = onlinePlayerIds.length + onlineTemporaryCount;

  return (
    <div className="border-b border-line bg-panel/70">
      <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-ink"><Users size={14} className="text-primary" /> 房间协作</span>
          <span className="text-ink-muted">成员在线与编辑状态实时同步</span>
          <span className={`ml-auto flex items-center gap-1.5 font-semibold ${onlineCount > 0 ? 'text-gain' : 'text-ink-muted'}`}><Radio size={13} className={onlineCount > 0 ? 'animate-pulse' : ''} /> 在线 {onlineCount}<span className="text-ink-muted">/ {players.length + onlineTemporaryCount}</span></span>
        </div>
        <div className="flex flex-wrap gap-1.5">
        {players.map((player) => {
          const editing = editingPlayerIds.includes(player.id);
          const online = onlinePlayerIds.includes(player.id);
          return (
            <span key={player.id} className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs ${editing ? 'border-primary/50 bg-primary/10 text-primary' : online ? 'border-gain/40 bg-gain/10 text-gain' : 'border-line bg-panel-2 text-ink-muted'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${editing ? 'animate-pulse bg-primary' : online ? 'bg-gain' : 'bg-ink-muted/50'}`} />
              <span className="font-semibold">{player.name}</span>{editing ? <span className="flex items-center gap-0.5 text-[10px] opacity-85"><PencilLine size={10} />{editingActivities[player.id] ?? '编辑中'}</span> : <span className="text-[10px] opacity-75">{online ? '在线' : '离线'}</span>}
            </span>
          );
        })}
        {Array.from({ length: onlineTemporaryCount }, (_, index) => (
          <span key={`temporary-${index}`} className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs ${temporaryActivities[index] ? 'border-primary/50 bg-primary/10 text-primary' : 'border-gain/40 bg-gain/10 text-gain'}`}>
            <UserRound size={12} /><span className="font-semibold">临时用户 {index + 1}</span><span className="text-[10px] opacity-75">{temporaryActivities[index] ?? '在线'}</span>
          </span>
        ))}
        {players.length === 0 && onlineTemporaryCount === 0 && <span className="text-xs text-ink-muted">暂无房间成员</span>}
        </div>
      </div>
    </div>
  );
}
