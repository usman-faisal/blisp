import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useDemoMode } from '../../context/DemoModeContext';
import { AppScreenshotId, APP_SCREENSHOTS } from '../../data/screenshots';
import { Eyebrow, GlassCard, PhoneMockup, ScreenRecreation, Section } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface TourStepSpec {
  id: string;
  number: string;
  title: string;
  copy: string;
  screens: AppScreenshotId[];
}

const TOUR_STEPS: TourStepSpec[] = [
  {
    id: 'step-sign-in',
    number: '01',
    title: 'Sign in with Google',
    copy: 'One tap connects your Google account so your ideas and plans stay synced from the very first thought.',
    screens: ['11-sign-up-google'],
  },
  {
    id: 'step-capture',
    number: '02',
    title: 'Capture an idea by voice',
    copy: 'Speak freely into Blisp and watch a live transcript turn unstructured thoughts into clear intent.',
    screens: ['03-capture-idea'],
  },
  {
    id: 'step-incubate',
    number: '03',
    title: 'Watch AI incubate it',
    copy: 'Gemini researches market gaps, shapes a focused discovery report, and structures starter tasks in your Incubator.',
    screens: ['02-incubator', '08-discovery-report'],
  },
  {
    id: 'step-roadmap',
    number: '04',
    title: 'Plan the roadmap',
    copy: 'Organize incubated tasks into dated milestones with effort estimates and honest deadline checks.',
    screens: ['07-roadmap-progress'],
  },
  {
    id: 'step-collaborate',
    number: '05',
    title: 'Collaborate and connect GitHub',
    copy: 'Invite teammates by link with clear roles and connect GitHub so tagged commits check off completed tasks.',
    screens: ['12-invite-collaborate', '13-connect-github'],
  },
  {
    id: 'step-nudges',
    number: '06',
    title: 'Get nudged until it ships',
    copy: 'Receive calm, well-paced nudges on pending work so momentum carries smoothly from idea to reality.',
    screens: ['14-smart-nudges'],
  },
];

const ALL_TOUR_SCREEN_IDS: AppScreenshotId[] = Array.from(
  new Set(TOUR_STEPS.flatMap((s) => s.screens))
);

interface StickyTourPhoneProps {
  screenId: AppScreenshotId;
  instant: boolean;
}

const StickyTourPhone: React.FC<StickyTourPhoneProps> = ({ screenId, instant }) => {
  const spec = APP_SCREENSHOTS[screenId];
  const [erroredIds, setErroredIds] = useState<Record<string, boolean>>({});

  const useRecreation = !spec.src || !!erroredIds[screenId];

  return (
    <div className="relative inline-block select-none w-[296px] sm:w-[324px]">
      {/* Subtle Ambient Halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-gradient-to-tr from-[#DF5F2C]/14 via-transparent to-[#C59B38]/14 blur-2xl"
      />

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

      {/* Steady Device Bezel (9:20 matching screenshots) */}
      <div
        className="relative rounded-[46px] p-[9px] bg-gradient-to-b from-[#332C26] via-[#1E1915] to-[#14110E]
          ring-1 ring-[#322C25]/25 dark:ring-white/14
          shadow-[0_30px_64px_-18px_rgba(32,26,20,0.28),0_12px_24px_-10px_rgba(32,26,20,0.16),inset_0_1px_1px_rgba(255,255,255,0.22)]
          dark:shadow-[0_36px_78px_-18px_rgba(0,0,0,0.82),0_12px_28px_-10px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.14)]"
      >
        <div className="relative w-full aspect-[9/20] rounded-[37px] overflow-hidden bg-[#F5F2EC] dark:bg-[#141210] ring-1 ring-black/25">
          {/* Screen Cross-Fade Layer */}
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={screenId}
              initial={instant ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={instant ? undefined : { opacity: 0, scale: 1.02 }}
              transition={instant ? { duration: 0 } : { duration: 0.5, ease: EASE_BLISP }}
              className="absolute inset-0 w-full h-full"
            >
              {useRecreation ? (
                <div role="img" aria-label={spec.alt} className="w-full h-full">
                  <div aria-hidden="true" className="w-full h-full">
                    <ScreenRecreation name={screenId} />
                  </div>
                </div>
              ) : (
                <img
                  src={spec.src!}
                  alt={spec.alt}
                  width={720}
                  height={1600}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setErroredIds((prev) => ({ ...prev, [screenId]: true }))
                  }
                  className="w-full h-full object-cover object-top block"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom Home Gesture Pill */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 w-[92px] h-[3.5px] rounded-full bg-[#322C25]/35 dark:bg-[#F5F2EC]/30"
          />
        </div>
      </div>
    </div>
  );
};

export const ProductTour: React.FC = () => {
  const shouldReduceMotion = !!useReducedMotion();
  const { isDemoMode } = useDemoMode();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [subScreenByStep, setSubScreenByStep] = useState<Record<string, number>>({});
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    ALL_TOUR_SCREEN_IDS.forEach((id) => {
      const src = APP_SCREENSHOTS[id]?.src;
      if (!src) return;
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((entry) => entry.isIntersecting);
        if (intersecting.length === 0) return;

        const viewportCenter = window.innerHeight / 2;
        let bestIdx = -1;
        let smallestDistance = Infinity;

        for (const entry of intersecting) {
          const idxAttr = entry.target.getAttribute('data-step-index');
          const idx = idxAttr ? Number(idxAttr) : -1;
          if (idx < 0) continue;
          const rect = entry.boundingClientRect;
          const entryCenter = rect.top + rect.height / 2;
          const dist = Math.abs(entryCenter - viewportCenter);
          if (dist < smallestDistance) {
            smallestDistance = dist;
            bestIdx = idx;
          }
        }

        if (bestIdx >= 0) {
          setActiveStepIndex(bestIdx);
        }
      },
      {
        root: null,
        rootMargin: '-38% 0px -38% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const activeStep = TOUR_STEPS[activeStepIndex];
  useEffect(() => {
    if (activeStep.screens.length <= 1) return;

    setSubScreenByStep((prev) => ({ ...prev, [activeStep.id]: 0 }));

    if (shouldReduceMotion) return;

    const timer = window.setTimeout(
      () => {
        setSubScreenByStep((prev) => ({ ...prev, [activeStep.id]: 1 }));
      },
      isDemoMode ? 950 : 2200
    );

    return () => window.clearTimeout(timer);
  }, [activeStep.id, activeStep.screens.length, isDemoMode, shouldReduceMotion]);

  const activeScreenSubIdx = subScreenByStep[activeStep.id] ?? 0;
  const activeScreenId =
    activeStep.screens[activeScreenSubIdx] || activeStep.screens[0];

  const scrollToStep = (index: number) => {
    const el = stepRefs.current[index];
    if (!el) return;
    el.scrollIntoView({
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  };

  const progressRatio = activeStepIndex / Math.max(TOUR_STEPS.length - 1, 1);

  return (
    <Section id="tour" aria-labelledby="tour-heading" spacing="default" className="scroll-mt-20">
      <div className="space-y-3 max-w-2xl mb-14 lg:mb-20">
        <Eyebrow tone="teal">Product Tour</Eyebrow>
        <h2 id="tour-heading" className="blisp-h1 text-[#1C1815] dark:text-[#F5F2EC]">
          From spoken spark to{' '}
          <span className="blisp-gradient-text">shipped milestone.</span>
        </h2>
        <p className="text-[16px] sm:text-[17px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2]">
          Follow a single idea through all six stages inside Blisp—no manual boards, no buried
          notes.
        </p>
      </div>

      {/* DESKTOP */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-12 items-start">
        <div className="lg:col-span-6 lg:sticky lg:top-24 min-h-[660px] flex flex-col items-center justify-center">
          <StickyTourPhone screenId={activeScreenId} instant={shouldReduceMotion} />

          <div className="mt-5 flex items-center gap-2 text-[13px] text-[#5D5851] dark:text-[#A59D92]">
            <span className="font-mono-code font-semibold text-[#B54217] dark:text-[#E86F3F] tabular-nums">
              {APP_SCREENSHOTS[activeScreenId].number}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-[#1C1815] dark:text-[#F5F2EC]">
              {APP_SCREENSHOTS[activeScreenId].name}
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 relative pl-10">
          <div
            aria-hidden="true"
            className="absolute left-3 top-14 bottom-14 w-[2px] rounded-full bg-[#322C25]/[0.09] dark:bg-[#F5F2EC]/[0.09]"
          >
            <motion.div
              animate={{ scaleY: progressRatio }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.45, ease: EASE_BLISP }
              }
              style={{ transformOrigin: '50% 0%' }}
              className="w-full h-full rounded-full bg-gradient-to-b from-[#DF5F2C] to-[#C59B38]"
            />
          </div>

          <div className="space-y-8">
            {TOUR_STEPS.map((step, idx) => {
              const isActive = idx === activeStepIndex;
              const isFilled = idx <= activeStepIndex;
              const selectedSub = subScreenByStep[step.id] ?? 0;

              return (
                <div
                  key={step.id}
                  ref={(el) => {
                    stepRefs.current[idx] = el;
                  }}
                  data-step-index={idx}
                  data-tour-step={idx}
                  className="relative py-10"
                >
                  <button
                    type="button"
                    onClick={() => scrollToStep(idx)}
                    aria-label={`Jump to step ${step.number}: ${step.title}`}
                    className="group/dot absolute -left-[48px] top-1/2 -translate-y-1/2 w-11 h-11 rounded-full inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B]"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded-full border-2 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isActive
                          ? 'scale-125 bg-[#C64A1B] dark:bg-[#E86F3F] border-[#C64A1B] dark:border-[#E86F3F] shadow-[0_0_0_5px_rgba(198,74,27,0.2)]'
                          : isFilled
                          ? 'bg-[#C64A1B] dark:bg-[#E86F3F] border-[#C64A1B] dark:border-[#E86F3F]'
                          : 'bg-[#F5F2EC] dark:bg-[#141210] border-[#D8D2CA] dark:border-[#332C25] group-hover/dot:border-[#C64A1B]'
                      }`}
                    />
                  </button>

                  <div
                    onClick={() => scrollToStep(idx)}
                    className={`cursor-pointer rounded-[20px] p-7 transition-[opacity,transform,border-color,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isActive
                        ? 'blisp-glass opacity-100 border-[#C64A1B]/40 dark:border-[#E86F3F]/40 shadow-[0_18px_42px_-14px_rgba(198,74,27,0.16)]'
                        : 'blisp-glass-subtle opacity-55 hover:opacity-85'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <span
                        className={`font-mono-code text-[12px] font-semibold tracking-[0.14em] tabular-nums ${
                          isActive
                            ? 'text-[#B54217] dark:text-[#E86F3F]'
                            : 'text-[#5D5851] dark:text-[#A59D92]'
                        }`}
                      >
                        STEP {step.number}
                      </span>

                      {step.screens.length > 1 && (
                        <div
                          className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#322C25]/[0.06] dark:bg-[#F5F2EC]/[0.06]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {step.screens.map((sid, sIdx) => {
                            const spec = APP_SCREENSHOTS[sid];
                            const isSubActive = selectedSub === sIdx;
                            return (
                              <button
                                key={sid}
                                type="button"
                                onClick={() => {
                                  setActiveStepIndex(idx);
                                  setSubScreenByStep((prev) => ({
                                    ...prev,
                                    [step.id]: sIdx,
                                  }));
                                }}
                                className={`min-h-[44px] px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F] ${
                                  isSubActive
                                    ? 'bg-[#FAF8F5] dark:bg-[#2A241F] text-[#1C1815] dark:text-[#F5F2EC] shadow-sm'
                                    : 'text-[#5D5851] dark:text-[#A59D92] hover:text-[#1C1815] dark:hover:text-[#F5F2EC]'
                                }`}
                              >
                                {spec.number} · {spec.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <h3 className="blisp-h3 text-[#1C1815] dark:text-[#F5F2EC] mb-2">
                      {step.title}
                    </h3>
                    <p className="text-[15.5px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2]">
                      {step.copy}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MOBILE & TABLET */}
      <div className="lg:hidden space-y-12">
        {TOUR_STEPS.map((step, idx) => {
          const selectedSub = subScreenByStep[step.id] ?? 0;
          const currentScreenId = step.screens[selectedSub] || step.screens[0];

          return (
            <div key={step.id} data-tour-step={idx}>
              <GlassCard
                padding="md"
                className="flex flex-col items-center text-center gap-6"
              >
              <div className="space-y-2.5 max-w-md">
                <span className="font-mono-code text-[12px] font-semibold tracking-[0.14em] text-[#B54217] dark:text-[#E86F3F] tabular-nums">
                  STEP {step.number}
                </span>
                <h3 className="blisp-h3 text-[#1C1815] dark:text-[#F5F2EC]">{step.title}</h3>
                <p className="text-[15px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2]">
                  {step.copy}
                </p>
              </div>

              {step.screens.length > 1 && (
                <div className="inline-flex flex-wrap justify-center items-center gap-1 p-1 rounded-xl bg-[#322C25]/[0.06] dark:bg-[#F5F2EC]/[0.06]">
                  {step.screens.map((sid, sIdx) => {
                    const spec = APP_SCREENSHOTS[sid];
                    const isSubActive = selectedSub === sIdx;
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() =>
                          setSubScreenByStep((prev) => ({ ...prev, [step.id]: sIdx }))
                        }
                        className={`min-h-[44px] px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] ${
                          isSubActive
                            ? 'bg-[#FAF8F5] dark:bg-[#2A241F] text-[#1C1815] dark:text-[#F5F2EC] shadow-sm'
                            : 'text-[#5D5851] dark:text-[#A59D92]'
                        }`}
                      >
                        {spec.number} · {spec.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <PhoneMockup screenId={currentScreenId} size="md" priority={false} />
            </GlassCard>
            </div>
          );
        })}
      </div>
    </Section>
  );
};
