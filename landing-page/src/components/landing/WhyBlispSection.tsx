import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Layers, Smartphone, Users } from 'lucide-react';
import { Eyebrow, GlassCard, Section } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface RoadmapItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: 'terracotta' | 'ochre';
}

const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    title: 'Mobile app launch',
    description:
      'Voice capture, AI incubation, and daily Focus lists ready in your pocket.',
    icon: <Smartphone className="w-4.5 h-4.5" strokeWidth={1.9} />,
    accent: 'terracotta',
  },
  {
    title: 'Team workspaces',
    description:
      'Role-based invite codes, shared roadmaps, and calm task discussions.',
    icon: <Users className="w-4.5 h-4.5" strokeWidth={1.9} />,
    accent: 'ochre',
  },
  {
    title: 'More integrations',
    description:
      'Connecting more of the places where research, tasks, and code already live.',
    icon: <Layers className="w-4.5 h-4.5" strokeWidth={1.9} />,
    accent: 'terracotta',
  },
];

export const WhyBlispSection: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Section id="why-blisp" aria-labelledby="why-blisp-heading" spacing="default" className="scroll-mt-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.65, ease: EASE_BLISP }}
          className="lg:col-span-7 space-y-6"
        >
          <Eyebrow tone="amber">Why we&apos;re building Blisp</Eyebrow>
          <h2 id="why-blisp-heading" className="sr-only">
            Why we&apos;re building Blisp
          </h2>

          <blockquote className="font-display text-[clamp(1.85rem,3.4vw,2.85rem)] font-bold tracking-[-0.03em] leading-[1.18] text-[#1C1815] dark:text-[#F5F2EC]">
            Great ideas shouldn&apos;t need a perfect plan to start.{' '}
            <span className="blisp-gradient-text">Speak them.</span> We&apos;ll help with the
            rest.
          </blockquote>

          <p className="text-[16px] sm:text-[17px] leading-[1.65] text-[#5D5851] dark:text-[#C5BDB2] max-w-[54ch]">
            Too many promising projects stall between a late-night voice memo and a blank project
            board. Blisp gives raw thoughts a calm place to be heard, researched, and turned into
            momentum—before life gets in the way.
          </p>
        </motion.div>

        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#5D5851] dark:text-[#A59D92]">
              What&apos;s coming
            </h2>
          </div>

          <div className="space-y-3.5">
            {ROADMAP_ITEMS.map((item, idx) => {
              const iconClasses =
                item.accent === 'ochre'
                  ? 'bg-[#C59B38]/14 text-[#7A5A12] dark:text-[#D6AB4E] border-[#C59B38]/25'
                  : 'bg-[#DF5F2C]/12 text-[#B54217] dark:text-[#E86F3F] border-[#DF5F2C]/25';

              return (
                <motion.div
                  key={item.title}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{
                    duration: 0.55,
                    delay: shouldReduceMotion ? 0 : idx * 0.09,
                    ease: EASE_BLISP,
                  }}
                >
                  <GlassCard padding="sm" interactive className="flex items-start gap-4">
                    <div
                      aria-hidden="true"
                      className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 mt-0.5 ${iconClasses}`}
                    >
                      {item.icon}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <h3 className="text-[15.5px] font-semibold tracking-[-0.015em] text-[#1C1815] dark:text-[#F5F2EC]">
                          {item.title}
                        </h3>
                        <span className="font-mono-code text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#B54217] dark:text-[#E86F3F] whitespace-nowrap shrink-0">
                          Coming soon
                        </span>
                      </div>
                      <p className="text-[14px] leading-[1.55] text-[#5D5851] dark:text-[#C5BDB2]">
                        {item.description}
                      </p>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
};
