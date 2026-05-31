import type { AiMessage } from '../../../../types';

export type AiQuestionOption = { label: string; value?: string };
export type AiQuestion = { question: string; options?: AiQuestionOption[]; multiSelect?: boolean };

// A question is "pending" when the last turn is the assistant calling ask_question and the user has
// not replied yet (a reply makes the last message a user message). While streaming there is none.
export const getPendingQuestion = (messages: AiMessage[], isStreaming: boolean): AiQuestion[] | null => {
  if (isStreaming) {
    return null;
  }

  const last = messages.at(-1);
  if (!last || last.role !== 'assistant' || !last.steps) {
    return null;
  }

  for (let i = last.steps.length - 1; i >= 0; i--) {
    const step = last.steps[i];
    if (step.type === 'tool' && step.name === 'ask_question') {
      const fromResult = (step.result as { questions?: AiQuestion[] } | undefined)?.questions;
      const fromArgs = (step.args as { questions?: AiQuestion[] } | undefined)?.questions;
      const questions = fromResult ?? fromArgs;

      return questions && questions.length > 0 ? questions : null;
    }
  }

  return null;
};
