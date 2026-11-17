import React from 'react';
import {
  ArrowUp,
  Bell,
  Check,
  Clock,
  Copy,
  GitBranch,
  GitCommitHorizontal,
  Infinity as InfinityIcon,
  Link2,
  Mail,
  Mic,
  Share2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { BlispLogo } from '../ui/BlispLogo';
import { ScreenBackHeader, ScreenShell } from './ScreenChrome';

/* 03: CAPTURE IDEA (VOICE & TYPE MESSAGE, UI/UX FROM SCREENSHOT) */
export const CaptureIdeaScreenRecreation: React.FC = () => (
  <ScreenShell activeTab="focus" time="2:54" battery="88">
    <ScreenBackHeader title="Capture idea" />

    <div className="flex-1 min-h-0 flex flex-col justify-between pb-1">
      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#DF5F2C] dark:text-[#E86F3F]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#DF5F2C] dark:bg-[#E86F3F]" />
          <span>VOICE &amp; TEXT CAPTURE</span>
        </div>

        {/* Live Transcript / Draft Card */}
        <div className="rounded-[16px] bg-[#E9E2D8] dark:bg-[#201C18] p-3 space-y-2">
          <p className="text-[10px] leading-[1.48] font-medium text-[#1C1815] dark:text-[#F5F2EC]">
            &ldquo;Build a calm mobile app for weekend builders where you speak a messy product
            idea, Gemini researches open gaps, and GitHub commits automatically check off tasks.&rdquo;
          </p>
          <div className="flex items-center justify-between text-[7.5px] text-[#67625B] dark:text-[#A59D92]">
            <span>Live transcript · 00:18</span>
            <span className="text-[#C59B38] dark:text-[#D6AB4E] font-medium">Ready to incubate</span>
          </div>
        </div>

        {/* Detected Intent Tags */}
        <div className="flex flex-wrap gap-1.5">
          {['Voice capture', 'Gemini gaps', 'GitHub sync'].map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-[#EFEBE2] dark:bg-[#201C18] border border-[#D8D2CA] dark:border-[#332C25] text-[7.5px] font-medium text-[#67625B] dark:text-[#C5BDB2]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Compact Waveform Strip */}
        <div className="rounded-[12px] bg-[#EFEBE2] dark:bg-[#1B1814] py-2.5 px-3 flex items-center justify-center gap-1">
          {[8, 15, 10, 22, 14, 24, 12, 20, 15, 22, 10, 16, 8].map((h, idx) => (
            <span
              key={idx}
              style={{ height: `${h}px` }}
              className={`w-[2.5px] rounded-full ${
                idx % 2 === 0
                  ? 'bg-[#DF5F2C] dark:bg-[#E86F3F]'
                  : 'bg-[#C59B38] dark:bg-[#D6AB4E]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Type Message + Record Button Pill matching Screenshot UI/UX */}
      <div className="pt-2 space-y-1.5">
        <div className="rounded-full bg-[#EFEBE2] dark:bg-[#201C18] border border-[#D8D2CA] dark:border-[#332C25] pl-3 pr-1.5 py-1.5 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <InfinityIcon
              className="w-4 h-4 text-[#AD9968] dark:text-[#D6AB4E] shrink-0"
              strokeWidth={1.9}
            />
            <span className="text-[9.5px] text-[#67625B] dark:text-[#A59D92] truncate">
              Unload your thoughts...
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="w-6 h-6 rounded-full bg-[#E9E2D8] dark:bg-[#2B251F] border border-[#D8D2CA] dark:border-[#3A322A] text-[#1C1815] dark:text-[#F5F2EC] flex items-center justify-center">
              <Mic className="w-3 h-3" strokeWidth={2} />
            </span>
            <span className="w-6 h-6 rounded-full bg-[#DF5F2C] dark:bg-[#E86F3F] text-white dark:text-[#141210] flex items-center justify-center">
              <ArrowUp className="w-3 h-3" strokeWidth={2.4} />
            </span>
          </div>
        </div>
        <p className="text-center text-[7px] text-[#67625B] dark:text-[#A59D92]">
          Type a message or tap the mic to record
        </p>
      </div>
    </div>
  </ScreenShell>
);

/* 11: SIGN UP / WELCOME */
export const SignUpWelcomeScreenRecreation: React.FC = () => (
  <ScreenShell time="9:00" battery="91">
    <div className="flex-1 flex flex-col justify-between py-3 px-0.5">
      <div className="space-y-3 pt-2">
        <BlispLogo variant="full" size="sm" />
        <p className="text-[7.5px] font-semibold uppercase tracking-[0.14em] text-[#C59B38] dark:text-[#D6AB4E] leading-relaxed">
          AN AI-POWERED, VOICE-FIRST IDEA-TO-EXECUTION PLATFORM
        </p>
        <p className="font-display text-[21px] font-extrabold tracking-[-0.03em] leading-[1.12] text-[#1C1815] dark:text-[#F5F2EC] pt-1">
          Speak your next big idea.
        </p>
        <p className="text-[9.5px] leading-[1.45] text-[#67625B] dark:text-[#C5BDB2]">
          Turn rough spoken thoughts into researched roadmaps without blank-page friction.
        </p>
      </div>

      <div className="space-y-2.5 pb-1">
        {/* Primary Google Button */}
        <div className="rounded-full bg-[#FAF8F5] dark:bg-[#201C18] border border-[#D8D2CA] dark:border-[#332C25] py-2.5 px-3.5 flex items-center justify-center gap-2 shadow-sm">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
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
          <span className="text-[10px] font-semibold text-[#1C1815] dark:text-[#F5F2EC]">
            Continue with Google
          </span>
        </div>

        {/* Hairline "or" Divider */}
        <div className="flex items-center gap-2 px-2">
          <span className="h-[1px] flex-1 bg-[#D8D2CA] dark:bg-[#332C25]" />
          <span className="text-[8px] uppercase tracking-[0.1em] text-[#9A948B]">or</span>
          <span className="h-[1px] flex-1 bg-[#D8D2CA] dark:bg-[#332C25]" />
        </div>

        {/* Email Ghost Button */}
        <div className="rounded-full bg-[#E9E2D8]/80 dark:bg-[#201C18]/70 py-2.5 px-3.5 flex items-center justify-center gap-2">
          <Mail className="w-3 h-3 text-[#67625B] dark:text-[#C5BDB2]" />
          <span className="text-[10px] font-medium text-[#322C25] dark:text-[#F5F2EC]">
            Continue with email
          </span>
        </div>

        <p className="text-[7.5px] leading-[1.4] text-center text-[#9A948B] px-2 pt-1">
          By continuing, you agree to Blisp&apos;s Terms and Privacy Policy.
        </p>
      </div>
    </div>
  </ScreenShell>
);

/* 12: INVITE & COLLABORATE (Strict reuse of Uploaded Image 10 Collaborators pattern) */
export const InviteCollaborateScreenRecreation: React.FC = () => (
  <ScreenShell time="1:26" battery="88">
    <ScreenBackHeader title="Collaborators" chevronStyle="chevron" />

    <div className="flex items-center justify-between -mt-1.5 mb-2.5">
      <span className="px-2 py-0.5 rounded-full bg-[#E9E2D8] dark:bg-[#201C18] text-[8px] font-medium text-[#67625B] dark:text-[#C5BDB2]">
        Basic Todo App
      </span>
      <span className="text-[8px] text-[#9A948B] tabular-nums">3 people</span>
    </div>

    {/* Invite Link Card + Copy Link + Share Row */}
    <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 space-y-2 mb-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#9A948B]">
          INVITE LINK
        </span>
        <span className="inline-flex items-center gap-1 text-[8px] text-[#67625B] dark:text-[#C5BDB2]">
          <Share2 className="w-2.5 h-2.5" /> Share
        </span>
      </div>
      <div className="rounded-[10px] bg-[#F5F2EC] dark:bg-[#141210] px-2 py-1.5 flex items-center justify-between gap-1.5">
        <span className="inline-flex items-center gap-1 text-[8px] text-[#322C25] dark:text-[#F5F2EC] truncate">
          <Link2 className="w-2.5 h-2.5 text-[#DF5F2C] shrink-0" />
          blisp.app/join/62G8CG27
        </span>
        <span className="px-2 py-0.5 rounded-full bg-[#DF5F2C] text-white text-[7.5px] font-semibold inline-flex items-center gap-1 shrink-0">
          <Copy className="w-2 h-2" /> Copy link
        </span>
      </div>
    </div>

    {/* Anyone with link toggle */}
    <div className="rounded-[12px] bg-[#E9E2D8] dark:bg-[#201C18] px-2.5 py-2 flex items-center justify-between gap-2 mb-2.5">
      <span className="text-[8.5px] font-medium leading-tight">
        Anyone with the link can join
      </span>
      <span className="w-7 h-4 rounded-full bg-[#DF5F2C] dark:bg-[#E86F3F] p-0.5 flex justify-end shrink-0">
        <span className="w-3 h-3 rounded-full bg-white" />
      </span>
    </div>

    {/* Collaborator List with Owner / Editor / Pending roles */}
    <div className="space-y-1.5">
      {[
        { initials: 'MU', name: 'mustafawarind03', role: 'Owner', tone: 'bg-[#DFCD9C]/60 text-[#8C6919]' },
        { initials: 'AL', name: 'alex.builder', role: 'Editor', tone: 'bg-[#F5F2EC] dark:bg-[#141210] text-[#5F8C71]' },
        { initials: 'TU', name: 'teammate@mail', role: 'Pending', tone: 'bg-[#F5F2EC] dark:bg-[#141210] text-[#9A948B]' },
      ].map((m) => (
        <div
          key={m.initials}
          className="rounded-[12px] bg-[#E9E2D8] dark:bg-[#201C18] px-2.5 py-1.5 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-full bg-[#6A7385] text-white text-[7.5px] font-semibold flex items-center justify-center shrink-0">
              {m.initials}
            </span>
            <span className="text-[8.5px] font-medium truncate">{m.name}</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[7px] font-semibold shrink-0 ${m.tone}`}>
            {m.role}
          </span>
        </div>
      ))}
    </div>
  </ScreenShell>
);

/* 13: CONNECT GITHUB (Strict reuse of Uploaded Images 5 & 12 Repository patterns) */
export const ConnectGitHubScreenRecreation: React.FC = () => (
  <ScreenShell time="9:00" battery="37">
    <ScreenBackHeader title="Repository" chevronStyle="chevron" />

    <div className="space-y-2.5">
      {/* Connected Repo & Branch Selectors */}
      <div className="rounded-[15px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold">
            <GitBranch className="w-3.5 h-3.5 text-[#DF5F2C]" />
            <span>mustafa-asif/blitz</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#4A7C59]/16 text-[#4A7C59] dark:text-[#7DB090] text-[7px] font-semibold">
            Connected
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[8px]">
          <div className="rounded-[9px] bg-[#F5F2EC] dark:bg-[#141210] px-2 py-1.5">
            <span className="block text-[6.5px] uppercase text-[#9A948B]">REPO</span>
            <span className="font-medium truncate block">mustafa-asif/blitz</span>
          </div>
          <div className="rounded-[9px] bg-[#F5F2EC] dark:bg-[#141210] px-2 py-1.5">
            <span className="block text-[6.5px] uppercase text-[#9A948B]">BRANCH</span>
            <span className="font-medium block">main</span>
          </div>
        </div>
      </div>

      {/* Auto-commit Toggles */}
      <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 space-y-2">
        {[
          { label: 'Auto-verify tagged commits', on: true },
          { label: 'Sync milestone progress', on: true },
        ].map((t) => (
          <div key={t.label} className="flex items-center justify-between gap-2 text-[8.5px]">
            <span>{t.label}</span>
            <span className="w-7 h-4 rounded-full bg-[#DF5F2C] dark:bg-[#E86F3F] p-0.5 flex justify-end shrink-0">
              <span className="w-3 h-3 rounded-full bg-white" />
            </span>
          </div>
        ))}
      </div>

      {/* Sync CTA */}
      <div className="rounded-full bg-[#DF5F2C] dark:bg-[#E86F3F] text-white dark:text-[#141210] py-2 px-3 flex items-center justify-center gap-1.5 text-[9.5px] font-semibold">
        <GitCommitHorizontal className="w-3 h-3" />
        <span>Sync commits</span>
      </div>

      {/* Recent Verified Commits */}
      <div className="space-y-1">
        <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-[#9A948B]">
          RECENT COMMITS
        </p>
        {[
          '✅ Task done: Add task input · BLISP-69a5334d',
          '✅ Task done: Booking endpoint · BLISP-01629f98',
        ].map((c) => (
          <div
            key={c}
            className="rounded-[10px] bg-[#E9E2D8] dark:bg-[#201C18] px-2.5 py-1.5 text-[8px] font-mono-code truncate"
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  </ScreenShell>
);

/* 14: SMART NUDGES */
export const SmartNudgesScreenRecreation: React.FC = () => (
  <ScreenShell time="9:01" battery="88">
    <ScreenBackHeader title="Smart Nudges" chevronStyle="chevron" />

    <div className="space-y-2">
      {/* Stacked Nudge Notification Cards */}
      <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] border-l-2 border-[#DF5F2C] p-2.5 space-y-0.5">
        <div className="flex items-center justify-between text-[7.5px] text-[#DF5F2C] font-semibold">
          <span className="inline-flex items-center gap-1">
            <Bell className="w-2.5 h-2.5" /> Focus nudge
          </span>
          <span>9:00 AM</span>
        </div>
        <p className="text-[9px] font-medium leading-snug">
          Outsmart procrastination. Tap here and start.
        </p>
      </div>

      <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] border-l-2 border-[#C59B38] p-2.5 space-y-0.5">
        <div className="flex items-center justify-between text-[7.5px] text-[#8C6919] dark:text-[#D6AB4E] font-semibold">
          <span className="inline-flex items-center gap-1">
            <Check className="w-2.5 h-2.5" /> Morning queue
          </span>
          <span>Yesterday</span>
        </div>
        <p className="text-[9px] font-medium leading-snug">
          Today&apos;s to-do list is waiting. Show it who is the boss.
        </p>
      </div>

      {/* Settings Rows matching Profile.tsx patterns */}
      <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-[#9A948B] pt-1">
        SCHEDULE &amp; TONE
      </p>
      <div className="space-y-1.5">
        <div className="rounded-[12px] bg-[#E9E2D8] dark:bg-[#201C18] px-2.5 py-2 flex items-center justify-between text-[8.5px]">
          <span>Daily reminder</span>
          <span className="w-7 h-4 rounded-full bg-[#DF5F2C] dark:bg-[#E86F3F] p-0.5 flex justify-end shrink-0">
            <span className="w-3 h-3 rounded-full bg-white" />
          </span>
        </div>

        {[
          { icon: <Clock className="w-3 h-3" />, label: 'Time', value: '9:00 AM' },
          { icon: <SlidersHorizontal className="w-3 h-3" />, label: 'Frequency', value: 'Gentle daily' },
          { icon: <Sparkles className="w-3 h-3" />, label: 'Tone', value: 'Direct & calm' },
        ].map((row) => (
          <div
            key={row.label}
            className="rounded-[12px] bg-[#E9E2D8] dark:bg-[#201C18] px-2.5 py-2 flex items-center justify-between text-[8.5px]"
          >
            <span className="inline-flex items-center gap-1.5 text-[#322C25] dark:text-[#F5F2EC]">
              <span className="text-[#67625B] dark:text-[#C5BDB2]">{row.icon}</span>
              {row.label}
            </span>
            <span className="text-[#67625B] dark:text-[#C5BDB2] font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  </ScreenShell>
);
