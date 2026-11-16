import React from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  tone?: 'default' | 'subtle';
  children: React.ReactNode;
}

const PADDING_CLASSES: Record<NonNullable<GlassCardProps['padding']>, string> = {
  none: '',
  sm: 'p-4 sm:p-5',
  md: 'p-6 sm:p-7',
  lg: 'p-7 sm:p-9',
};

export const GlassCard: React.FC<GlassCardProps> = ({
  padding = 'md',
  interactive = false,
  tone = 'default',
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`rounded-[20px] ${
        tone === 'subtle' ? 'blisp-glass-subtle' : 'blisp-glass'
      } ${PADDING_CLASSES[padding]} ${
        interactive
          ? 'transition-[transform,opacity,border-color] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-[#322C25]/18 dark:hover:border-[#F5F2EC]/20'
          : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
