import React, { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { Play } from 'lucide-react';
import { useDemoMode } from '../../context/DemoModeContext';
import { Button, Eyebrow, GlassCard, PhoneMockup, Section } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

const HERO_WORDS: { text: string; highlight: boolean; lineBreakAfter?: boolean }[] = [
  { text: 'Speak', highlight: true },
  { text: 'it.', highlight: false },
  { text: 'Shape', highlight: true },
  { text: 'it.', highlight: false, lineBreakAfter: true },
  { text: 'Ship', highlight: true },
  { text: 'it.', highlight: false },
];

function scrollToSection(href: string) {
  const id = href.replace(/^#/, '');
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', href);
  }
}

export const Hero: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const { speedMultiplier, demoRunId } = useDemoMode();
  const stageRef = useRef<HTMLDivElement>(null);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const springConfig = { stiffness: 140, damping: 22, mass: 0.8 };
  const smoothX = useSpring(pointerX, springConfig);
  const smoothY = useSpring(pointerY, springConfig);

  const phoneRotateY = useTransform(smoothX, [-1, 1], [-5, 5]);
  const phoneRotateX = useTransform(smoothY, [-1, 1], [4, -4]);

  const cardTopX = useTransform(smoothX, [-1, 1], [-10, 10]);
  const cardTopY = useTransform(smoothY, [-1, 1], [-7, 7]);
  const cardMidX = useTransform(smoothX, [-1, 1], [12, -12]);
  const cardMidY = useTransform(smoothY, [-1, 1], [6, -6]);
  const cardBotX = useTransform(smoothX, [-1, 1], [-8, 8]);
  const cardBotY = useTransform(smoothY, [-1, 1], [8, -8]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || e.pointerType === 'touch') return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointerX.set(Math.max(-1, Math.min(1, nx)));
    pointerY.set(Math.max(-1, Math.min(1, ny)));
  };

  const handlePointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div id="top" className="relative overflow-hidden">
      {/* Slow-moving Warm Terracotta & Ochre Ambient Orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [0, 32, -18, 0],
                  y: [0, -24, 16, 0],
                  scale: [1, 1.08, 0.96, 1],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 18, repeat: Infinity, ease: EASE_BLISP }
          }
          className="absolute -top-32 -left-24 w-[420px] sm:w-[560px] h-[420px] sm:h-[560px] rounded-full bg-[#DF5F2C]/14 dark:bg-[#E86F3F]/14 blur-[115px]"
        />
        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [0, -34, 20, 0],
                  y: [0, 26, -18, 0],
                  scale: [1, 0.94, 1.07, 1],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 22, repeat: Infinity, ease: EASE_BLISP }
          }
          className="absolute top-12 -right-24 w-[380px] sm:w-[540px] h-[380px] sm:h-[540px] rounded-full bg-[#C59B38]/16 dark:bg-[#D6AB4E]/12 blur-[115px]"
        />
        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [0, 18, -14, 0],
                  y: [0, 14, -12, 0],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 20, repeat: Infinity, ease: EASE_BLISP }
          }
          className="hidden md:block absolute -bottom-28 left-1/3 w-[440px] h-[320px] rounded-full bg-[#5F8C71]/12 dark:bg-[#6E9D80]/10 blur-[100px]"
        />
      </div>

      <Section
        key={demoRunId}
        aria-label="Hero overview"
        spacing="none"
        grid
        className="pt-8 pb-16 sm:pt-12 sm:pb-24 lg:pt-16 lg:pb-28"
      >
        {/* Left Column: Copy & CTAs */}
        <div className="col-span-4 md:col-span-12 lg:col-span-6 flex flex-col justify-center items-start gap-6 lg:pr-4">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45 * speedMultiplier,
              delay: 0.05 * speedMultiplier,
              ease: EASE_BLISP,
            }}
          >
            <Eyebrow tone="amber">
              AN AI-POWERED, VOICE-FIRST IDEA-TO-EXECUTION PLATFORM
            </Eyebrow>
          </motion.div>

          {/* Single H1 on page */}
          <h1 className="blisp-hero-title text-[#1C1815] dark:text-[#F5F2EC] max-w-[14ch]">
            {HERO_WORDS.map((word, idx) => (
              <React.Fragment key={`${word.text}-${idx}`}>
                <motion.span
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.46 * speedMultiplier,
                    delay: (0.1 + idx * 0.06) * speedMultiplier,
                    ease: EASE_BLISP,
                  }}
                  className={`inline-block mr-[0.22em] ${
                    word.highlight ? 'blisp-gradient-text' : ''
                  }`}
                >
                  {word.text}
                </motion.span>
                {word.lineBreakAfter && <br className="hidden sm:inline" />}
              </React.Fragment>
            ))}
          </h1>

          {/* Subhead */}
          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.48 * speedMultiplier,
              delay: 0.38 * speedMultiplier,
              ease: EASE_BLISP,
            }}
            className="text-[17px] sm:text-[19px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2] max-w-[46ch]"
          >
            Speak a messy thought. Blisp turns it into a researched, task-ready project.
          </motion.p>

          {/* CTAs + Pre-launch Honest Note */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.48 * speedMultiplier,
              delay: 0.46 * speedMultiplier,
              ease: EASE_BLISP,
            }}
            className="w-full flex flex-col gap-3.5 pt-1"
          >
            <div className="flex flex-wrap items-center gap-3.5">
              <Button
                variant="primary"
                size="lg"
                href="#early-access"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('#early-access');
                }}
              >
                Get early access
              </Button>

              <Button
                variant="secondary"
                size="lg"
                href="#how-it-works"
                leftIcon={
                  <Play
                    className="w-4 h-4 text-[#DF5F2C] dark:text-[#E86F3F]"
                    fill="currentColor"
                    strokeWidth={1.8}
                  />
                }
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('#how-it-works');
                }}
              >
                See how it works
              </Button>
            </div>

            <p className="text-[13px] font-medium text-[#5D5851] dark:text-[#A59D92]">
              Launching soon. Join the early access list.
            </p>
          </motion.div>
        </div>

        {/* Right Column: Tilted PhoneMockup + Pulsing Halo + 3 Floating Cards */}
        <motion.div
          ref={stageRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.6 * speedMultiplier,
            delay: 0.3 * speedMultiplier,
            ease: EASE_BLISP,
          }}
          className="col-span-4 md:col-span-12 lg:col-span-6 relative flex flex-col items-center justify-center pt-4 lg:pt-0 min-h-[500px] sm:min-h-[640px]"
          style={{ perspective: 1200 }}
        >
          {/* Subtle Pulsing Ring Behind Phone */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <motion.div
              animate={
                shouldReduceMotion
                  ? undefined
                  : { scale: [0.96, 1.05, 0.96], opacity: [0.45, 0.85, 0.45] }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : { duration: 4.4, repeat: Infinity, ease: EASE_BLISP }
              }
              className="w-[330px] h-[330px] sm:w-[440px] sm:h-[440px] rounded-full border border-[#DF5F2C]/25 dark:border-[#E86F3F]/22 bg-gradient-to-tr from-[#DF5F2C]/10 via-transparent to-[#C59B38]/10 blur-[1px]"
            />
            <motion.div
              animate={
                shouldReduceMotion
                  ? undefined
                  : { scale: [1.04, 0.97, 1.04], opacity: [0.25, 0.5, 0.25] }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : { duration: 5.6, repeat: Infinity, ease: EASE_BLISP }
              }
              className="absolute w-[390px] h-[390px] sm:w-[520px] sm:h-[520px] rounded-full border border-[#C59B38]/22 dark:border-[#D6AB4E]/15"
            />
          </div>

          {/* Interactive 3D-Tilted PhoneMockup */}
          <motion.div
            style={
              shouldReduceMotion
                ? undefined
                : {
                    rotateX: phoneRotateX,
                    rotateY: phoneRotateY,
                    transformStyle: 'preserve-3d',
                  }
            }
            className="relative z-10 flex items-center justify-center"
          >
            <PhoneMockup screenId="03-capture-idea" size="lg" priority />
          </motion.div>

          {/* 3 Floating Stone Cards */}
          <div className="w-full max-w-[420px] mt-5 grid grid-cols-1 gap-2.5 sm:block sm:mt-0 sm:max-w-none">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45 * speedMultiplier,
                delay: 0.48 * speedMultiplier,
                ease: EASE_BLISP,
              }}
              style={shouldReduceMotion ? undefined : { x: cardTopX, y: cardTopY }}
              className="sm:absolute sm:top-10 sm:left-0 lg:-left-6 z-20"
            >
              <motion.div
                animate={shouldReduceMotion ? undefined : { y: [0, -7, 0] }}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : { duration: 5.2, repeat: Infinity, ease: EASE_BLISP }
                }
              >
                <GlassCard
                  padding="none"
                  className="px-4 py-2.5 rounded-[18px] inline-flex items-center gap-2 text-[13px] font-medium text-[#1C1815] dark:text-[#F5F2EC] sm:whitespace-nowrap"
                >
                  <span aria-hidden="true">✨</span>
                  <span>Starter tasks generated</span>
                </GlassCard>
              </motion.div>
            </motion.div>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45 * speedMultiplier,
                delay: 0.58 * speedMultiplier,
                ease: EASE_BLISP,
              }}
              style={shouldReduceMotion ? undefined : { x: cardMidX, y: cardMidY }}
              className="sm:absolute sm:top-[44%] sm:right-0 lg:-right-4 z-20"
            >
              <motion.div
                animate={shouldReduceMotion ? undefined : { y: [0, 8, 0] }}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : { duration: 6.1, delay: 0.4, repeat: Infinity, ease: EASE_BLISP }
                }
              >
                <GlassCard
                  padding="none"
                  className="px-4 py-2.5 rounded-[18px] inline-flex items-center gap-2 text-[13px] font-medium text-[#1C1815] dark:text-[#F5F2EC] sm:whitespace-nowrap"
                >
                  <span aria-hidden="true">✅</span>
                  <span>Committed to GitHub</span>
                </GlassCard>
              </motion.div>
            </motion.div>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45 * speedMultiplier,
                delay: 0.68 * speedMultiplier,
                ease: EASE_BLISP,
              }}
              style={shouldReduceMotion ? undefined : { x: cardBotX, y: cardBotY }}
              className="sm:absolute sm:bottom-10 sm:left-2 lg:-left-4 z-20"
            >
              <motion.div
                animate={shouldReduceMotion ? undefined : { y: [0, -6, 0] }}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : { duration: 5.8, delay: 0.9, repeat: Infinity, ease: EASE_BLISP }
                }
              >
                <GlassCard
                  padding="none"
                  className="px-4 py-2.5 rounded-[18px] inline-flex items-center gap-2 text-[13px] font-medium text-[#1C1815] dark:text-[#F5F2EC] sm:whitespace-nowrap"
                >
                  <span aria-hidden="true">🔔</span>
                  <span>Show your to-do list who is the boss</span>
                </GlassCard>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </Section>
    </div>
  );
};
