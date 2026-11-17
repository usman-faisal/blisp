import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      className={`min-h-[44px] px-3.5 py-2 rounded-full inline-flex items-center gap-2 whitespace-nowrap shrink-0
        bg-[#EFEBE2]/90 dark:bg-[#201C18]/90 text-[#1C1815] dark:text-[#F5F2EC]
        border border-[#322C25]/12 dark:border-[#F5F2EC]/14 backdrop-blur-md
        shadow-[0_4px_14px_-4px_rgba(50,44,37,0.08),inset_0_1px_0_rgba(255,255,255,0.6)]
        dark:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.05)]
        hover:bg-[#E9E2D8] dark:hover:bg-[#2A241F]
        active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DF5F2C] dark:focus-visible:ring-[#E86F3F] focus-visible:ring-offset-2
        focus-visible:ring-offset-[#F5F2EC] dark:focus-visible:ring-offset-[#141210]
        transition-[transform,background-color,color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]
        ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#D6AB4E] shrink-0" strokeWidth={2} />
      ) : (
        <Moon className="w-4 h-4 text-[#DF5F2C] shrink-0" strokeWidth={2} />
      )}
      <span className="text-[13.5px] font-medium">{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
};
