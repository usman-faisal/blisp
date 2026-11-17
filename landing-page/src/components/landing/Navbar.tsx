import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { useDemoMode } from '../../context/DemoModeContext';
import { BlispLogo, Button, ThemeToggle } from '../ui';

const EASE_BLISP: [number, number, number, number] = [0.22, 1, 0.36, 1];

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'FAQ', href: '#faq' },
];

function scrollToTarget(href: string) {
  const id = href.replace(/^#/, '');
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', href);
  }
}

export const Navbar: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const { speedMultiplier, demoRunId } = useDemoMode();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 32,
    restDelta: 0.001,
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    scrollToTarget(href);
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-[background-color,border-color,box-shadow,backdrop-filter] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isScrolled
          ? 'bg-[#F5F2EC]/88 dark:bg-[#141210]/88 backdrop-blur-xl border-b border-[#322C25]/[0.09] dark:border-[#F5F2EC]/[0.09] shadow-[0_8px_28px_-12px_rgba(32,26,20,0.09)] dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.65)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div key={demoRunId} className="max-w-[1200px] mx-auto px-6 md:px-8 h-[68px] flex items-center justify-between gap-6">
        {/* Blisp Logo + Subtle Navbar Pulse */}
        <motion.a
          href="#top"
          aria-label="Blisp home"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
            setMobileMenuOpen(false);
          }}
          initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.45 * speedMultiplier,
            delay: 0.05 * speedMultiplier,
            ease: EASE_BLISP,
          }}
          className="inline-flex items-center whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DF5F2C] dark:focus-visible:ring-[#E86F3F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F2EC] dark:focus-visible:ring-offset-[#141210]"
        >
          <BlispLogo variant="full" size="md" animated />
        </motion.a>

        {/* Desktop Nav Links */}
        <motion.nav
          aria-label="Primary navigation"
          initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.45 * speedMultiplier,
            delay: 0.28 * speedMultiplier,
            ease: EASE_BLISP,
          }}
          className="hidden lg:flex items-center gap-7"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleLinkClick(e, link.href)}
              className="min-h-[44px] inline-flex items-center text-[14px] font-medium text-[#5D5851] dark:text-[#C5BDB2] hover:text-[#1C1815] dark:hover:text-[#F5F2EC] transition-colors whitespace-nowrap shrink-0 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F]"
            >
              {link.label}
            </a>
          ))}
        </motion.nav>

        {/* Desktop Actions + Mobile Controls */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.45 * speedMultiplier,
            delay: 0.28 * speedMultiplier,
            ease: EASE_BLISP,
          }}
          className="flex items-center gap-2.5 shrink-0"
        >
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <Button
            variant="primary"
            size="sm"
            href="#early-access"
            onClick={(e) => handleLinkClick(e, '#early-access')}
            className="hidden sm:inline-flex"
          >
            Get early access
          </Button>

          {/* Animated Hamburger Toggle for Mobile/Tablet */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden min-w-[44px] min-h-[44px] rounded-[12px] inline-flex items-center justify-center
              bg-[#EFEBE2]/85 dark:bg-[#201C18]/85 text-[#1C1815] dark:text-[#F5F2EC]
              border border-[#322C25]/10 dark:border-[#F5F2EC]/12 backdrop-blur-xl
              hover:bg-[#E9E2D8] dark:hover:bg-[#2A241F] active:scale-[0.97]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DF5F2C] dark:focus-visible:ring-[#E86F3F]
              transition-[transform,background-color] duration-200"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileMenuOpen ? (
                <motion.span
                  key="close"
                  initial={shouldReduceMotion ? false : { opacity: 0, rotate: -45, scale: 0.85 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, rotate: 45, scale: 0.85 }}
                  transition={{ duration: 0.16, ease: EASE_BLISP }}
                  className="inline-flex"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={shouldReduceMotion ? false : { opacity: 0, rotate: 45, scale: 0.85 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, rotate: -45, scale: 0.85 }}
                  transition={{ duration: 0.16, ease: EASE_BLISP }}
                  className="inline-flex"
                >
                  <Menu className="w-5 h-5" strokeWidth={2} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>
      </div>

      {/* Mobile Keyboard-Accessible Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-navigation-drawer"
            role="region"
            aria-label="Mobile navigation"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: EASE_BLISP }}
            className="lg:hidden border-b border-[#322C25]/[0.09] dark:border-[#F5F2EC]/[0.09] bg-[#F5F2EC]/95 dark:bg-[#141210]/95 backdrop-blur-2xl"
          >
            <nav aria-label="Mobile navigation" className="max-w-[1200px] mx-auto px-6 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleLinkClick(e, link.href)}
                  className="min-h-[44px] px-3 rounded-[12px] flex items-center text-[15px] font-medium text-[#1C1815] dark:text-[#F5F2EC] hover:bg-[#322C25]/[0.05] dark:hover:bg-[#F5F2EC]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DF5F2C] dark:focus-visible:ring-[#E86F3F] transition-colors"
                >
                  {link.label}
                </a>
              ))}

              <div className="pt-3 mt-2 border-t border-[#322C25]/[0.08] dark:border-[#F5F2EC]/[0.08] flex flex-wrap items-center justify-between gap-3">
                <ThemeToggle />
                <Button
                  variant="primary"
                  size="md"
                  href="#early-access"
                  onClick={(e) => handleLinkClick(e, '#early-access')}
                  className="flex-1 sm:flex-initial"
                >
                  Get early access
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thin Terracotta-to-Ochre Scroll-Progress Bar */}
      <div
        aria-hidden="true"
        className="w-full h-[2px] bg-[#322C25]/[0.05] dark:bg-[#F5F2EC]/[0.06] overflow-hidden"
      >
        <motion.div
          style={{ scaleX: shouldReduceMotion ? 0 : scaleX, transformOrigin: '0% 50%' }}
          className="w-full h-full bg-gradient-to-r from-[#DF5F2C] via-[#D47E31] to-[#C59B38]"
        />
      </div>
    </header>
  );
};
