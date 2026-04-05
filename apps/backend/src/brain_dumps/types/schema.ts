import { z } from 'zod';

export const BrainDumpExtractionSchema = z.object({
   intent: z
      .enum(['CREATE_PROJECT', 'UPDATE_PROJECT', 'ARCHIVE_PROJECT', 'APPEND_NOTE', 'PROGRESS_UPDATE'])
      .describe('The primary intent of the user. CREATE for fundamentally new ideas/projects. UPDATE for modifying an existing project. ARCHIVE to close/archive an existing project. APPEND_NOTE to add a note/context to a project without changing its core details. PROGRESS_UPDATE for logging task progress.'),
   targetProjectId: z
      .string()
      .nullable()
      .describe('The UUID of the existing project if the intent is anything other than CREATE_PROJECT. Null otherwise.'),
   title: z.string().describe('A concise technical title, like a GitHub issue or PR name.'),
   summary: z.string().describe('A one-sentence technical summary of the goal, or the content of the note to append.'),
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
   projectUpdates: z
      .object({
         title: z.string().nullable(),
         description: z.string().nullable(),
         techStack: z.array(z.string()).nullable(),
         classification: z.enum(['PROJECT', 'FEATURE', 'BUG', 'REFACTOR', 'RESEARCH_SPIKE']).nullable(),
      })
      .nullable()
      .describe('Specific fields to update for an existing project. Only populate for UPDATE_PROJECT intent.'),
   targetTaskId: z
      .string()
      .nullable()
      .describe('The ID of the task being updated (only used for PROGRESS_UPDATE).'),
   newStatus: z
      .enum(['DONE', 'IN_PROGRESS'])
      .nullable()
      .describe('The new status of the task.'),
   acknowledgement: z
      .string()
      .nullable()
      .describe('A short, warm 1-sentence celebration of their progress.'),
});