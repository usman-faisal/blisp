import React, { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Code2, Download, Globe, Mail } from 'lucide-react';
import { BlispLogo } from '../ui';

interface FooterLink {
  label: string;
  href?: string;
  notice?: string;
}

interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Product tour', href: '#tour' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Integrations', href: '#integrations' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Why Blisp', href: '#why-blisp' },
      { label: 'Use cases', href: '#use-cases' },
      { label: 'Early access', href: '#early-access' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', notice: 'Privacy policy will be published ahead of launch.' },
      { label: 'Terms', notice: 'Terms of service will be published ahead of launch.' },
      { label: 'Security', notice: 'Security overview will be published ahead of launch.' },
    ],
  },
];

const SOCIAL_PLACEHOLDERS = [
  { label: 'Social profile placeholder', icon: Globe },
  { label: 'Developer updates placeholder', icon: Code2 },
  { label: 'Contact placeholder', icon: Mail },
];

export const Footer: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [notice, setNotice] = useState<string | null>(null);

  const handleAnchorScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (href === '#top') {
      window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
      return;
    }
    const id = href.replace(/^#/, '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  return (
    <footer className="border-t border-[#322C25]/[0.08] dark:border-[#F5F2EC]/[0.08] mt-8">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
          <div className="md:col-span-5 space-y-4">
            <a
              href="#top"
              aria-label="Blisp home"
              onClick={(e) => handleAnchorScroll(e, '#top')}
              className="min-h-[44px] inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F]"
            >
              <BlispLogo variant="full" size="md" />
            </a>

            <p className="text-[14.5px] leading-[1.6] text-[#5D5851] dark:text-[#C5BDB2] max-w-[36ch]">
              An AI-powered, voice-first idea-to-execution platform.
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              {SOCIAL_PLACEHOLDERS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    aria-label={item.label}
                    onClick={() =>
                      setNotice('Social channels will open when Blisp launches publicly.')
                    }
                    className="w-11 h-11 rounded-[12px] blisp-glass-subtle flex items-center justify-center text-[#5D5851] dark:text-[#C5BDB2] hover:text-[#1C1815] dark:hover:text-[#F5F2EC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F]"
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.9} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading} className="space-y-2">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#5D5851] dark:text-[#A59D92] pb-1">
                  {col.heading}
                </h2>
                <ul className="space-y-0.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href ? (
                        <a
                          href={link.href}
                          onClick={(e) => handleAnchorScroll(e, link.href!)}
                          className="min-h-[44px] inline-flex items-center text-[14.5px] text-[#5D5851] dark:text-[#C5BDB2] hover:text-[#1C1815] dark:hover:text-[#F5F2EC] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F]"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setNotice(link.notice ?? null)}
                          className="min-h-[44px] inline-flex items-center text-[14.5px] text-[#5D5851] dark:text-[#C5BDB2] hover:text-[#1C1815] dark:hover:text-[#F5F2EC] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F]"
                        >
                          {link.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#322C25]/[0.08] dark:border-[#F5F2EC]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[13.5px] text-[#5D5851] dark:text-[#A59D92]">© 2026 Blisp</p>
          <div className="flex flex-wrap items-center gap-4">
            {notice && (
              <p
                role="status"
                aria-live="polite"
                className="text-[13px] font-medium text-[#B54217] dark:text-[#E86F3F]"
              >
                {notice}
              </p>
            )}
            <a
              href="/blisp-landing-page.zip"
              download="blisp-landing-page.zip"
              className="min-h-[44px] inline-flex items-center gap-2 text-[13.5px] font-medium text-[#5D5851] dark:text-[#C5BDB2] hover:text-[#1C1815] dark:hover:text-[#F5F2EC] transition-colors rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C64A1B] dark:focus-visible:ring-[#E86F3F]"
            >
              <Download className="w-4 h-4 shrink-0" strokeWidth={1.9} />
              <span>Download source (.zip)</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
