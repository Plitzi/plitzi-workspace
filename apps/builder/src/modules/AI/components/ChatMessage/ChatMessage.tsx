import { memo } from 'react';

import AssistantMessage from './components/AssistantMessage';
import UserMessage from './components/UserMessage';

import type { AiMessage } from '../../types';

type ChatMessageProps = AiMessage & { stagePreviewVersion?: number; wireframeVersion?: number };

const ChatMessage = ({
  id,
  role,
  content,
  thinking,
  thinkingDurationMs,
  irrelevant,
  mode,
  usage,
  actions,
  attachments,
  tools,
  createdAt,
  stagePreviewVersion,
  wireframeVersion
}: ChatMessageProps) => {
  if (role === 'user') {
    return (
      <UserMessage id={id} content={content} attachments={attachments} createdAt={createdAt} irrelevant={irrelevant} />
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
      createdAt={createdAt}
      stagePreviewVersion={stagePreviewVersion}
      wireframeVersion={wireframeVersion}
    />
  );
};

export default memo(ChatMessage);
