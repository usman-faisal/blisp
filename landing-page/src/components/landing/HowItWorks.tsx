import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AppScreenshotId } from '../../data/screenshots';
import { Eyebrow, GlassCard, PhoneMockup, Section } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface StepItem {
  number: string;
  title: string;
  description: string;
  screenId: AppScreenshotId;
}

const STEPS: StepItem[] = [
  {
    number: '01',
    title: 'Speak your idea',
    description:
      'Open Blisp and talk naturally. Live voice transcription captures rough thoughts before they fade.',
    screenId: '03-capture-idea',
  },
  {
    number: '02',
    title: 'Let AI incubate it',
    description:
      'Gemini researches comparable solutions, spots open gaps, and shapes your raw note into starter tasks.',
    screenId: '02-incubator',
  },
  {
    number: '03',
    title: 'Execute with your team',
    description:
      'Invite collaborators, follow your roadmap, and ship milestones backed by real commits.',
    screenId: '09-project-overview',
  },
];

export const HowItWorks: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Section id="how-it-works" aria-labelledby="how-it-works-heading" spacing="default" className="scroll-mt-20">
      <div className="space-y-12">
        <div className="space-y-3 max-w-2xl">
          <Eyebrow tone="teal">How it works</Eyebrow>
          <h2 id="how-it-works-heading" className="blisp-h1 text-[#1C1815] dark:text-[#F5F2EC]">
            Three quiet steps from thought to action.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {STEPS.map((step, idx) => (
            <motion.div
              key={step.number}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.62,
                delay: shouldReduceMotion ? 0 : idx * 0.1,
                ease: EASE_BLISP,
              }}
              className="flex"
            >
              <GlassCard
                padding="none"
                interactive
                className="w-full flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6 sm:p-7 space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      aria-hidden="true"
                      className="font-display text-[52px] sm:text-[60px] font-extrabold tracking-[-0.04em] leading-none text-[#322C25]/[0.12] dark:text-[#F5F2EC]/[0.12] tabular-nums select-none"
                    >
                      {step.number}
                    </span>
                  </div>

                  <h3 className="blisp-h3 text-[#1C1815] dark:text-[#F5F2EC]">{step.title}</h3>
                  <p className="text-[15px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2]">
                    {step.description}
                  </p>
                </div>

                {/* Cropped Screenshot Frame */}
                <div className="relative pt-2 px-6 min-h-[230px] overflow-hidden flex justify-center items-start">
                  <div className="translate-y-4">
                    <PhoneMockup screenId={step.screenId} size="sm" priority={false} />
                  </div>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#EFEBE2]/90 via-[#EFEBE2]/35 to-transparent dark:from-[#201C18]/92 dark:via-[#201C18]/40 dark:to-transparent"
                  />
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
};
