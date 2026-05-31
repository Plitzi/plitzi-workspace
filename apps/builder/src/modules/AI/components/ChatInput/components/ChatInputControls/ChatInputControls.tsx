import ToggleMode from '../../../ToggleMode';
import ButtonAttachments from '../ButtonAttachments';
import ButtonSend from '../ButtonSend';
import EffortSelector from '../EffortSelector';
import ModelSelector from '../ModelSelector';
import { SkillsButton } from '../SkillsManager';
import UsageBar from '../UsageBar';

import type { AiAttachment, AiEffort, AiMode, AiModelInfo, AiSkill, AiUsage } from '@pmodules/AI/types';

export type ChatInputControlsProps = {
  mode: AiMode;
  effort: AiEffort;
  message?: string;
  attachments?: AiAttachment[];
  skills: AiSkill[];
  models: AiModelInfo[];
  currentModel?: string;
  modelsLoading?: boolean;
  isVoiceSupported: boolean;
  isStreaming?: boolean;
  isListening: boolean;
  usage?: AiUsage;
  messageCount?: number;
  onCompact?: () => void;
  onVoiceToggle: () => void;
  onAttachmentsChange: (attachments: AiAttachment[]) => void;
  onModeChange?: (mode: AiMode) => void;
  onEffortChange: (effort: AiEffort) => void;
  onModelChange: (modelId: string) => void;
  onManageSkills: () => void;
  onClickSend?: () => void;
  onStop?: () => void;
};

const ChatInputControls = ({
  mode,
  effort,
  message = '',
  isStreaming = false,
  attachments,
  skills,
  models,
  currentModel,
  modelsLoading,
  isVoiceSupported,
  isListening,
  usage,
  messageCount = 0,
  onCompact,
  onVoiceToggle,
  onAttachmentsChange,
  onModeChange,
  onEffortChange,
  onModelChange,
  onManageSkills,
  onClickSend,
  onStop
}: ChatInputControlsProps) => {
  const modelContextLimit = models.find(m => m.id === currentModel)?.contextLimit;
  const supportsThinking = models.find(m => m.id === currentModel)?.supportsThinking;
  const effectiveEffort = !supportsThinking ? 'auto' : effort;

  return (
    <div className="flex items-center justify-between gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <ButtonAttachments
          mode={mode}
          attachments={attachments}
          isListening={isListening}
          isVoiceSupported={isVoiceSupported}
          onChange={onAttachmentsChange}
          onVoiceToggle={onVoiceToggle}
        />
        <SkillsButton skills={skills} onClick={onManageSkills} />
        <ModelSelector
          models={models}
          currentModel={currentModel}
          modelsLoading={modelsLoading}
          onChange={onModelChange}
        />
        <EffortSelector value={effectiveEffort} disabled={!supportsThinking} onChange={onEffortChange} />
        <ToggleMode mode={mode} onModeChange={onModeChange} />
      </div>
      <div className="flex items-center gap-1.5">
        <UsageBar
          usage={usage}
          modelContextLimit={modelContextLimit}
          isStreaming={isStreaming}
          messageCount={messageCount}
          onCompact={onCompact}
        />
        <ButtonSend
          mode={mode}
          message={message}
          attachments={attachments}
          isStreaming={isStreaming}
          onClick={onClickSend}
          onStop={onStop}
        />
      </div>
    </div>
  );
};

export default ChatInputControls;
