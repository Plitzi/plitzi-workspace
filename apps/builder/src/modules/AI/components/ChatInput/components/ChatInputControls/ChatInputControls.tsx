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
  disabled?: boolean;
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
};

const ChatInputControls = ({
  mode,
  effort,
  message = '',
  disabled = false,
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
  onClickSend
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
          disabled={disabled}
          isListening={isListening}
          isVoiceSupported={isVoiceSupported}
          onChange={onAttachmentsChange}
          onVoiceToggle={onVoiceToggle}
        />
        <SkillsButton skills={skills} disabled={disabled} onClick={onManageSkills} />
        <ModelSelector
          models={models}
          currentModel={currentModel}
          modelsLoading={modelsLoading}
          disabled={disabled}
          onChange={onModelChange}
        />
        <EffortSelector
          value={effectiveEffort}
          disabled={disabled || !supportsThinking}
          onChange={onEffortChange}
        />
        <ToggleMode mode={mode} disabled={disabled} onModeChange={onModeChange} />
      </div>
      <div className="flex items-center gap-1.5">
        <UsageBar
          usage={usage}
          modelContextLimit={modelContextLimit}
          isStreaming={disabled}
          messageCount={messageCount}
          onCompact={onCompact}
        />
        <ButtonSend mode={mode} message={message} attachments={attachments} disabled={disabled} onClick={onClickSend} />
      </div>
    </div>
  );
};

export default ChatInputControls;
