import ButtonAttachments from '../ButtonAttachments';
import ButtonSend from '../ButtonSend';
import ButtonVoice from '../ButtonVoice';
import ToggleMode from '../ToggleMode';

import type { AiAttachment, AiMode } from '@pmodules/AI/types';

export type ChatInputControlsProps = {
  mode: AiMode;
  message?: string;
  attachments?: AiAttachment[];
  isVoiceSupported: boolean;
  disabled?: boolean;
  isListening: boolean;
  onVoiceToggle: () => void;
  onAttachmentsChange: (attachments: AiAttachment[]) => void;
  onModeChange?: (mode: AiMode) => void;
  onClickSend?: () => void;
};

const ChatInputControls = ({
  mode,
  message = '',
  disabled = false,
  attachments,
  isVoiceSupported,
  isListening,
  onVoiceToggle,
  onAttachmentsChange,
  onModeChange,
  onClickSend
}: ChatInputControlsProps) => {
  return (
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        <ButtonAttachments mode={mode} attachments={attachments} disabled={disabled} onChange={onAttachmentsChange} />
        {isVoiceSupported && (
          <ButtonVoice mode={mode} disabled={disabled} isListening={isListening} onVoiceToggle={onVoiceToggle} />
        )}
        <ToggleMode mode={mode} disabled={disabled} onModeChange={onModeChange} />
      </div>
      <div className="flex">
        <ButtonSend mode={mode} message={message} attachments={attachments} disabled={disabled} onClick={onClickSend} />
      </div>
    </div>
  );
};

export default ChatInputControls;
