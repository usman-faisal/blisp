import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Smartphone, Sparkles } from 'lucide-react';
import { GlassCard, Section } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

const BUILT_WITH_TOOLS = [
  {
    name: 'Gemini',
    icon: <Sparkles className="w-4 h-4 text-[#DF5F2C] dark:text-[#E86F3F]" strokeWidth={2} />,
  },
  {
    name: 'Google sign-in',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        />
      </svg>
    ),
  },
  {
    name: 'GitHub',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.91c.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.07.78 2.15v3.18c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    ),
  },
  {
    name: 'Expo / React Native',
    icon: <Smartphone className="w-4 h-4 text-[#C59B38] dark:text-[#D6AB4E]" strokeWidth={2} />,
  },
];

const FLOW_PILLS = [
  { id: 'speak', emoji: '🎙', label: 'Speak' },
  { id: 'incubates', emoji: '✨', label: 'AI Incubates' },
  { id: 'execute', emoji: '🚀', label: 'Execute' },
];

export const BuiltWithAndProblemBand: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const flowRef = useRef<HTMLDivElement>(null);
  const isFlowInView = useInView(flowRef, { once: true, amount: 0.45 });
  const [litStep, setLitStep] = useState<number>(-1);

  useEffect(() => {
    if (!isFlowInView) return;
    if (shouldReduceMotion) {
      setLitStep(2);
      return;
    }

    const t0 = window.setTimeout(() => setLitStep(0), 180);
    const t1 = window.setTimeout(() => setLitStep(1), 640);
    const t2 = window.setTimeout(() => setLitStep(2), 1100);

    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isFlowInView, shouldReduceMotion]);

  return (
    <>
      {/* Slim "Built with" Tool Strip */}
      <div className="border-y border-[#322C25]/[0.08] dark:border-[#F5F2EC]/[0.08] bg-[#EFEBE2]/65 dark:bg-[#1B1814]/65 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[13px] font-medium text-[#5D5851] dark:text-[#A59D92] text-center md:text-left">
            Built with and for the tools you already use.
          </p>

          <ul
            aria-label="Built with"
            className="flex flex-wrap items-center justify-center md:justify-end gap-3 sm:gap-5"
          >
            {BUILT_WITH_TOOLS.map((tool) => (
              <li
                key={tool.name}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F2EC]/90 dark:bg-[#201C18]/90 border border-[#322C25]/[0.09] dark:border-[#F5F2EC]/[0.09] text-[13px] font-medium text-[#1C1815] dark:text-[#F5F2EC] whitespace-nowrap"
              >
                <span aria-hidden="true" className="inline-flex items-center justify-center shrink-0">
                  {tool.icon}
                </span>
                <span>{tool.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Problem-to-Solution Band */}
      <Section aria-label="From notes to action" spacing="default" grid>
        <div className="col-span-4 md:col-span-12 flex flex-col items-center text-center">
          <motion.h2
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            transition={{ duration: 0.65, ease: EASE_BLISP }}
            className="blisp-h1 text-[#1C1815] dark:text-[#F5F2EC] max-w-[22ch]"
          >
            Ideas die in notes apps.{' '}
            <span className="blisp-gradient-text">Blisp gives them a pulse.</span>
          </motion.h2>

          {/* 3-Step Self-Drawing Flow */}
          <div
            ref={flowRef}
            className="mt-10 sm:mt-12 w-full max-w-[780px] relative flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-4"
          >
            {/* Desktop Connecting Line */}
            <div
              aria-hidden="true"
              className="hidden sm:block absolute left-[12%] right-[12%] top-1/2 -translate-y-1/2 h-[2px] z-0"
            >
              <div className="w-full h-full rounded-full bg-[#322C25]/[0.1] dark:bg-[#F5F2EC]/[0.1]" />
              <motion.div
                initial={shouldReduceMotion ? { scaleX: 1 } : { scaleX: 0 }}
                animate={isFlowInView ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 1.15, ease: EASE_BLISP }}
                style={{ transformOrigin: '0% 50%' }}
                className="absolute inset-0 rounded-full bg-gradient-to-r from-[#DF5F2C] via-[#D47E31] to-[#C59B38] shadow-[0_0_12px_rgba(223,95,44,0.35)]"
              />
            </div>

            {/* Mobile Vertical Connecting Line */}
            <div
              aria-hidden="true"
              className="sm:hidden absolute top-6 bottom-6 left-1/2 -translate-x-1/2 w-[2px] z-0"
            >
              <div className="w-full h-full rounded-full bg-[#322C25]/[0.1] dark:bg-[#F5F2EC]/[0.1]" />
              <motion.div
                initial={shouldReduceMotion ? { scaleY: 1 } : { scaleY: 0 }}
                animate={isFlowInView ? { scaleY: 1 } : { scaleY: 0 }}
                transition={{ duration: 1.15, ease: EASE_BLISP }}
                style={{ transformOrigin: '50% 0%' }}
                className="absolute inset-0 rounded-full bg-gradient-to-b from-[#DF5F2C] via-[#D47E31] to-[#C59B38]"
              />
            </div>

            {FLOW_PILLS.map((pill, idx) => {
              const isLit = litStep >= idx;
              return (
                <motion.div
                  key={pill.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.45 }}
                  transition={{
                    duration: 0.55,
                    delay: shouldReduceMotion ? 0 : idx * 0.16,
                    ease: EASE_BLISP,
                  }}
                  className="relative z-10"
                >
                  <GlassCard
                    padding="none"
                    className={`px-6 py-3.5 rounded-full inline-flex items-center gap-3 transition-[transform,border-color,box-shadow,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isLit
                        ? 'border-[#DF5F2C]/55 dark:border-[#E86F3F]/55 bg-[#FAF8F5] dark:bg-[#26211C] shadow-[0_12px_30px_-8px_rgba(223,95,44,0.25),0_0_0_1px_rgba(197,155,56,0.2)] scale-[1.03]'
                        : 'opacity-75'
                    }`}
                  >
                    <span aria-hidden="true" className="text-[18px] leading-none">
                      {pill.emoji}
                    </span>
                    <span className="font-display text-[15.5px] sm:text-[16.5px] font-bold tracking-[-0.015em] text-[#1C1815] dark:text-[#F5F2EC] whitespace-nowrap">
                      {pill.label}
                    </span>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Section>
    </>
  );
};
