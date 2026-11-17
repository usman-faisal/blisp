import React from 'react';
import { GlassCard } from './GlassCard';

export interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  kicker?: string;
  accent?: 'teal' | 'amber';
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  kicker,
  accent = 'teal',
  className = '',
}) => {
  const iconContainerTone =
    accent === 'amber'
      ? 'bg-[#C59B38]/14 text-[#7A5A12] dark:text-[#D6AB4E] border-[#C59B38]/25'
      : 'bg-[#DF5F2C]/12 text-[#B54217] dark:text-[#E86F3F] border-[#DF5F2C]/25';

  return (
    <GlassCard interactive padding="md" className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div
          aria-hidden="true"
          className={`w-11 h-11 rounded-[12px] border flex items-center justify-center shrink-0 ${iconContainerTone}`}
        >
          {icon}
        </div>
        {kicker && (
          <span className="font-mono-code text-[12px] font-medium text-[#5D5851] dark:text-[#A59D92] tabular-nums">
            {kicker}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="blisp-h3 text-[#1C1815] dark:text-[#F5F2EC]">{title}</h3>
        <p className="text-[15px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2]">
          {description}
        </p>
      </div>
    </GlassCard>
  );
};
