export type AppScreenshotId =
  | '01-focus'
  | '02-incubator'
  | '03-capture-idea'
  | '04-my-projects'
  | '05-profile'
  | '06-notifications'
  | '07-roadmap-progress'
  | '08-discovery-report'
  | '09-project-overview'
  | '10-join-project'
  | '11-sign-up-google'
  | '12-invite-collaborate'
  | '13-connect-github'
  | '14-smart-nudges';

export type ScreenSourceKind = 'real-screenshot' | 'recreation';

export interface AppScreenshotSpec {
  id: AppScreenshotId;
  number: string;
  name: string;
  /**
   * Real screenshot asset path under /assets/screenshots/ (or /assets/aistudio/).
   * Real screenshots ALWAYS take priority over recreations inside PhoneMockup.
   */
  src: string | null;
  /** Documents whether this entry currently resolves to a real image file or a UI recreation. */
  sourceKind: ScreenSourceKind;
  alt: string;
}

/**
 * Blisp Mobile Screen Registry.
 * Drop any real `.jpeg` file into `/public/assets/screenshots/` and set its path in `src` —
 * PhoneMockup automatically prioritizes real screenshots over `<ScreenRecreation />`.
 */
export const APP_SCREENSHOTS: Record<AppScreenshotId, AppScreenshotSpec> = {
  '01-focus': {
    id: '01-focus',
    number: '01',
    name: 'Focus',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Focus screen showing Morning Briefing, four color-coded priority cards, and Unload your thoughts bar',
  },
  '02-incubator': {
    id: '02-incubator',
    number: '02',
    name: 'Incubator',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Incubator screen where Gemini co-pilot researches and plans spoken ideas',
  },
  '03-capture-idea': {
    id: '03-capture-idea',
    number: '03',
    name: 'Capture Idea (voice)',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Capture Idea screen with live transcript, waveform, type-message bar, and voice record button',
  },
  '04-my-projects': {
    id: '04-my-projects',
    number: '04',
    name: 'My Projects',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp My Projects screen listing active projects and roadmap shortcuts',
  },
  '05-profile': {
    id: '05-profile',
    number: '05',
    name: 'Profile',
    src: '/assets/screenshots/05-profile.jpeg',
    sourceKind: 'real-screenshot',
    alt: 'Blisp Profile screen displaying user account, project counts, preferences, and AI co-pilot settings',
  },
  '06-notifications': {
    id: '06-notifications',
    number: '06',
    name: 'Notifications',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Notifications screen showing mentions, task completions, and assignments',
  },
  '07-roadmap-progress': {
    id: '07-roadmap-progress',
    number: '07',
    name: 'Roadmap & Progress',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Roadmap screen showing overall progress, deadline check, Last 7 Days chart, and Core MVP milestone',
  },
  '08-discovery-report': {
    id: '08-discovery-report',
    number: '08',
    name: 'Discovery Report',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Discovery Report screen with version history, comparable products, and identified gaps',
  },
  '09-project-overview': {
    id: '09-project-overview',
    number: '09',
    name: 'Project Overview',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Project Overview screen with progress bar, navigation rows, and vertical roadmap timeline',
  },
  '10-join-project': {
    id: '10-join-project',
    number: '10',
    name: 'Join a Project',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Join a Project screen with invite code input and Continue button',
  },
  '11-sign-up-google': {
    id: '11-sign-up-google',
    number: '11',
    name: 'Sign Up / Welcome',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Sign Up and Welcome screen with Blisp logo, Google sign-in, and email option',
  },
  '12-invite-collaborate': {
    id: '12-invite-collaborate',
    number: '12',
    name: 'Invite & Collaborate',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Invite and Collaborate screen showing shareable invite link, team roles, and link-join toggle',
  },
  '13-connect-github': {
    id: '13-connect-github',
    number: '13',
    name: 'Connect GitHub',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Connect GitHub screen with repo and branch selectors, auto-commit toggles, and recent commit checkoffs',
  },
  '14-smart-nudges': {
    id: '14-smart-nudges',
    number: '14',
    name: 'Smart Nudges',
    src: null,
    sourceKind: 'recreation',
    alt: 'Blisp Smart Nudges screen with reminder notifications and schedule controls',
  },
};

export const APP_SCREENSHOT_LIST: AppScreenshotSpec[] = Object.values(APP_SCREENSHOTS);
