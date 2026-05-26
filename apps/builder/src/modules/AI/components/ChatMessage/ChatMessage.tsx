import { memo } from 'react';

import AssistantMessage from './components/AssistantMessage';
import UserMessage from './components/UserMessage';

import type { AiMessage } from '../../types';

export type ChatMessageProps = AiMessage & { stagePreviewVersion?: number; wireframeVersion?: number };

const ChatMessage = ({
  id,
  role,
  content,
  thinking,
  thinkingDurationMs,
  irrelevant,
  queued,
  mode,
  usage,
  actions,
  attachments,
  tools,
  steps,
  createdAt,
  stagePreviewVersion,
  wireframeVersion
}: ChatMessageProps) => {
  if (role === 'user') {
    return (
      <UserMessage id={id} content={content} attachments={attachments} createdAt={createdAt} irrelevant={irrelevant} queued={queued} />
    );
  }

  return (
    <AssistantMessage
      id={id}
      content={content}
      thinking={thinking}
      thinkingDurationMs={thinkingDurationMs}
      irrelevant={irrelevant}
      mode={mode}
      usage={usage}
      actions={actions}
      tools={tools}
      steps={steps}
      createdAt={createdAt}
      stagePreviewVersion={stagePreviewVersion}
      wireframeVersion={wireframeVersion}
    />
  );
};

export default memo(ChatMessage);
