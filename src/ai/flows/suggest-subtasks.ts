// src/ai/flows/suggest-subtasks.ts
'use server';

/**
 * @fileOverview AI-powered subtask suggestion flow based on a task title.
 *
 * - suggestSubtasks - A function that suggests subtasks for a given task title.
 * - SuggestSubtasksInput - The input type for the suggestSubtasks function.
 * - SuggestSubtasksOutput - The return type for the suggestSubtasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestSubtasksInputSchema = z.object({
  taskTitle: z
    .string()
    .describe('The title of the task for which to suggest subtasks.'),
  projectContext: z
    .string()
    .optional()
    .describe('Optional context about the project to tailor the suggestions.'),
  pastNotes: z
    .string()
    .optional()
    .describe('Optional past project notes that could give context to the suggestions.'),
});
export type SuggestSubtasksInput = z.infer<typeof SuggestSubtasksInputSchema>;

const SuggestSubtasksOutputSchema = z.object({
  subtasks: z.array(z.string()).describe('An array of suggested subtasks.'),
});
export type SuggestSubtasksOutput = z.infer<typeof SuggestSubtasksOutputSchema>;

export async function suggestSubtasks(input: SuggestSubtasksInput): Promise<SuggestSubtasksOutput> {
  return suggestSubtasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestSubtasksPrompt',
  input: {schema: SuggestSubtasksInputSchema},
  output: {schema: SuggestSubtasksOutputSchema},
  prompt: `You are an AI assistant specialized in generating subtasks for project management.

  Based on the task title, project context, and past notes provided, suggest a list of subtasks required to complete the task.

  Task Title: {{{taskTitle}}}
  Project Context: {{{projectContext}}}
  Past Project Notes: {{{pastNotes}}}

  Please list the subtasks as an array of strings.
  Ensure that the subtasks are specific, actionable, and contribute directly to the completion of the main task.
`,
});

const suggestSubtasksFlow = ai.defineFlow(
  {
    name: 'suggestSubtasksFlow',
    inputSchema: SuggestSubtasksInputSchema,
    outputSchema: SuggestSubtasksOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
