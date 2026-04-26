import Markdown from '@plitzi/plitzi-ui/Markdown';

import ToolCallGroup from '../ToolCallGroup';
import TimelineDot from './TimelineDot';

import type { AiToolCall } from '../../types';

type LiveEntryProps = {
  streamingText?: string;
  liveThinking?: string;
  liveTools?: AiToolCall[];
};

const LiveEntry = ({ streamingText, liveThinking, liveTools = [] }: LiveEntryProps) => (
  <div className="relative flex gap-3">
    <TimelineDot role="assistant" pulse />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="font-mono text-xs font-semibold text-violet-500 dark:text-violet-400">◆ Assistant</span>

      {liveThinking && (
        <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400 italic dark:text-zinc-500">
          <span>💭</span>
          <span className="truncate">{liveThinking}</span>
          <span className="inline-block h-3 w-0.5 animate-pulse bg-zinc-400 align-middle dark:bg-zinc-500" />
        </div>
      )}

      {liveTools.length > 0 && <ToolCallGroup tools={liveTools} defaultOpen />}

      {streamingText && (
        <div className="pl-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-100">
          <Markdown>{streamingText}</Markdown>
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-500 align-middle dark:bg-violet-400" />
        </div>
      )}
    </div>
  </div>
);

export default LiveEntry;
