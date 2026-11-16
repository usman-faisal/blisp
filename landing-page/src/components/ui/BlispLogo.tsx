import React, { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

export type BlispLogoVariant = 'full' | 'mark';
export type BlispLogoTone = 'auto' | 'light' | 'dark' | 'mono';
export type BlispLogoSize = 'sm' | 'md' | 'lg';

export interface BlispLogoProps {
  variant?: BlispLogoVariant;
  tone?: BlispLogoTone;
  size?: BlispLogoSize;
  /** Subtle scale/opacity pulse reserved exclusively for the Navbar mark */
  animated?: boolean;
  className?: string;
}

const SIZE_MAP: Record<BlispLogoSize, { icon: number; text: string; gap: string }> = {
  sm: { icon: 22, text: 'text-[19px]', gap: 'gap-2' },
  md: { icon: 26, text: 'text-[22px]', gap: 'gap-2.5' },
  lg: { icon: 34, text: 'text-[28px]', gap: 'gap-3' },
};

export const BlispLogo: React.FC<BlispLogoProps> = ({
  variant = 'full',
  tone = 'auto',
  size = 'md',
  animated = false,
  className = '',
}) => {
  const gradId = useId();
  const shouldReduceMotion = useReducedMotion();
  const dims = SIZE_MAP[size];

  const wordmarkToneClass =
    tone === 'dark'
      ? 'text-[#F5F2EC]'
      : tone === 'light'
      ? 'text-[#1C1815]'
      : tone === 'mono'
      ? 'text-current'
      : 'text-[#1C1815] dark:text-[#F5F2EC]';

  const startColor = tone === 'dark' ? '#E86F3F' : '#DF5F2C';
  const midColor = tone === 'dark' ? '#DF8B44' : '#D37D32';
  const endColor = tone === 'dark' ? '#D6AB4E' : '#C59B38';

  const markSvg = (
    <svg
      width={dims.icon}
      height={dims.icon}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {tone !== 'mono' && (
        <defs>
          <linearGradient id={gradId} x1="5" y1="24" x2="31" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="55%" stopColor={midColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>
      )}
      <path
        d="M11.6 23.2C8.5 23.2 6 20.8 6 17.8C6 14.8 8.5 12.4 11.6 12.4C15.1 12.4 17.1 16.05 18 17.8C18.9 19.55 20.9 23.2 24.4 23.2C27.5 23.2 30 20.8 30 17.8C30 14.8 27.5 12.4 24.4 12.4C20.9 12.4 18.9 16.05 18 17.8C17.1 19.55 15.1 23.2 11.6 23.2Z"
        stroke={tone === 'mono' ? 'currentColor' : `url(#${gradId})`}
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="29.2"
        cy="8.6"
        r="2.4"
        fill={tone === 'mono' ? 'currentColor' : startColor}
      />
    </svg>
  );

  return (
    <span className={`inline-flex items-center ${dims.gap} select-none ${className}`}>
      {animated && !shouldReduceMotion ? (
        <motion.span
          animate={{ scale: [1, 1.07, 1], opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: EASE_BLISP }}
          className="inline-flex items-center justify-center"
        >
          {markSvg}
        </motion.span>
      ) : (
        markSvg
      )}

      {variant === 'full' && (
        <span
          className={`font-display ${dims.text} font-extrabold tracking-[-0.04em] leading-none ${wordmarkToneClass}`}
        >
          Blisp
        </span>
      )}
    </span>
  );
};
