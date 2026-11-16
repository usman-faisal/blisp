import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { GitBranch, KeyRound, Sparkles } from 'lucide-react';
import { BlispLogo, Eyebrow, GlassCard, Section } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface IntegrationNode {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  accent: 'terracotta' | 'ochre';
}

const NODES: IntegrationNode[] = [
  {
    id: 'google',
    name: 'Google',
    description: 'One-tap sign-in with your Gmail account.',
    icon: <KeyRound className="w-5 h-5" strokeWidth={1.9} />,
    accent: 'terracotta',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect a repository and commit progress and completed tasks automatically.',
    icon: <GitBranch className="w-5 h-5" strokeWidth={1.9} />,
    accent: 'ochre',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Researches gaps and drafts starter tasks from your idea.',
    icon: <Sparkles className="w-5 h-5" strokeWidth={1.9} />,
    accent: 'terracotta',
  },
];

export const Integrations: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Section id="integrations" aria-labelledby="integrations-heading" spacing="default" className="scroll-mt-20">
      <div className="space-y-12">
        <div className="space-y-3 max-w-2xl mx-auto text-center">
          <Eyebrow tone="amber">Integrations</Eyebrow>
          <h2 id="integrations-heading" className="blisp-h1 text-[#1C1815] dark:text-[#F5F2EC]">
            Connected where you think and ship.
          </h2>
          <p className="text-[16px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2]">
            One calm workspace linking your sign-in, AI research co-pilot, and code repository.
          </p>
        </div>

        {/* Centered Hub-and-Spoke Diagram */}
        <div className="max-w-[980px] mx-auto flex flex-col items-center">
          {/* Central Blisp Logo Hub */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: EASE_BLISP }}
            className="relative flex flex-col items-center justify-center"
          >
            <div className="relative w-24 h-24 rounded-full blisp-glass flex flex-col items-center justify-center gap-1">
              <motion.span
                aria-hidden="true"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : { scale: [0.92, 1.16, 0.92], opacity: [0.42, 0.78, 0.42] }
                }
                transition={
                  shouldReduceMotion
                    ? undefined
                    : { duration: 4.2, repeat: Infinity, ease: EASE_BLISP }
                }
                className="absolute -inset-3 rounded-full bg-gradient-to-tr from-[#DF5F2C]/22 to-[#C59B38]/22 blur-xl -z-10"
              />
              <BlispLogo variant="mark" size="md" />
              <span className="font-display text-[12px] font-bold tracking-[-0.03em] text-[#1C1815] dark:text-[#F5F2EC]">
                Blisp
              </span>
            </div>
          </motion.div>

          {/* Softly Animated SVG Connector Lines */}
          <div aria-hidden="true" className="hidden md:block w-full h-24 relative -my-1">
            <svg
              viewBox="0 0 900 100"
              fill="none"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              <defs>
                <linearGradient
                  id="blispHubGrad"
                  x1="150"
                  y1="0"
                  x2="750"
                  y2="100"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#DF5F2C" />
                  <stop offset="50%" stopColor="#D47E31" />
                  <stop offset="100%" stopColor="#C59B38" />
                </linearGradient>
              </defs>

              <path
                d="M450 0 C450 52, 150 42, 150 100"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-[#322C25]/12 dark:text-[#F5F2EC]/12"
              />
              <path
                d="M450 0 L450 100"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-[#322C25]/12 dark:text-[#F5F2EC]/12"
              />
              <path
                d="M450 0 C450 52, 750 42, 750 100"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-[#322C25]/12 dark:text-[#F5F2EC]/12"
              />

              <motion.path
                d="M450 0 C450 52, 150 42, 150 100"
                stroke="url(#blispHubGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="10 14"
                animate={shouldReduceMotion ? undefined : { strokeDashoffset: [48, 0] }}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : { duration: 2.8, repeat: Infinity, ease: 'linear' }
                }
              />
              <motion.path
                d="M450 0 L450 100"
                stroke="url(#blispHubGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="10 14"
                animate={shouldReduceMotion ? undefined : { strokeDashoffset: [48, 0] }}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : { duration: 2.8, repeat: Infinity, ease: 'linear', delay: 0.4 }
                }
              />
              <motion.path
                d="M450 0 C450 52, 750 42, 750 100"
                stroke="url(#blispHubGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="10 14"
                animate={shouldReduceMotion ? undefined : { strokeDashoffset: [48, 0] }}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : { duration: 2.8, repeat: Infinity, ease: 'linear', delay: 0.8 }
                }
              />
            </svg>
          </div>

          <div
            aria-hidden="true"
            className="md:hidden w-[2px] h-10 bg-gradient-to-b from-[#DF5F2C] to-[#C59B38]/40 my-1"
          />

          {/* Three Integration Nodes */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
            {NODES.map((node, idx) => {
              const iconClasses =
                node.accent === 'ochre'
                  ? 'bg-[#C59B38]/14 text-[#7A5A12] dark:text-[#D6AB4E] border-[#C59B38]/25'
                  : 'bg-[#DF5F2C]/12 text-[#B54217] dark:text-[#E86F3F] border-[#DF5F2C]/25';

              return (
                <motion.div
                  key={node.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{
                    duration: 0.58,
                    delay: shouldReduceMotion ? 0 : idx * 0.1,
                    ease: EASE_BLISP,
                  }}
                  className="flex"
                >
                  <GlassCard
                    padding="md"
                    interactive
                    className="w-full flex flex-col items-center text-center gap-3.5"
                  >
                    <div
                      aria-hidden="true"
                      className={`w-12 h-12 rounded-[14px] border flex items-center justify-center ${iconClasses}`}
                    >
                      {node.icon}
                    </div>
                    <h3 className="blisp-h3 text-[#1C1815] dark:text-[#F5F2EC]">{node.name}</h3>
                    <p className="text-[14.5px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2]">
                      {node.description}
                    </p>
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
