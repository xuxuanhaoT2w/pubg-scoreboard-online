import { Users } from 'lucide-react';
import { useAppStore } from '../store/app-store';

/** 全局显示房间成员的实时在线和录入状态。 */
export function MemberPresenceBar() {
  const { players, onlinePlayerIds, editingPlayerIds, editingActivities, onlineTemporaryCount } = useAppStore();

  return (
    <div className="border-b border-line bg-panel/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5 px-4 py-2 text-xs sm:px-6">
        <span className="mr-1 flex items-center gap-1 text-ink-muted"><Users size={13} /> 成员状态</span>
        {players.map((player) => {
          const editing = editingPlayerIds.includes(player.id);
          const online = onlinePlayerIds.includes(player.id);
          return (
            <span key={player.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${editing ? 'border-primary/50 bg-primary/10 text-primary' : online ? 'border-gain/40 bg-gain/10 text-gain' : 'border-line bg-panel-2 text-ink-muted'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${editing ? 'animate-pulse bg-primary' : online ? 'bg-gain' : 'bg-ink-muted/50'}`} />
              {player.name}<span className="text-[10px] opacity-75">{editing ? editingActivities[player.id] ?? '编辑中' : online ? '在线' : '离线'}</span>
            </span>
          );
        })}
        {onlineTemporaryCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-line bg-panel-2 px-2 py-1 text-ink-muted"><span className="h-1.5 w-1.5 rounded-full bg-ink-muted/50" /> 临时用户 ×{onlineTemporaryCount}</span>}
      </div>
    </div>
  );
}
