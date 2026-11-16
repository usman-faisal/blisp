import React, { useEffect, useState } from 'react';
import { AppScreenshotId, APP_SCREENSHOTS } from '../../data/screenshots';
import { ScreenRecreation } from './ScreenRecreation';

export interface PhoneMockupProps {
  screenId: AppScreenshotId;
  /** Override the screenshot path if passing a custom asset directly */
  srcOverride?: string | null;
  /** Override alt text if needed */
  altOverride?: string;
  /** Set true for above-the-fold mockups to eager-load; false lazy-loads below the fold */
  priority?: boolean;
  /** Visual bezel/placeholder theme; defaults to inheriting active document theme */
  surfaceTheme?: 'light' | 'dark';
  /** Optional width sizing preset */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PhoneMockupProps['size']>, string> = {
  sm: 'w-[228px] sm:w-[256px] max-w-full',
  md: 'w-[244px] sm:w-[296px] max-w-full',
  lg: 'w-[264px] sm:w-[320px] max-w-full',
};

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  screenId,
  srcOverride,
  altOverride,
  priority = false,
  size = 'md',
  className = '',
}) => {
  const spec = APP_SCREENSHOTS[screenId];
  const resolvedSrc = srcOverride !== undefined ? srcOverride : spec.src;
  const resolvedAlt = altOverride || spec.alt;

  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    setHasLoadError(false);
  }, [resolvedSrc, screenId]);

  const useRecreation = !resolvedSrc || hasLoadError;

  return (
    <div className={`relative inline-block select-none ${SIZE_CLASSES[size]} ${className}`}>
      {/* Side Hardware Buttons */}
      <span
        aria-hidden="true"
        className="absolute -left-[2.5px] top-[96px] w-[3px] h-7 rounded-l-sm bg-[#3A322B]/80 dark:bg-[#50463C]/80"
      />
      <span
        aria-hidden="true"
        className="absolute -left-[2.5px] top-[138px] w-[3px] h-11 rounded-l-sm bg-[#3A322B]/80 dark:bg-[#50463C]/80"
      />
      <span
        aria-hidden="true"
        className="absolute -left-[2.5px] top-[192px] w-[3px] h-11 rounded-l-sm bg-[#3A322B]/80 dark:bg-[#50463C]/80"
      />
      <span
        aria-hidden="true"
        className="absolute -right-[2.5px] top-[148px] w-[3px] h-14 rounded-r-sm bg-[#3A322B]/80 dark:bg-[#50463C]/80"
      />

      {/* Outer Device Chassis */}
      <div
        className="relative rounded-[44px] sm:rounded-[46px] p-[9px] bg-gradient-to-b from-[#332C26] via-[#1E1915] to-[#14110E]
          ring-1 ring-[#322C25]/25 dark:ring-white/14
          shadow-[0_30px_64px_-18px_rgba(32,26,20,0.28),0_12px_24px_-10px_rgba(32,26,20,0.16),inset_0_1px_1px_rgba(255,255,255,0.22)]
          dark:shadow-[0_36px_78px_-18px_rgba(0,0,0,0.82),0_12px_28px_-10px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.14)]"
      >
        {/* Inner Screen Glass (9:20 matching measured 720x1600 screenshots) */}
        <div className="relative w-full aspect-[9/20] rounded-[35px] sm:rounded-[37px] overflow-hidden bg-[#F5F2EC] dark:bg-[#141210] ring-1 ring-black/25">
          {useRecreation ? (
            <div role="img" aria-label={resolvedAlt} className="w-full h-full">
              <div aria-hidden="true" className="w-full h-full">
                <ScreenRecreation name={screenId} />
              </div>
            </div>
          ) : (
            <img
              src={resolvedSrc!}
              alt={resolvedAlt}
              width={720}
              height={1600}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setHasLoadError(true)}
              className="w-full h-full object-cover object-top block"
            />
          )}

          {/* Bottom Home Gesture Pill matching Android screenshots */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 w-[92px] h-[3.5px] rounded-full bg-[#322C25]/35 dark:bg-[#F5F2EC]/30"
          />
        </div>
      </div>
    </div>
  );
};
