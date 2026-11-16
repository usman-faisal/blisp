import React from 'react';
import {
  ArrowLeft,
  Bell,
  ChevronLeft,
  Egg,
  Rocket,
  User,
  Wifi,
  Zap,
} from 'lucide-react';

export type BottomNavTab = 'focus' | 'incubator' | 'projects' | 'alerts' | 'profile';

interface ScreenShellProps {
  children: React.ReactNode;
  activeTab?: BottomNavTab;
  time?: string;
  battery?: string;
}

export const ScreenShell: React.FC<ScreenShellProps> = ({
  children,
  activeTab,
  time = '9:01',
  battery = '88',
}) => {
  return (
    <div className="w-full h-full flex flex-col justify-between bg-[#F5F2EC] dark:bg-[#141210] text-[#1C1815] dark:text-[#F5F2EC] select-none overflow-hidden text-left">
      {/* Android-style Status Bar matching screenshots */}
      <div className="px-4 pt-2 pb-1 flex items-center justify-between text-[9px] font-semibold tracking-tight text-[#322C25]/80 dark:text-[#F5F2EC]/75 shrink-0">
        <span className="tabular-nums">{time}</span>
        <div className="flex items-center gap-1.5">
          <Wifi className="w-2.5 h-2.5" strokeWidth={2} />
          <span className="px-1.5 py-[1px] rounded-full bg-[#322C25]/12 dark:bg-[#F5F2EC]/16 text-[8px] font-bold tabular-nums leading-none">
            {battery}
          </span>
        </div>
      </div>

      {/* Main Scroll-Clipped Screen Body */}
      <div className="flex-1 min-h-0 flex flex-col px-3.5 pt-1 pb-2 overflow-hidden">
        {children}
      </div>

      {/* Optional 5-Tab Bottom Navigation Bar */}
      {activeTab ? (
        <div className="shrink-0 bg-[#EFEBE2] dark:bg-[#1B1814] border-t border-[#D8D2CA] dark:border-[#332C25] px-2 pt-1.5 pb-3">
          <div className="grid grid-cols-5 items-center text-center">
            {(
              [
                { id: 'focus', label: 'Focus', Icon: Zap },
                { id: 'incubator', label: 'Incubator', Icon: Egg },
                { id: 'projects', label: 'Projects', Icon: Rocket },
                { id: 'alerts', label: 'Alerts', Icon: Bell },
                { id: 'profile', label: 'Profile', Icon: User },
              ] as const
            ).map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              return (
                <div
                  key={id}
                  className={`flex flex-col items-center gap-0.5 ${
                    isActive
                      ? 'text-[#C59B38] dark:text-[#D6AB4E]'
                      : 'text-[#8C867E] dark:text-[#7D766D]'
                  }`}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    strokeWidth={isActive ? 2 : 1.65}
                    fill={isActive ? 'currentColor' : 'none'}
                  />
                  <span className="text-[8px] font-medium leading-none">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="h-3 shrink-0" />
      )}
    </div>
  );
};

interface BackHeaderProps {
  title?: string;
  subtitle?: string;
  chevronStyle?: 'arrow' | 'chevron';
  rightSlot?: React.ReactNode;
}

export const ScreenBackHeader: React.FC<BackHeaderProps> = ({
  title,
  subtitle,
  chevronStyle = 'arrow',
  rightSlot,
}) => {
  return (
    <div className="space-y-1.5 mb-2.5 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 min-w-0">
          {chevronStyle === 'chevron' ? (
            <ChevronLeft className="w-4 h-4 text-[#1C1815] dark:text-[#F5F2EC] shrink-0" strokeWidth={2} />
          ) : (
            <ArrowLeft className="w-4 h-4 text-[#1C1815] dark:text-[#F5F2EC] shrink-0" strokeWidth={2} />
          )}
          {chevronStyle === 'chevron' && title && (
            <span className="text-[14px] font-semibold tracking-[-0.02em] text-[#1C1815] dark:text-[#F5F2EC] truncate">
              {title}
            </span>
          )}
        </div>
        {rightSlot && <div className="flex items-center gap-1.5 shrink-0">{rightSlot}</div>}
      </div>

      {chevronStyle === 'arrow' && title && (
        <div>
          <p className="text-[16px] font-semibold tracking-[-0.025em] leading-tight text-[#1C1815] dark:text-[#F5F2EC]">
            {title}
          </p>
          {subtitle && (
            <p className="text-[9.5px] text-[#67625B] dark:text-[#C5BDB2] truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
