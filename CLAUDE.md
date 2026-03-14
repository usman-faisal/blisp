# Project context

When working with this codebase, prioritize readability over cleverness. Ask clarifying questions before making architectural changes.

## What we are building (the core idea)

A voice-first, agentic productivity app that turns a developer's raw thoughts and deadlines into structured, resource-backed daily action plans.

How It Works (The Core Loop)

Frictionless Brain Dumps: You use voice to instantly log spontaneous ideas, university assignments, or content creation goals without interrupting your current workflow.

Agentic Research & Processing: An AI worker automatically parses the audio, extracts actionable tasks, and fetches relevant technical resources (e.g., tutorials, documentation, or reading materials) in the background.

Dynamic Daily Planning: Every morning, the app acts as an automated project manager, presenting a unified, intelligent to-do list that balances immediate academic deadlines, long-term side projects, and personal branding goals.

Essentially, it is an AI co-pilot for your brain that handles the research and scheduling, so you can just focus on building and learning.


## About this project

This project is structured as a monorepo. We have two apps backend and mobile. The backend stack consists of nestjs, clerk for authentication
and prisma (postgresql) for database. For the frontend we have an expo app that uses clerk for authentication. No library UI library
custom handmade pixel perfect uis using native wind.

You can look at the package jsons to learn more detail about the stack

## Key Directories

1. apps/backend/src the core of our backend where new modules will be created
2. app/mobile the expo app
3. packages/db/prisma/schema.prisma

## Common commands

```bash
pnpm turbo run db:generate # prisma types
pnpm dev --filter backend
pnpm build
```

## Notes

All routes use `/api/v1` prefix.
