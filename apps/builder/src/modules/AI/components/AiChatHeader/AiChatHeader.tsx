import ConversationButton from './components/ConversationButton';
import HeaderActions from './components/HeaderActions';

export type AiChatHeaderProps = {
  isSettingsOpen?: boolean;
  onSettingsToggle?: () => void;
};

const AiChatHeader = ({ isSettingsOpen, onSettingsToggle }: AiChatHeaderProps) => {
  return (
    <div className="shrink-0 border-b border-neutral-200 bg-neutral-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <ConversationButton />
        <HeaderActions isSettingsOpen={isSettingsOpen} onSettingsToggle={onSettingsToggle} />
      </div>
    </div>
  );
};

export default AiChatHeader;
