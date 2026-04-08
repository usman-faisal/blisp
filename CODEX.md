Comprehensive Codebase Exploration Report

1. Project Structure - Monorepo Architecture

This is a pnpm/Turbo monorepo with the following structure:

/blisp
├── apps/
│   ├── backend/          # NestJS server
│   └── mobile/           # Expo React Native app
├── packages/
│   ├── db/               # Prisma database layer
│   ├── types/            # Shared TypeScript types
│   ├── eslint-config/    # Shared ESLint configuration
│   └── ts-config/        # Shared TypeScript configuration
├── docker-compose.yaml   # PostgreSQL + Redis services
├── pnpm-workspace.yaml   # Workspace configuration
├── turbo.json            # Turbo CI/CD pipeline
└── package.json          # Root package with build commands

Package Manager: pnpm@10.32.0

2. Build, Run, Test, and Lint Commands

Root-level commands (from /Users/usman/Projects/blisp/package.json):
pnpm build           # Build all packages (turbo run build)
pnpm dev             # Start development mode (turbo run dev)
pnpm lint            # Lint all packages (turbo run lint)
pnpm test            # Run all tests (turbo run test)

Backend-specific (from apps/backend/package.json):
pnpm run dev --filter backend       # Start backend in watch mode
pnpm run start:dev --filter backend # Start with auto-reload
pnpm run build --filter backend     # Build NestJS
pnpm run test --filter backend      # Run Jest tests
pnpm run test:cov --filter backend  # Test with coverage
pnpm run test:e2e --filter backend  # Run e2e tests
pnpm run lint --filter backend      # Run ESLint with auto-fix
pnpm run format --filter backend    # Format with Prettier

Database (from packages/db/package.json):
pnpm turbo run db:generate   # Generate Prisma client types
pnpm turbo run db:migrate    # Run database migrations
pnpm turbo run db:deploy     # Deploy migrations to production

Mobile-specific (from apps/mobile/package.json):
pnpm start --filter mobile   # Start Expo development server
pnpm android --filter mobile # Build for Android
pnpm ios --filter mobile     # Build for iOS
pnpm web --filter mobile     # Run web version
pnpm lint --filter mobile    # Expo linting

3. High-Level Architecture

Backend (NestJS)

Port: 8000 (default), configurable via PORT env var
API Prefix: /api/v1

Core Modules:
- AuthModule: Clerk-based authentication with JWT/custom strategies
- BrainDumpsModule: Voice-to-text processing with BullMQ queue
- AiModule: LLM integration (supports Gemini or GitHub Models) with Tavily search
- DailyPlanModule: Cron-based daily plan generation with scheduling
- ProjectsModule: Project management with classification (PROJECT, FEATURE, BUG, REFACTOR, RESEARCH_SPIKE,
PROGRESS_UPDATE)
- TasksModule: Task CRUD and status management
- UsersModule: User profile and data management
- NotificationModule: User notifications and alerts
- MailerModule: Email sending (nodemailer)
- WebhookModule: Clerk webhook handlers
- PipelineEventsModule: Track project processing pipeline stages

Key Infrastructure:
- Database: PostgreSQL 18 (Docker) with Prisma ORM
- Cache/Queue: Redis (Alpine) with BullMQ for async job processing
- Authentication: Clerk (with JWT fallback)
- Email: Nodemailer
- Documentation: Swagger/OpenAPI at /docs

Mobile (Expo/React Native)

Framework: Expo with Expo Router (file-based routing)
UI: NativeWind (Tailwind CSS for React Native)
State Management: TanStack React Query
HTTP Client: Axios with custom provider
Authentication: Clerk Expo SDK

App Structure (Expo Router):
- (auth) - Authentication flows (login, signup)
- (home) - Home/dashboard
- (tabs) - Main tab navigation (home, projects, daily plans, profile)
- task/[id] - Task detail modal

Shared Packages

- @repo/db: Prisma client and generated types exported to apps
- @repo/types: Shared TypeScript interfaces for API responses
- @repo/typescript-config: NestJS and React TypeScript configs
- @repo/eslint-config: Base and framework-specific ESLint rules

4. Key Configuration Files

┌──────────────────────────────────┬────────────────────────────────────────────────────────────┐
│               File               │                          Purpose                           │
├──────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ docker-compose.yaml              │ PostgreSQL + Redis services                                │
├──────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ turbo.json                       │ Build pipeline, caching, task dependencies                 │
├──────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ pnpm-workspace.yaml              │ Monorepo workspace configuration with hoisted node_modules │
├──────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ packages/db/prisma/schema.prisma │ Database schema                                            │
├──────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ .npmrc                           │ pnpm hoisting config for React Native deps                 │
├──────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ apps/backend/.env.example        │ Environment variables template                             │
└──────────────────────────────────┴────────────────────────────────────────────────────────────┘

5. Documentation

- Project vision and core architectural guidelines
    - Voice-first agentic productivity app
    - Turns brain dumps → research → structured daily plans
    - Uses Turbo monorepo pattern
- apps/mobile/README.md: Standard Expo setup documentation
- apps/backend/README.md: Standard NestJS documentation

No .cursorrules or .github/copilot-instructions.md found.

6. Technology Stack

Backend:
- Runtime: Node.js with TypeScript
- Framework: NestJS 11.1.17
- Database: PostgreSQL 18 + Prisma 6.9.0
- Queue/Cache: Redis + BullMQ 5.71.0
- Authentication: Clerk + Passport (JWT + Google OAuth)
- AI/LLM:
    - ai SDK (Vercel) 6.0.134
    - @ai-sdk/google 3.0.52 (Gemini support)
    - @ai-sdk/openai-compatible 2.0.37 (GitHub Models)
    - Tavily API for web search
- Email: Nodemailer 8.0.3
- Validation: Zod 4.3.6 + class-validator
- API Documentation: Swagger/NestJS 11.2.6
- Testing: Jest 30.3.0 + ts-jest
- Code Quality: ESLint 10.1.0 + Prettier 3.8.1

Mobile:
- Runtime: React Native 0.83.2 + React 19.2.0
- Framework: Expo 55.0.8
- Routing: Expo Router 55.0.7
- UI Styling: NativeWind 4.2.3 (Tailwind CSS)
- State: TanStack React Query 5.95.2
- HTTP: Axios 1.13.6
- Authentication: Clerk Expo 2.19.31
- Fonts: Expo Google Fonts (DM Serif Display, Instrument Sans)
- Build Tools: Babel, Metro bundler
- Simulator/Emulator: EAS, Android/iOS native builds

7. Main Entry Points

Backend:
- /Users/usman/Projects/blisp/apps/backend/src/main.ts (NestJS bootstrap)
- http://localhost:8000/api/v1/ (API base)
- http://localhost:8000/docs (Swagger docs)

Mobile:
- /Users/usman/Projects/blisp/apps/mobile/src/app/_layout.tsx (Root layout with providers)
- (auth) stack for login/signup
- (tabs) stack for main app navigation

Database:
- Schema: /Users/usman/Projects/blisp/packages/db/prisma/schema.prisma
- Generated Prisma client: /Users/usman/Projects/blisp/packages/db/generated/prisma

8. Database Schema Highlights

Core Entities:
- User: Clerk-integrated user with notifications
- BrainDump: Voice transcripts with processing status
- Project: Extracted from brain dumps with classification & status
- Task: Project tasks with planning date & status (TODO, IN_PROGRESS, DONE)
- Resource: Links/docs/tutorials attached to projects/tasks
- DailyPlan: Scheduled daily plans with task aggregation
- ProjectEvent: Pipeline tracking (RESEARCH_STARTED → DAILY_PLAN_COMPLETED)
- Notification: User alerts

Pipeline Stages: RESEARCH_STARTED → RESEARCH_COMPLETED → PLAN_STARTED → PLAN_COMPLETED → DAILY_PLAN_STARTED →
DAILY_PLAN_COMPLETED → RESOURCE_FETCH_STARTED → RESOURCE_FETCH_COMPLETED

9. Development Workflow

1. Start Services:
docker-compose up -d  # PostgreSQL + Redis
2. Backend Development:
pnpm dev --filter backend
3. Mobile Development:
pnpm start --filter mobile
4. Database Migrations:
pnpm turbo run db:generate  # Generate types
pnpm turbo run db:migrate   # Run pending migrations
5. Build for Production:
pnpm build  # Builds all packages

All routes use /api/v1 prefix.