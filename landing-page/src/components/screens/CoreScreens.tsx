import React from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  AtSign,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  DoorOpen,
  Egg,
  FlaskConical,
  GitBranch,
  Infinity as InfinityIcon,
  Map,
  Mic,
  Play,
  Rocket,
  RotateCw,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  SquareCheck,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { ScreenBackHeader, ScreenShell } from './ScreenChrome';

/* 01: FOCUS (Uploaded Image 16) */
export const FocusScreenRecreation: React.FC = () => (
  <ScreenShell activeTab="focus" time="2:54" battery="88">
    <div className="flex items-center gap-2 mb-2.5">
      <div className="w-7 h-7 rounded-full bg-[#241E1A] dark:bg-[#332C25] border border-[#D8D2CA] dark:border-[#4A4138] flex items-center justify-center text-[9px] font-bold text-[#F5F2EC]">
        MW
      </div>
      <div className="leading-tight">
        <p className="text-[8.5px] text-[#67625B] dark:text-[#9A948B]">Welcome back,</p>
        <p className="text-[11px] font-semibold text-[#1C1815] dark:text-[#F5F2EC]">
          mustafawarind03
        </p>
      </div>
    </div>

    <div className="flex items-baseline justify-between mb-0.5">
      <p className="text-[14px] font-semibold tracking-[-0.02em]">Your focus</p>
      <span className="text-[8.5px] font-medium text-[#C59B38] dark:text-[#D6AB4E]">View all</span>
    </div>
    <p className="text-[8px] text-[#67625B] dark:text-[#9A948B] mb-1">0 of 4 done</p>
    <div className="h-[2px] w-full rounded-full bg-[#E4DBD1] dark:bg-[#2E2822] mb-2" />

    {/* Morning Briefing */}
    <div className="rounded-[12px] bg-[#EFE9E0] dark:bg-[#221D19] border border-[#DF5F2C]/15 px-2.5 py-2 mb-2">
      <div className="flex items-center gap-1 text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#DF5F2C] dark:text-[#E86F3F] mb-1">
        <Sun className="w-2.5 h-2.5" strokeWidth={2} />
        <span>MORNING BRIEFING</span>
      </div>
      <p className="text-[7.5px] leading-[1.35] text-[#67625B] dark:text-[#C5BDB2] line-clamp-3">
        Today you&apos;re defining the mixed-initiative conversation framework, designing intuitive
        initiation points, and setting up a robust knowledge base.
      </p>
    </div>

    {/* 4 Color-Coded Task Cards */}
    <div className="space-y-1.5 flex-1 min-h-0">
      {[
        {
          title: 'Setup robust knowledge base for conversational responses',
          bg: 'bg-[#1A1612] text-[#F5F2EC]',
          iconColor: 'text-[#1A1612]',
        },
        {
          title: 'Define mixed-initiative conversation framework',
          bg: 'bg-[#5F8C71] text-white',
          iconColor: 'text-[#5F8C71]',
        },
        {
          title: 'Design intuitive conversation initiation points',
          bg: 'bg-[#DF5F2C] text-white',
          iconColor: 'text-[#DF5F2C]',
        },
        {
          title: 'Develop documentation standards for session outputs',
          bg: 'bg-[#C4A646] text-white',
          iconColor: 'text-[#B39334]',
        },
      ].map((card) => (
        <div
          key={card.title}
          className={`rounded-[13px] px-2.5 py-2 flex items-start justify-between gap-2 ${card.bg}`}
        >
          <p className="text-[8.5px] font-medium leading-[1.28] line-clamp-2">{card.title}</p>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`w-4.5 h-4.5 rounded-full bg-white flex items-center justify-center ${card.iconColor}`}
            >
              <ArrowUpRight className="w-2.5 h-2.5" strokeWidth={2.2} />
            </span>
            <span className="px-1.5 py-[1px] rounded-full bg-white/18 text-[6.5px] font-medium whitespace-nowrap">
              To Do
            </span>
          </div>
        </div>
      ))}
    </div>

    {/* Bottom Unload Bar */}
    <div className="mt-2 rounded-full bg-[#EFEBE2] dark:bg-[#201C18] border border-[#D8D2CA] dark:border-[#332C25] px-2.5 py-1.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <InfinityIcon className="w-3.5 h-3.5 text-[#AD9968] dark:text-[#D6AB4E] shrink-0" />
        <span className="text-[9px] text-[#9A948B] truncate">Unload your thoughts...</span>
      </div>
      <Mic className="w-3 h-3 text-[#67625B] dark:text-[#C5BDB2] shrink-0" />
    </div>
  </ScreenShell>
);

/* 02: INCUBATOR (Styled strictly from Uploaded Image 2 + Active Incubation) */
export const IncubatorScreenRecreation: React.FC = () => (
  <ScreenShell activeTab="incubator" time="2:22" battery="37">
    <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#C59B38] dark:text-[#D6AB4E] mb-0.5">
      <Egg className="w-2.5 h-2.5" fill="currentColor" strokeWidth={1.8} />
      <span>INCUBATOR</span>
    </div>
    <p className="text-[16px] font-semibold tracking-[-0.025em] leading-tight">Ideas Brewing</p>
    <p className="text-[9px] text-[#67625B] dark:text-[#C5BDB2] mb-3">
      Projects researched and planned by your AI co-pilot.
    </p>

    {/* Incubating Idea Card */}
    <div className="rounded-[15px] bg-[#E9E2D8] dark:bg-[#201C18] p-3 space-y-2 mb-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-semibold leading-snug">
          Voice-first client portal &amp; async status tracker
        </p>
        <span className="px-2 py-0.5 rounded-full bg-[#DFCD9C]/55 dark:bg-[#D6AB4E]/20 text-[#8C6919] dark:text-[#D6AB4E] text-[7.5px] font-semibold shrink-0">
          Brewing
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-[#D8D2CA] dark:bg-[#332C25] overflow-hidden">
        <div className="h-full w-2/3 rounded-full bg-[#DF5F2C] dark:bg-[#E86F3F]" />
      </div>
      <div className="flex items-center justify-between text-[8px] text-[#67625B] dark:text-[#C5BDB2]">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-[#DF5F2C]" />
          Gemini researching open market gaps
        </span>
        <span className="tabular-nums">68%</span>
      </div>
    </div>

    {/* Ready Starter Tasks Preview */}
    <div className="rounded-[15px] bg-[#E9E2D8] dark:bg-[#201C18] p-3 space-y-1.5">
      <p className="text-[7.5px] font-semibold uppercase tracking-[0.1em] text-[#9A948B]">
        GENERATED STRUCTURE
      </p>
      <div className="space-y-1.5 text-[8.5px]">
        <div className="flex items-center justify-between bg-[#F5F2EC] dark:bg-[#141210] rounded-[10px] px-2.5 py-1.5">
          <span>Discovery report &amp; gap analysis</span>
          <CheckCircle2 className="w-3 h-3 text-[#5F8C71]" />
        </div>
        <div className="flex items-center justify-between bg-[#F5F2EC] dark:bg-[#141210] rounded-[10px] px-2.5 py-1.5">
          <span>Draft 14 starter tasks &amp; milestones</span>
          <span className="text-[7.5px] text-[#DF5F2C] font-medium">In progress</span>
        </div>
      </div>
    </div>
  </ScreenShell>
);

/* 04: MY PROJECTS (Uploaded Image 1) */
export const MyProjectsScreenRecreation: React.FC = () => (
  <ScreenShell activeTab="projects" time="2:23" battery="37">
    <div className="flex items-start justify-between gap-2 mb-3">
      <div>
        <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#DF5F2C] dark:text-[#E86F3F] mb-0.5">
          <Rocket className="w-2.5 h-2.5" fill="currentColor" strokeWidth={1.8} />
          <span>PROJECTS</span>
        </div>
        <p className="text-[16px] font-semibold tracking-[-0.025em] leading-tight">My Projects</p>
        <p className="text-[9px] text-[#67625B] dark:text-[#C5BDB2]">
          Active projects you&apos;re working on.
        </p>
      </div>
      <div className="px-2.5 py-1 rounded-full bg-[#EFEBE2] dark:bg-[#201C18] border border-[#D8D2CA] dark:border-[#332C25] inline-flex items-center gap-1 text-[8.5px] font-medium text-[#DF5F2C] dark:text-[#E86F3F] shrink-0">
        <DoorOpen className="w-2.5 h-2.5" />
        <span>Join</span>
      </div>
    </div>

    <div className="space-y-2.5">
      {[
        { title: 'Basic Todo App', count: '3 of 17 tasks', pct: '18%', w: 'w-[18%]' },
        {
          title: 'Hotel Management System with Subscription Model',
          count: '0 of 20 tasks',
          pct: '0%',
          w: 'w-0',
        },
      ].map((p) => (
        <div
          key={p.title}
          className="rounded-[16px] bg-[#E9E2D8] dark:bg-[#201C18] p-3 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10.5px] font-semibold leading-snug">{p.title}</p>
            <span className="px-2 py-0.5 rounded-full bg-[#F5F2EC] dark:bg-[#141210] text-[7.5px] text-[#67625B] dark:text-[#C5BDB2] shrink-0">
              Project
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[8px] text-[#67625B] dark:text-[#9A948B] tabular-nums">
              <span>{p.count}</span>
              <span>{p.pct}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-[#D8D2CA] dark:bg-[#332C25] overflow-hidden">
              <div className={`h-full ${p.w} rounded-full bg-[#DF5F2C] dark:bg-[#E86F3F]`} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-[8.5px] text-[#9A948B]">
            <Map className="w-2.5 h-2.5" />
            <span>View roadmap</span>
          </div>
        </div>
      ))}
    </div>
  </ScreenShell>
);

/* 06: NOTIFICATIONS (Uploaded Image 13) */
export const NotificationsScreenRecreation: React.FC = () => (
  <ScreenShell time="2:09" battery="91">
    <ScreenBackHeader
      title="Notifications"
      chevronStyle="chevron"
      rightSlot={
        <span className="text-[8.5px] font-medium text-[#DF5F2C] dark:text-[#E86F3F]">
          Mark all read
        </span>
      }
    />
    <div className="space-y-2">
      {[
        {
          icon: <AtSign className="w-3 h-3 text-[#C59B38]" />,
          title: 'You were mentioned',
          time: '15m',
          body: 'mustafa.pbhub032 mentioned you on "Style the application with CSS"',
        },
        {
          icon: <Check className="w-3 h-3 text-[#5F8C71]" />,
          title: 'Task completed',
          time: '15m',
          body: 'mustafa.pbhub032 completed "Add task deletion functionality" in Basic Todo App.',
        },
        {
          icon: <SquareCheck className="w-3 h-3 text-[#67625B]" />,
          title: 'Task assigned to you',
          time: '15m',
          body: 'mustafa.pbhub032 assigned you "Style the application with CSS".',
        },
      ].map((n, i) => (
        <div
          key={i}
          className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 flex items-start gap-2"
        >
          <span className="w-6 h-6 rounded-full bg-[#F5F2EC] dark:bg-[#141210] flex items-center justify-center shrink-0 mt-0.5">
            {n.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[9.5px] font-semibold">{n.title}</p>
              <span className="text-[7.5px] text-[#9A948B] tabular-nums">{n.time}</span>
            </div>
            <p className="text-[8px] leading-[1.35] text-[#67625B] dark:text-[#C5BDB2] line-clamp-2 mt-0.5">
              {n.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  </ScreenShell>
);

/* 07: ROADMAP & PROGRESS (Uploaded Image 15) */
export const RoadmapScreenRecreation: React.FC = () => (
  <ScreenShell time="9:00" battery="37">
    <ScreenBackHeader
      title="Roadmap"
      subtitle="Basic Todo App"
      rightSlot={
        <>
          <span className="w-6 h-6 rounded-full bg-[#E9E2D8] dark:bg-[#201C18] flex items-center justify-center">
            <SlidersHorizontal className="w-3 h-3" />
          </span>
          <span className="w-6 h-6 rounded-full bg-[#E9E2D8] dark:bg-[#201C18] flex items-center justify-center">
            <GitBranch className="w-3 h-3" />
          </span>
          <span className="w-6 h-6 rounded-full bg-[#E9E2D8] dark:bg-[#201C18] flex items-center justify-center">
            <RotateCw className="w-3 h-3" />
          </span>
        </>
      }
    />

    <div className="space-y-2 overflow-hidden">
      {/* Overall Progress */}
      <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[7.5px] uppercase tracking-[0.08em] text-[#9A948B]">
          <span>OVERALL PROGRESS</span>
          <span className="text-[#DF5F2C] font-semibold tabular-nums">18%</span>
        </div>
        <p className="text-[9px] font-medium tabular-nums">3 of 17 tasks · 8 set aside</p>
        <div className="h-1.5 w-full rounded-full bg-[#D8D2CA] dark:bg-[#332C25] overflow-hidden">
          <div className="h-full w-[18%] rounded-full bg-[#DF5F2C] dark:bg-[#E86F3F]" />
        </div>
      </div>

      {/* Deadline Alert */}
      <div className="rounded-[14px] bg-[#EFE9DD] dark:bg-[#221D17] border border-[#C59B38]/20 p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-[#8C6919] dark:text-[#D6AB4E]">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>This does not fit your deadline</span>
        </div>
        <p className="text-[7.5px] text-[#67625B] dark:text-[#C5BDB2]">
          105h left, 89.6h available across 7 working days.
        </p>
        <div className="space-y-1">
          <div className="rounded-[9px] bg-[#F5F2EC] dark:bg-[#141210] px-2 py-1 flex items-center justify-between text-[8px]">
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="w-2.5 h-2.5 text-[#DF5F2C]" />
              Put in more hours
            </span>
            <ChevronRight className="w-2.5 h-2.5 text-[#9A948B]" />
          </div>
          <div className="rounded-[9px] bg-[#F5F2EC] dark:bg-[#141210] px-2 py-1 flex items-center justify-between text-[8px]">
            <span className="inline-flex items-center gap-1.5">
              <Scissors className="w-2.5 h-2.5 text-[#67625B]" />
              Trim the scope
            </span>
            <ChevronRight className="w-2.5 h-2.5 text-[#9A948B]" />
          </div>
        </div>
      </div>

      {/* Core MVP Milestone */}
      <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] font-semibold">1 · Core MVP</span>
          <span className="text-[8.5px] font-semibold text-[#DF5F2C] tabular-nums">40%</span>
        </div>
        {[
          { label: 'Add task input', done: true },
          { label: 'Mark complete / delete', done: true },
          { label: 'Persist tasks in storage', done: false },
        ].map((t) => (
          <div
            key={t.label}
            className="rounded-[9px] bg-[#F5F2EC] dark:bg-[#141210] px-2 py-1 flex items-center justify-between text-[8px]"
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <span
                className={`w-2.5 h-2.5 rounded-full flex items-center justify-center shrink-0 ${
                  t.done
                    ? 'bg-[#4A7C59] text-white'
                    : 'border border-[#9A948B]'
                }`}
              >
                {t.done && <Check className="w-1.5 h-1.5" strokeWidth={3} />}
              </span>
              <span className={t.done ? 'line-through text-[#9A948B]' : ''}>{t.label}</span>
            </span>
            <span className="text-[7px] font-semibold text-[#DF5F2C]">MUST</span>
          </div>
        ))}
      </div>
    </div>
  </ScreenShell>
);

/* 08: DISCOVERY REPORT (Styled strictly from Uploaded Image 7 in healthy completed state) */
export const DiscoveryReportScreenRecreation: React.FC = () => (
  <ScreenShell time="2:23" battery="37">
    <ScreenBackHeader
      title="Discovery report"
      rightSlot={
        <span className="w-6 h-6 rounded-full bg-[#E9E2D8] dark:bg-[#201C18] flex items-center justify-center">
          <RotateCw className="w-3 h-3" />
        </span>
      }
    />

    <div className="flex items-center gap-1.5 mb-2.5 -mt-1.5">
      <span className="px-1.5 py-0.5 rounded bg-[#E9E2D8] dark:bg-[#201C18] inline-flex items-center gap-1 text-[7.5px] font-semibold text-[#C59B38]">
        <FlaskConical className="w-2.5 h-2.5" /> BETA
      </span>
      <span className="text-[9.5px] text-[#67625B] dark:text-[#C5BDB2]">Basic Todo App</span>
    </div>

    {/* Version Pills matching Image 7 */}
    <p className="text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#9A948B] mb-1">
      VERSIONS
    </p>
    <div className="flex items-center gap-1.5 mb-2.5 overflow-hidden">
      <span className="px-2 py-0.5 rounded-full bg-[#DF5F2C] text-white text-[8px] font-semibold inline-flex items-center gap-1">
        v14 <Check className="w-2 h-2" strokeWidth={3} />
      </span>
      <span className="px-2 py-0.5 rounded-full bg-[#E9E2D8] dark:bg-[#201C18] text-[8px] inline-flex items-center gap-1 text-[#4A7C59]">
        v13 <Check className="w-2 h-2" strokeWidth={2.5} />
      </span>
      <span className="px-2 py-0.5 rounded-full bg-[#E9E2D8] dark:bg-[#201C18] text-[8px] text-[#67625B]">
        v12
      </span>
    </div>

    {/* Report Findings Cards */}
    <div className="space-y-2">
      <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 space-y-1">
        <p className="text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#9A948B]">
          MARKET ANGLE
        </p>
        <p className="text-[9px] leading-[1.4]">
          Focused voice-first daily capture fills the gap between messy audio memos and heavy Kanban tools.
        </p>
      </div>
      <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 space-y-1">
        <p className="text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#9A948B]">
          IDENTIFIED GAPS
        </p>
        <p className="text-[8.5px] leading-[1.4] text-[#67625B] dark:text-[#C5BDB2]">
          • Automatic commit verification for solo builders
          <br />• Honest deadline feasibility check before sprint start
        </p>
      </div>
    </div>
  </ScreenShell>
);

/* 09: PROJECT OVERVIEW (Uploaded Image 8) */
export const ProjectOverviewScreenRecreation: React.FC = () => (
  <ScreenShell time="2:23" battery="37">
    <ScreenBackHeader
      title="Basic Todo App"
      rightSlot={
        <span className="w-6 h-6 rounded-full bg-[#6A7385] text-white text-[8px] font-semibold flex items-center justify-center">
          MU
        </span>
      }
    />
    <span className="self-start px-2 py-0.5 rounded-full bg-[#E9E2D8] dark:bg-[#201C18] text-[7.5px] text-[#67625B] dark:text-[#C5BDB2] -mt-1.5 mb-2">
      Project
    </span>

    <div className="flex items-center justify-between text-[8px] text-[#67625B] dark:text-[#9A948B] mb-1 tabular-nums">
      <span>0 of 25 tasks complete</span>
      <span>0%</span>
    </div>
    <div className="h-1 w-full rounded-full bg-[#D8D2CA] dark:bg-[#332C25] mb-2.5" />

    <div className="space-y-1.5 mb-3">
      <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-full bg-[#DFCD9C]/55 text-[#8C6919] flex items-center justify-center shrink-0">
            <Map className="w-3 h-3" />
          </span>
          <div className="min-w-0">
            <p className="text-[9.5px] font-semibold">Roadmap and progress</p>
            <p className="text-[7.5px] text-[#67625B] dark:text-[#C5BDB2] truncate">
              Milestones, dates, and what fits your deadline
            </p>
          </div>
        </div>
        <ChevronRight className="w-3 h-3 text-[#9A948B] shrink-0" />
      </div>

      <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-full bg-[#FCECE6] text-[#DF5F2C] flex items-center justify-center shrink-0">
            <Compass className="w-3 h-3" />
          </span>
          <div className="min-w-0">
            <p className="text-[9.5px] font-semibold">Discovery report</p>
            <p className="text-[7.5px] text-[#67625B] dark:text-[#C5BDB2] truncate">
              Comparable products, gaps, and what to build
            </p>
          </div>
        </div>
        <ChevronRight className="w-3 h-3 text-[#9A948B] shrink-0" />
      </div>
    </div>

    <p className="text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#C59B38] mb-1.5">
      ROADMAP
    </p>
    <div className="space-y-2 pl-1">
      {[
        { title: 'Initialize React project with Vite', active: false },
        { title: 'Create Task interface', active: false },
        { title: 'Build TodoItem component', active: true },
        { title: 'Add task handler functionality', active: false },
      ].map((item) => (
        <div key={item.title} className="flex items-center gap-2">
          <span
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
              item.active
                ? 'bg-[#DF5F2C] text-white'
                : 'border border-[#9A948B]/70'
            }`}
          >
            {item.active && <Play className="w-1.5 h-1.5 fill-current" />}
          </span>
          <div className="leading-tight">
            <p className="text-[8.5px] font-medium">{item.title}</p>
            <p className="text-[7px] text-[#9A948B]">Unassigned</p>
          </div>
        </div>
      ))}
    </div>
  </ScreenShell>
);

/* 10: JOIN A PROJECT (Uploaded Image 9) */
export const JoinProjectScreenRecreation: React.FC = () => (
  <ScreenShell time="2:23" battery="37">
    <ScreenBackHeader title="Join a project" chevronStyle="chevron" />
    <p className="text-[9px] text-[#67625B] dark:text-[#C5BDB2] mb-3">
      Enter the code a collaborator shared with you.
    </p>

    <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] py-3.5 px-4 text-center mb-2.5">
      <span className="font-slab-code text-[15px] font-bold tracking-[0.12em] text-[#8C857D] dark:text-[#C5BDB2]">
        ABCD2345
      </span>
    </div>

    <div className="rounded-[14px] bg-[#E9E2D8] dark:bg-[#201C18] py-2.5 px-4 text-center">
      <span className="text-[10.5px] font-medium text-[#322C25] dark:text-[#F5F2EC]">
        Continue
      </span>
    </div>
  </ScreenShell>
);
