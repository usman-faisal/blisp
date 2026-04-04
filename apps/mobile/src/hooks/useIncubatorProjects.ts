import { useState, useCallback, useEffect } from 'react';

export interface Resource {
  id: string;
  title: string;
  summary: string;
  source: string;
}

export interface IncubatorProject {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  resources: Resource[];
}

const MOCK_PROJECTS: IncubatorProject[] = [
  {
    id: 'inc-1',
    title: 'AI-Powered Recipe Generator',
    description:
      'A web app that generates personalized recipes based on available ingredients, dietary restrictions, and cuisine preferences using GPT-4.',
    techStack: ['Next.js', 'OpenAI', 'Prisma', 'Tailwind'],
    resources: [
      {
        id: 'r1',
        title: 'Recipe API Comparison',
        summary:
          'Spoonacular offers the best free tier for ingredient parsing (150 req/day). Edamam has stronger nutrition data. Recommend Spoonacular for MVP, migrate to custom model later.',
        source: 'AI Research',
      },
      {
        id: 'r2',
        title: 'Prompt Engineering for Recipes',
        summary:
          'Few-shot prompting with 3 example recipes yields 87% user satisfaction vs. 62% with zero-shot. Include cuisine style, cook time constraint, and skill level in system prompt.',
        source: 'AI Research',
      },
    ],
  },
  {
    id: 'inc-2',
    title: 'Local-First Habit Tracker',
    description:
      'A privacy-focused habit tracking app that syncs across devices using CRDTs, with streak analytics and gentle push notifications.',
    techStack: ['React Native', 'SQLite', 'CRDT', 'Expo'],
    resources: [
      {
        id: 'r3',
        title: 'CRDT Implementation Strategy',
        summary:
          'Yjs is the most mature CRDT library for JS. For a habit tracker, a simple LWW-Register per habit entry is sufficient. Full Yjs may be overkill — consider Automerge for simpler API.',
        source: 'AI Research',
      },
    ],
  },
  {
    id: 'inc-3',
    title: 'Developer Portfolio CMS',
    description:
      'A headless CMS specifically designed for developer portfolios, with GitHub integration, project showcase templates, and blog support.',
    techStack: ['Astro', 'MDX', 'GitHub API', 'Vercel'],
    resources: [
      {
        id: 'r4',
        title: 'Static Site Generator Comparison',
        summary:
          'Astro outperforms Next.js for content-heavy sites by 3x on Lighthouse scores. Content Collections API simplifies MDX management. Recommend Astro + Vercel for zero-config deployment.',
        source: 'AI Research',
      },
      {
        id: 'r5',
        title: 'GitHub API Integration',
        summary:
          'GraphQL API v4 allows fetching pinned repos, contribution graph, and language stats in a single query. Rate limit is 5,000 req/hr with PAT — more than enough for build-time fetching.',
        source: 'AI Research',
      },
    ],
  },
];

/**
 * Mock hook — mirrors React Query's { data, isLoading, mutate } shape.
 * Swap the body for a real `useQuery` call hitting GET /projects?status=INCUBATOR.
 */
export function useIncubatorProjects() {
  const [data, setData] = useState<IncubatorProject[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 600));
    setData(MOCK_PROJECTS);
    setIsLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /** Call mutate() to re-fetch the incubator list (e.g. after activating a project). */
  const mutate = useCallback(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { data, isLoading, mutate };
}
