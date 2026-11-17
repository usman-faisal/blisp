import React, { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppScreenshotId } from '../../data/screenshots';
import { Eyebrow, GlassCard, PhoneMockup, Section } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface UseCaseSpec {
  id: string;
  label: string;
  headline: string;
  scenario: string;
  screenId: AppScreenshotId;
}

const USE_CASES: UseCaseSpec[] = [
  {
    id: 'founders',
    label: 'Founders',
    headline: 'Stress-test a product angle while it is still fresh',
    scenario:
      'Imagine you are walking back from an early user chat and a sharper positioning idea clicks. You speak a thirty-second brain dump into Blisp, and Gemini prepares a discovery report highlighting gaps and comparable tools before you lose the thread.',
    screenId: '08-discovery-report',
  },
  {
    id: 'makers',
    label: 'Makers',
    headline: 'Turn weekend energy into an honest schedule',
    scenario:
      'Imagine you want to ship a small side project over six spare evenings without overcommitting. You drop your scope into Blisp, set a deadline, and see what comfortably fits in your first milestone.',
    screenId: '07-roadmap-progress',
  },
  {
    id: 'students',
    label: 'Students',
    headline: 'Keep capstones, research, and side builds separated',
    scenario:
      'Imagine you are balancing a semester capstone alongside coursework and personal prototypes. You record rough lecture ideas in seconds, organize each track under My Projects, and pick up right where you left off.',
    screenId: '04-my-projects',
  },
  {
    id: 'teams',
    label: 'Teams',
    headline: 'Bring collaborators into one shared plan in seconds',
    scenario:
      'Imagine you and two teammates are kicking off a sprint from scratch. One project invite code brings everyone into the same roadmap so assigned tasks, comments, and GitHub commits stay aligned.',
    screenId: '10-join-project',
  },
];

export const UseCases: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeCase = USE_CASES[activeIndex];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIdx = (idx + 1) % USE_CASES.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIdx = (idx - 1 + USE_CASES.length) % USE_CASES.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIdx = USE_CASES.length - 1;
    }

    if (nextIdx !== null) {
      setActiveIndex(nextIdx);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <Section id="use-cases" aria-labelledby="use-cases-heading" spacing="default" className="scroll-mt-20">
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <Eyebrow tone="teal">Use cases</Eyebrow>
            <h2 id="use-cases-heading" className="blisp-h1 text-[#1C1815] dark:text-[#F5F2EC]">
              Built for how builders actually think.
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Blisp use cases"
            className="inline-flex flex-wrap items-center gap-1 p-1.5 rounded-[24px] sm:rounded-full blisp-glass-subtle self-start md:self-auto max-w-full"
          >
            {USE_CASES.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    tabRefs.current[idx] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${item.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveIndex(idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  className={`min-h-[44px] px-4 py-2 rounded-full text-[13.5px] font-semibold whitespace-nowrap shrink-0 transition-[color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F] ${
                    isSelected
                      ? 'bg-[#C64A1B] dark:bg-[#E86F3F] text-white dark:text-[#141210] shadow-[0_6px_18px_-4px_rgba(198,74,27,0.42)]'
                      : 'text-[#5D5851] dark:text-[#C5BDB2] hover:text-[#1C1815] dark:hover:text-[#F5F2EC]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <GlassCard padding="lg" className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeCase.id}
              role="tabpanel"
              id={`panel-${activeCase.id}`}
              aria-labelledby={`tab-${activeCase.id}`}
              tabIndex={0}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.34, ease: EASE_BLISP }
              }
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center focus-visible:outline-none"
            >
              <div className="lg:col-span-6 space-y-4">
                <Eyebrow tone="amber">Illustrative Scenario · {activeCase.label}</Eyebrow>
                <h3 className="blisp-h2 text-[#1C1815] dark:text-[#F5F2EC]">
                  {activeCase.headline}
                </h3>
                <p className="text-[16px] sm:text-[17px] leading-[1.65] text-[#5D5851] dark:text-[#C5BDB2]">
                  {activeCase.scenario}
                </p>
              </div>

              <div className="lg:col-span-6 flex justify-center">
                <PhoneMockup screenId={activeCase.screenId} size="md" priority={false} />
              </div>
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      </div>
    </Section>
  );
};
