import { memo } from 'react';

import AssistantMessage from './components/AssistantMessage';
import UserMessage from './components/UserMessage';

import type { AiMessage } from '../../types';

export type ChatMessageProps = AiMessage & { previewConceptVersion?: number; wireframeVersion?: number };

const ChatMessage = ({
  id,
  role,
  content,
  irrelevant,
  queued,
  mode,
  usage,
  actions,
  attachments,
  steps,
  createdAt,
  previewConceptVersion,
  wireframeVersion
}: ChatMessageProps) => {
  if (role === 'user') {
    return (
      <UserMessage
        id={id}
        content={content}
        attachments={attachments}
        createdAt={createdAt}
        irrelevant={irrelevant}
        queued={queued}
      />
    );
  }

  return (
    <AssistantMessage
      id={id}
      content={content}
      irrelevant={irrelevant}
      mode={mode}
      usage={usage}
      actions={actions}
      steps={steps}
      createdAt={createdAt}
      previewConceptVersion={previewConceptVersion}
      wireframeVersion={wireframeVersion}
    />
  );
};

export default memo(ChatMessage);
