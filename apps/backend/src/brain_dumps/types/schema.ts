import { z } from 'zod';

export const BrainDumpExtractionSchema = z.object({
  title: z.string().describe('A concise technical title, like a GitHub issue or PR name.'),
  summary: z.string().describe('A one-sentence technical summary of the goal.'),
  classification: z
    .enum(['PROJECT', 'FEATURE', 'BUG', 'REFACTOR', 'RESEARCH_SPIKE'])
    .describe('Categorize the engineering effort.'),
  suggestedStatus: z
    .enum(['ACTIVE', 'INCUBATOR'])
    .describe('ACTIVE for immediate work, INCUBATOR for backlog/future planning.'),
  techStack: z
    .array(z.string())
    .max(5)
    .describe("Extract any mentioned languages, frameworks, or tools (e.g., ['C++', 'CMake', 'SQLite'])."),
  technicalSteps: z
    .array(z.string())
    .max(4)
    .describe("1 to 4 actionable engineering steps (e.g., 'Initialize project structure', 'Implement B-Tree pager')."),
});