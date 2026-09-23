import type { LucideIcon } from 'lucide-react';
import { Crosshair, History, Settings, Trophy } from 'lucide-react';

export type TabKey = 'leaderboard' | 'record' | 'history' | 'settings';

const NAV_ITEMS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'leaderboard', label: '排行榜', icon: Trophy },
  { key: 'history', label: '历史', icon: History },
  { key: 'settings', label: '设置', icon: Settings },
];

interface NavBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export function NavBar({ active, onChange }: NavBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => onChange('leaderboard')}
          className="flex items-center gap-2.5"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-black">
            <Crosshair size={18} strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg font-bold tracking-wide">
            开黑计分板
            <span className="ml-2 hidden font-body text-[10px] font-normal tracking-[0.35em] text-ink-muted md:inline">
              PUBG SCOREBOARD
            </span>
          </span>
        </button>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChange(item.key)}
                className={`tac-btn h-9 gap-1.5 px-3 text-sm ${
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
            className={`tac-btn tac-btn-primary ml-1 h-9 gap-1.5 px-4 text-sm ${
              active === 'record' ? 'ring-2 ring-primary/40' : ''
            }`}
          >
            <Crosshair size={16} strokeWidth={2.6} />
            记一局
          </button>
        </nav>
      </div>
    </header>
  );
}
