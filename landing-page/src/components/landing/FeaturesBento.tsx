import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Bell, GitBranch, Link2, LogIn, Mic, Sparkles } from 'lucide-react';
import { AppScreenshotId } from '../../data/screenshots';
import { Eyebrow, GlassCard, PhoneMockup, Section } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface BentoFeatureSpec {
  id: string;
  title: string;
  description: string;
  screenId: AppScreenshotId;
  icon: React.ReactNode;
  accent: 'terracotta' | 'ochre';
  layoutClass: string;
  variant: 'wide-left' | 'tall-offset' | 'compact-tilt-left' | 'compact-tilt-right' | 'wide-right';
  hasWaveform?: boolean;
}

const BENTO_FEATURES: BentoFeatureSpec[] = [
  {
    id: 'voice-brain-dump',
    title: 'Voice Brain Dump',
    description:
      'Speak an unfiltered thought with a live transcript so nothing slips away between meetings or walks.',
    screenId: '03-capture-idea',
    icon: <Mic className="w-4 h-4" strokeWidth={2} />,
    accent: 'terracotta',
    layoutClass: 'md:col-span-2 lg:col-span-7',
    variant: 'wide-left',
    hasWaveform: true,
  },
  {
    id: 'ai-incubation',
    title: 'AI Incubation',
    description:
      'Gemini researches market angles, spots gaps, and shapes raw notes into starter tasks ready to review.',
    screenId: '02-incubator',
    icon: <Sparkles className="w-4 h-4" strokeWidth={2} />,
    accent: 'ochre',
    layoutClass: 'md:col-span-1 lg:col-span-5',
    variant: 'tall-offset',
  },
  {
    id: 'collaborate-by-link',
    title: 'Collaborate by link',
    description:
      'Invite co-founders or teammates with a single shareable link and clean role controls.',
    screenId: '12-invite-collaborate',
    icon: <Link2 className="w-4 h-4" strokeWidth={2} />,
    accent: 'terracotta',
    layoutClass: 'md:col-span-1 lg:col-span-4',
    variant: 'compact-tilt-left',
  },
  {
    id: 'google-sign-in',
    title: 'One-tap Google sign-in',
    description:
      'Jump straight into capturing and organizing without password fatigue or complex setup.',
    screenId: '11-sign-up-google',
    icon: <LogIn className="w-4 h-4" strokeWidth={2} />,
    accent: 'ochre',
    layoutClass: 'md:col-span-1 lg:col-span-4',
    variant: 'compact-tilt-right',
  },
  {
    id: 'github-sync',
    title: 'GitHub Sync',
    description:
      'Tag commits with task references so merged code automatically verifies and checks off milestones.',
    screenId: '13-connect-github',
    icon: <GitBranch className="w-4 h-4" strokeWidth={2} />,
    accent: 'terracotta',
    layoutClass: 'md:col-span-1 lg:col-span-4',
    variant: 'compact-tilt-left',
  },
  {
    id: 'smart-nudges',
    title: 'Smart Nudges',
    description:
      'Calm, well-timed reminders keep pending tasks moving without turning your phone into a noisy wall of alerts.',
    screenId: '14-smart-nudges',
    icon: <Bell className="w-4 h-4" strokeWidth={2} />,
    accent: 'ochre',
    layoutClass: 'md:col-span-2 lg:col-span-12',
    variant: 'wide-right',
  },
];

const WAVEFORM_HEIGHTS = [12, 22, 16, 30, 18, 28, 14, 26, 20, 32, 16, 24, 14];

const WaveformAccent: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-[#F5F2EC]/80 dark:bg-[#141210]/60 border border-[#322C25]/[0.08] dark:border-[#F5F2EC]/[0.09] w-fit"
    >
      {WAVEFORM_HEIGHTS.map((height, i) => (
        <span
          key={i}
          style={{
            height: `${height * 0.72}px`,
            animationDelay: shouldReduceMotion ? undefined : `${i * 0.14}s`,
          }}
          className={`w-[2.5px] rounded-full ${
            shouldReduceMotion ? '' : 'animate-blisp-wave'
          } ${
            i % 3 === 0
              ? 'bg-[#DF5F2C] dark:bg-[#E86F3F]'
              : i % 3 === 1
              ? 'bg-[#C59B38] dark:bg-[#D6AB4E]'
              : 'bg-gradient-to-b from-[#DF5F2C] to-[#C59B38]'
          }`}
        />
      ))}
    </div>
  );
};

interface SpotlightBentoCardProps {
  feature: BentoFeatureSpec;
  index: number;
}

const SpotlightBentoCard: React.FC<SpotlightBentoCardProps> = ({ feature, index }) => {
  const shouldReduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || e.pointerType === 'touch') return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSpotlight({ x, y, active: true });
  };

  const handlePointerLeave = () => {
    setSpotlight((prev) => ({ ...prev, active: false }));
  };

  const iconTone =
    feature.accent === 'ochre'
      ? 'bg-[#C59B38]/14 text-[#7A5A12] dark:text-[#D6AB4E] border-[#C59B38]/25'
      : 'bg-[#DF5F2C]/12 text-[#B54217] dark:text-[#E86F3F] border-[#DF5F2C]/25';

  const isHorizontal = feature.variant === 'wide-left' || feature.variant === 'wide-right';

  return (
    <motion.div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.62,
        delay: shouldReduceMotion ? 0 : index * 0.08,
        ease: EASE_BLISP,
      }}
      className={`group relative rounded-[20px] transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        shouldReduceMotion ? '' : 'hover:-translate-y-1'
      } ${feature.layoutClass}`}
    >
      {/* Cursor-Following Border & Ambient Spotlight */}
      <div
        aria-hidden="true"
        style={{
          opacity: spotlight.active ? 1 : 0,
          background: `radial-gradient(360px circle at ${spotlight.x}px ${spotlight.y}px, ${
            feature.accent === 'ochre'
              ? 'rgba(197, 155, 56, 0.38)'
              : 'rgba(223, 95, 44, 0.38)'
          }, transparent 70%)`,
        }}
        className="pointer-events-none absolute -inset-[1px] rounded-[21px] transition-opacity duration-300 -z-0"
      />

      <GlassCard
        padding="none"
        className={`relative z-10 h-full overflow-hidden transition-[box-shadow,border-color] duration-[260ms] ${
          spotlight.active
            ? 'shadow-[0_20px_48px_-14px_rgba(223,95,44,0.18)] dark:shadow-[0_24px_54px_-14px_rgba(232,111,63,0.16)]'
            : ''
        }`}
      >
        <div
          aria-hidden="true"
          style={{
            opacity: spotlight.active ? 1 : 0,
            background: `radial-gradient(420px circle at ${spotlight.x}px ${spotlight.y}px, ${
              feature.accent === 'ochre'
                ? 'rgba(197, 155, 56, 0.08)'
                : 'rgba(223, 95, 44, 0.08)'
            }, transparent 68%)`,
          }}
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        />

        <div
          className={`relative z-10 h-full flex ${
            isHorizontal
              ? 'flex-col md:flex-row items-stretch justify-between'
              : 'flex-col justify-between'
          }`}
        >
          {/* Copy Column */}
          <div
            className={`p-6 sm:p-7 flex flex-col gap-3.5 ${
              isHorizontal ? 'md:w-[54%] justify-center' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 ${iconTone}`}
              >
                {feature.icon}
              </div>
              <h3 className="blisp-h3 text-[#1C1815] dark:text-[#F5F2EC]">{feature.title}</h3>
            </div>

            <p className="text-[15px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2] max-w-[44ch]">
              {feature.description}
            </p>

            {feature.hasWaveform && (
              <div className="pt-1">
                <WaveformAccent />
              </div>
            )}
          </div>

          {/* Cropped / Tilted / Offset PhoneMockup Stage */}
          <div
            className={`relative overflow-hidden flex justify-center ${
              isHorizontal
                ? 'md:w-[46%] pt-2 md:pt-7 px-6 min-h-[250px] md:min-h-[290px] items-start'
                : 'pt-2 px-6 min-h-[245px] items-start'
            }`}
          >
            <div
              className={`transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                feature.variant === 'wide-left'
                  ? `translate-y-4 -rotate-3 ${shouldReduceMotion ? '' : 'group-hover:translate-y-2 group-hover:-rotate-1'}`
                  : feature.variant === 'tall-offset'
                  ? `translate-y-5 translate-x-3 rotate-3 ${shouldReduceMotion ? '' : 'group-hover:translate-y-2 group-hover:rotate-1'}`
                  : feature.variant === 'compact-tilt-left'
                  ? `translate-y-4 -rotate-3 ${shouldReduceMotion ? '' : 'group-hover:translate-y-2 group-hover:-rotate-1'}`
                  : feature.variant === 'compact-tilt-right'
                  ? `translate-y-4 rotate-3 ${shouldReduceMotion ? '' : 'group-hover:translate-y-2 group-hover:rotate-1'}`
                  : `translate-y-4 translate-x-2 -rotate-2 ${shouldReduceMotion ? '' : 'group-hover:translate-y-2 group-hover:rotate-0'}`
              }`}
            >
              <PhoneMockup screenId={feature.screenId} size="sm" priority={false} />
            </div>

            {/* Bottom Soft Fade */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#EFEBE2]/90 via-[#EFEBE2]/35 to-transparent dark:from-[#201C18]/92 dark:via-[#201C18]/40 dark:to-transparent"
            />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

export const FeaturesBento: React.FC = () => {
  return (
    <Section id="features" aria-labelledby="features-heading" spacing="default" className="scroll-mt-20">
      <div className="space-y-12">
        <div className="space-y-3 max-w-2xl">
          <Eyebrow tone="teal">Features</Eyebrow>
          <h2 id="features-heading" className="blisp-h1 text-[#1C1815] dark:text-[#F5F2EC]">
            Everything between a spark and a shipped product.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
          {BENTO_FEATURES.map((feature, idx) => (
            <SpotlightBentoCard key={feature.id} feature={feature} index={idx} />
          ))}
        </div>
      </div>
    </Section>
  );
};
