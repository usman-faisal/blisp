# Blisp — Voice-First Idea-to-Execution Landing Page

Marketing landing page for **Blisp** (*"AN AI-POWERED, VOICE-FIRST IDEA-TO-EXECUTION PLATFORM"*), built with React, TypeScript, Vite, Tailwind CSS v4, Motion, and Lucide icons.

## Prerequisites

- **Node.js** `v18+` (recommended `v20+`)
- **npm** `v9+`

## Run Locally from Terminal

1. Navigate into the project folder:

```bash
cd blisp-landing-page
```

2. Install dependencies:

```bash
npm install
```

3. Start the local development server:

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

## Available Terminal Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the development server on port `3000` |
| `npm run build` | Builds the production bundle into `dist/` |
| `npm run preview` | Previews the production build locally on port `3000` |
| `npm run lint` | Runs TypeScript type-checking (`tsc --noEmit`) |

## Screen Recording Demo Mode

Press **`D`** anywhere on the page (when not typing inside a form input) to toggle **Demo Mode**:

- Hides scrollbars for clean screen recording
- Replays the initial Hero & Navbar load sequence slightly slower
- Smoothly auto-scrolls the full page over ~45 seconds with 2-second pauses on the Hero, Features Bento Grid, all 6 Product Tour steps, and the Final CTA
- Press **`D`** or **`Esc`** at any time to stop Demo Mode and restore normal scrolling

## Project Structure

- `index.html` — HTML entry point, fonts, SEO & Open Graph metadata
- `public/favicon.svg` — Blisp vector app icon
- `public/assets/` — Screenshot assets used across the landing page
- `src/pages/LandingPage.tsx` — Composed landing page layout
- `src/components/landing/` — Navbar, Hero, Features Bento, Sticky Product Tour, How It Works, Integrations, Use Cases, Why Blisp, FAQ, Final CTA, and Footer
- `src/components/ui/` — Blisp logo, warm matte glass cards, responsive phone mockup, buttons, and theme toggle
- `src/components/screens/` — App screen recreations styled from the Blisp mobile UI
- `src/context/` — Theme (`light` / `dark`) and invisible Demo Mode providers
- `src/data/screenshots.ts` — Screen registry and asset paths
