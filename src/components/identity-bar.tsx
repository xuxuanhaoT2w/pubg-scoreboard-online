import { useState } from 'react';
import { Check, ListChecks, User } from 'lucide-react';
import { useAppStore } from '../store/app-store';

/** 顶部「我是谁」选择条：每个人先选自己的名字，录入自己那行时高亮 */
export function IdentityBar() {
  const { players, meId, setMe, draft, updateDraft } = useAppStore();
  const [open, setOpen] = useState(false);
  const me = players.find((p) => p.id === meId);
  const allSelected = players.length > 0 && players.every((p) => draft?.participantIds.includes(p.id));

  const selectParticipants = (all: boolean) => {
    void updateDraft((prev) => {
      const ids = all ? players.map((p) => p.id) : [];
      return {
        ...prev,
        participantIds: ids,
        kills: Object.fromEntries(ids.map((id) => [id, prev.kills[id] ?? 0])),
        winnerIds: [],
      };
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-ink-muted">
          <User size={14} /> 我是
        </span>
        {me ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="tac-chip flex items-center gap-1.5 border-primary/60 text-primary"
          >
            {me.name}
          </button>
        ) : (
          <button type="button" className="tac-chip text-primary" onClick={() => setOpen(true)}>
            点击选择你的名字
          </button>
        )}

        {open && (
          <div className="flex flex-wrap items-center gap-1.5">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setMe(p.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  p.id === meId
                    ? 'border-primary text-primary'
                    : 'border-line bg-panel text-ink-muted hover:border-primary/40'
                }`}
              >
                {p.id === meId && <Check size={12} />}
                {p.name}
              </button>
            ))}
          </div>
        )}
        <span className="ml-1 hidden items-center gap-1 text-ink-muted sm:flex">
          <ListChecks size={14} /> 本局人员
        </span>
        <button type="button" className="tac-chip text-xs" onClick={() => selectParticipants(true)}>
          {allSelected ? '已全选' : '全员参战'}
        </button>
        <button type="button" className="tac-chip text-xs" onClick={() => selectParticipants(false)}>
          清空
        </button>
      </div>
    </div>
  );
}
