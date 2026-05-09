import ToggleMode from '../../../ToggleMode';
import ButtonAttachments from '../ButtonAttachments';
import ButtonSend from '../ButtonSend';
import EffortSelector from '../EffortSelector';
import ModelSelector from '../ModelSelector';
import { SkillsButton } from '../SkillsManager';

import type { AiAttachment, AiEffort, AiMode, AiModelInfo, AiSkill } from '@pmodules/AI/types';

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
  onVoiceToggle,
  onAttachmentsChange,
  onModeChange,
  onEffortChange,
  onModelChange,
  onManageSkills,
  onClickSend
}: ChatInputControlsProps) => {
  return (
    <div className="flex items-center gap-1.5">
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

      <EffortSelector value={effort} disabled={disabled} onChange={onEffortChange} />

      <ToggleMode mode={mode} disabled={disabled} onModeChange={onModeChange} />

      <div className="flex-1" />

      <ButtonSend mode={mode} message={message} attachments={attachments} disabled={disabled} onClick={onClickSend} />
    </div>
  );
};

export default ChatInputControls;
