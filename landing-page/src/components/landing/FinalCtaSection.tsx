import React, { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CheckCircle2, Loader2, Smartphone, TabletSmartphone } from 'lucide-react';
import { BlispLogo, Button, Eyebrow, GlassCard, Section } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type SubmitStatus = 'idle' | 'loading' | 'success';

export const FinalCtaSection: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const inputId = useId();
  const errorId = useId();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmitStatus>('idle');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'loading') return;

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address to join the early access list.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setStatus('loading');

    window.setTimeout(() => {
      setStatus('success');
    }, 650);
  };

  return (
    <Section id="early-access" aria-labelledby="early-access-heading" spacing="default" className="scroll-mt-20">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-6 -inset-y-6 -z-10 flex items-center justify-center overflow-hidden"
        >
          <div className="w-[480px] h-[280px] rounded-full bg-gradient-to-r from-[#DF5F2C]/16 via-[#D47E31]/12 to-[#C59B38]/18 blur-[95px]" />
        </div>

        <GlassCard padding="lg" className="relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-8 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <BlispLogo variant="mark" size="sm" />
                  <Eyebrow tone="teal">Early Access</Eyebrow>
                </div>
                <h2 id="early-access-heading" className="blisp-h1 text-[#1C1815] dark:text-[#F5F2EC]">
                  <span className="blisp-gradient-text">Speak</span> it.{' '}
                  <span className="blisp-gradient-text">Shape</span> it.{' '}
                  <span className="blisp-gradient-text">Ship</span> it.
                </h2>
                <p className="text-[16px] sm:text-[17px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2] max-w-[48ch]">
                  Join the early access list to hear when Blisp opens its first mobile wave. No
                  spam—just launch updates.
                </p>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {status === 'success' ? (
                  <motion.div
                    key="waitlist-success"
                    role="status"
                    aria-live="polite"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.3, ease: EASE_BLISP }}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] px-5 py-4 bg-[#5F8C71]/14 border border-[#5F8C71]/35"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2
                        className="w-5 h-5 text-[#4A7C59] dark:text-[#7DB090] shrink-0"
                        strokeWidth={2}
                      />
                      <p className="text-[15.5px] font-semibold text-[#1C1815] dark:text-[#F5F2EC]">
                        You&apos;re on the list ✨
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('');
                        setStatus('idle');
                      }}
                      className="min-h-[44px] inline-flex items-center px-2 text-[13px] font-medium text-[#B54217] dark:text-[#E86F3F] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F] rounded"
                    >
                      Use a different email
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="waitlist-form"
                    noValidate
                    onSubmit={handleSubmit}
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2.5 max-w-xl"
                  >
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <label htmlFor={inputId} className="sr-only">
                        Email address
                      </label>
                      <input
                        id={inputId}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        disabled={status === 'loading'}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        aria-invalid={error ? 'true' : 'false'}
                        aria-describedby={error ? errorId : undefined}
                        placeholder="you@example.com"
                        className="flex-1 min-h-[50px] px-5 rounded-full text-[15px] text-[#1C1815] dark:text-[#F5F2EC] placeholder:text-[#67625B] dark:placeholder:text-[#A59D92] bg-[#FAF8F5]/90 dark:bg-[#141210]/85 border border-[#322C25]/14 dark:border-[#F5F2EC]/14 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-[#C64A1B] dark:focus:ring-[#E86F3F] focus:border-transparent transition-shadow disabled:opacity-60"
                      />

                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        disabled={status === 'loading'}
                        rightIcon={
                          status === 'loading' ? (
                            <Loader2
                              className={`w-4 h-4 ${shouldReduceMotion ? '' : 'animate-spin'}`}
                            />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )
                        }
                      >
                        {status === 'loading' ? 'Joining...' : 'Get early access'}
                      </Button>
                    </div>

                    {error && (
                      <p
                        id={errorId}
                        role="alert"
                        className="text-[13px] font-medium text-[#B42318] dark:text-[#F28B82] pl-2"
                      >
                        {error}
                      </p>
                    )}
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
              <div className="w-full sm:flex-1 lg:w-full lg:max-w-[260px] rounded-[18px] blisp-glass-subtle px-4 py-3.5 flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="w-10 h-10 rounded-[12px] bg-[#DF5F2C]/12 border border-[#DF5F2C]/25 text-[#B54217] dark:text-[#E86F3F] flex items-center justify-center shrink-0"
                >
                  <TabletSmartphone className="w-5 h-5" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <p className="font-mono-code text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5D5851] dark:text-[#A59D92]">
                    Coming soon · First
                  </p>
                  <p className="text-[14.5px] font-semibold text-[#1C1815] dark:text-[#F5F2EC]">
                    Android App
                  </p>
                </div>
              </div>

              <div className="w-full sm:flex-1 lg:w-full lg:max-w-[260px] rounded-[18px] blisp-glass-subtle px-4 py-3.5 flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="w-10 h-10 rounded-[12px] bg-[#C59B38]/14 border border-[#C59B38]/25 text-[#7A5A12] dark:text-[#D6AB4E] flex items-center justify-center shrink-0"
                >
                  <Smartphone className="w-5 h-5" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <p className="font-mono-code text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5D5851] dark:text-[#A59D92]">
                    Following soon
                  </p>
                  <p className="text-[14.5px] font-semibold text-[#1C1815] dark:text-[#F5F2EC]">
                    iOS App
                  </p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </Section>
  );
};
