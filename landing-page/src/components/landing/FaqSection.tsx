import React, { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { Eyebrow, GlassCard, Section } from '../ui';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'voice-data',
    question: 'How is my voice data handled?',
    answer:
      'Your spoken notes are transcribed so Blisp and Gemini can analyze gaps, surface relevant resources, and draft starter tasks for your project. Your ideas belong to your workspace and are never sold or shared for advertising.',
  },
  {
    id: 'platforms',
    question: 'Which platforms will Blisp support?',
    answer:
      'Blisp is being built with Expo and React Native with a mobile-first experience in mind. Launch availability will be shared for Android users first, with iOS following soon as iOS syncing behavior is still being finalized ahead of launch.',
  },
  {
    id: 'github-commits',
    question: 'How do GitHub commits work?',
    answer:
      'You connect a repository with read-only access and include a task code such as BLISP-01629f98 in your commit message. When you sync commits in Blisp, matching tasks are checked off automatically—Blisp never pushes to your repository.',
  },
  {
    id: 'team-work',
    question: 'Can I work with my team?',
    answer:
      'Yes. You can share an invite link or project code with collaborators, assign roles, claim or reassign tasks, and keep conversation attached directly to each task.',
  },
  {
    id: 'cost',
    question: 'What will it cost?',
    answer: 'Pricing will be announced closer to launch. Early access members will hear first.',
  },
  {
    id: 'offline',
    question: 'Does it work offline?',
    answer:
      'AI incubation, Gemini gap research, and GitHub commit syncing require an internet connection. Offline draft capture and syncing behavior are still being finalized ahead of launch.',
  },
];

export const FaqSection: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <Section id="faq" aria-labelledby="faq-heading" spacing="default" className="scroll-mt-20">
      <div className="max-w-[840px] mx-auto space-y-10">
        <div className="space-y-3 text-center">
          <Eyebrow tone="teal">FAQ</Eyebrow>
          <h2 id="faq-heading" className="blisp-h1 text-[#1C1815] dark:text-[#F5F2EC]">
            Questions, answered plainly.
          </h2>
          <p className="text-[16px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2] max-w-xl mx-auto">
            Everything we can share today as we get Blisp ready for early access.
          </p>
        </div>

        <GlassCard
          padding="none"
          className="divide-y divide-[#322C25]/[0.08] dark:divide-[#F5F2EC]/[0.08] overflow-hidden"
        >
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            const buttonId = `faq-trigger-${item.id}`;
            const panelId = `faq-panel-${item.id}`;

            return (
              <div key={item.id}>
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleItem(idx)}
                    className="w-full min-h-[56px] px-6 sm:px-8 py-5 sm:py-6 flex items-center justify-between gap-4 text-left transition-colors hover:bg-[#322C25]/[0.03] dark:hover:bg-[#F5F2EC]/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F]"
                  >
                    <span className="text-[16px] sm:text-[17.5px] font-semibold tracking-[-0.015em] text-[#1C1815] dark:text-[#F5F2EC]">
                      {item.question}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-[transform,background-color,border-color,color] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isOpen
                          ? 'rotate-180 bg-[#DF5F2C]/14 border-[#DF5F2C]/35 text-[#B54217] dark:text-[#E86F3F]'
                          : 'bg-[#F5F2EC]/60 dark:bg-[#F5F2EC]/[0.05] border-[#322C25]/10 dark:border-[#F5F2EC]/10 text-[#5D5851] dark:text-[#A59D92]'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" strokeWidth={2.1} />
                    </span>
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!isOpen}
                  className={`grid transition-[grid-template-rows] ${
                    shouldReduceMotion
                      ? 'duration-0'
                      : 'duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]'
                  } ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <div
                      className={`px-6 sm:px-8 pb-6 pt-0.5 text-[15px] sm:text-[15.5px] leading-[1.65] text-[#5D5851] dark:text-[#C5BDB2] max-w-[68ch] transition-[opacity,transform] ${
                        shouldReduceMotion
                          ? 'duration-0'
                          : 'duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]'
                      } ${
                        isOpen
                          ? 'opacity-100 translate-y-0 visible'
                          : 'opacity-0 -translate-y-1 invisible'
                      }`}
                    >
                      {item.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </GlassCard>
      </div>
    </Section>
  );
};
