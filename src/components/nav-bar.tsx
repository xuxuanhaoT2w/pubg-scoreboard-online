import type { LucideIcon } from 'lucide-react';
import { Crosshair, History, Settings } from 'lucide-react';

export type TabKey = 'record' | 'history' | 'matches' | 'settings' | 'room-manager';

const NAV_ITEMS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'history', label: '历史', icon: History },
  { key: 'settings', label: '房间', icon: Settings },
];

interface NavBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export function NavBar({ active, onChange }: NavBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/95 shadow-[0_5px_18px_rgba(0,0,0,0.18)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6">
        <button
          type="button"
          onClick={() => onChange('record')}
          className="flex items-center gap-2.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-black shadow-[0_3px_12px_rgba(245,166,35,0.24)]">
            <Crosshair size={18} strokeWidth={2.5} />
          </span>
          <span className="font-display text-base font-bold tracking-wide sm:text-lg">
            开黑计分板
            <span className="ml-2 hidden font-body text-[10px] font-normal tracking-[0.35em] text-ink-muted md:inline">
              PUBG SCOREBOARD
            </span>
          </span>
        </button>

        <nav className="ml-auto flex items-center gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChange(item.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`tac-btn h-9 w-9 gap-1.5 px-0 text-sm sm:w-auto sm:px-3 ${
                  isActive
                    ? 'border border-primary/60 bg-primary/15 text-primary'
                    : 'tac-btn-ghost'
                }`}
              >
                <Icon size={16} strokeWidth={isActive ? 2.6 : 2} />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onChange('record')}
            aria-current={active === 'record' ? 'page' : undefined}
            className={`tac-btn tac-btn-primary ml-0.5 h-10 gap-1.5 px-3 text-sm sm:ml-1 sm:px-4 ${
              active === 'record' ? 'ring-2 ring-primary/40' : ''
            }`}
          >
            <Crosshair size={16} strokeWidth={2.6} />
            <span className="hidden sm:inline">录入对局</span><span className="sm:hidden">录入</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
