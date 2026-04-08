import { z } from 'zod';

export const BrainDumpExtractionSchema = z.object({
   intent: z
      .enum(['CREATE_PROJECT', 'APPEND_NOTE'])
      .describe('The primary intent of the user. CREATE_PROJECT for fundamentally new ideas/projects. APPEND_NOTE to add context, random thoughts, or ideas to an existing project without changing its core details.'),
   title: z.string().describe('A concise technical title, like a GitHub issue or PR name.'),
   summary: z.string().describe('A one-sentence technical summary of the goal, or the content of the note to append.'),
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
});
