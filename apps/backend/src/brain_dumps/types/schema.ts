import { z } from 'zod';

export const BrainDumpExtractionSchema = z.object({
   title: z.string().describe('A concise technical title, like a GitHub issue or PR name.'),
   summary: z.string().describe('A one-sentence technical summary of the goal.'),
   classification: z
      .enum(['PROJECT', 'FEATURE', 'BUG', 'REFACTOR', 'RESEARCH_SPIKE', 'PROGRESS_UPDATE'])
      .describe('Categorize the engineering effort. Use PROGRESS_UPDATE when the user is reporting progress on an existing task rather than logging a new idea.'),
   suggestedStatus: z
      .enum(['ACTIVE', 'INCUBATOR'])
      .describe('ACTIVE for immediate work, INCUBATOR for backlog/future planning.'),
   techStack: z
      .array(z.string())
      .max(5)
      .describe("Extract any mentioned languages, frameworks, or tools (e.g., ['C++', 'CMake', 'SQLite'])."),
});

export const TaskUpdateSchema = z.object({
   taskId: z
      .string()
      .nullable()
      .describe(
         'The exact UUID of the task the user is referring to, or null if no confident match can be made.',
      ),
   newStatus: z
      .enum(['IN_PROGRESS', 'DONE'])
      .describe('The status the task should be updated to based on the user transcript.'),
   acknowledgement: z
      .string()
      .describe(
         'A short, friendly 1-sentence message celebrating the user\'s progress. Keep it grounded and specific to what they accomplished.',
      ),
});