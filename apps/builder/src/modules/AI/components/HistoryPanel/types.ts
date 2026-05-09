import type { ConversationSummary } from '../../types';

export type EnrichedConversation = ConversationSummary & {
  rowIndex: number;
  isCurrent: boolean;
};

export type ConversationGroup = {
  key: string;
  label: string;
  items: EnrichedConversation[];
};
