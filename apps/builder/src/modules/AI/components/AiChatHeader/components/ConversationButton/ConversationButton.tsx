import useDisclosure from '@plitzi/plitzi-ui/hooks/useDisclosure';
import Modal from '@plitzi/plitzi-ui/Modal';
import clsx from 'clsx';
import { useCallback, useEffect } from 'react';

import HistoryPanel from '@pmodules/AI/components/HistoryPanel';
import KeyboardKey from '@pmodules/AI/components/KeyboardKey';
import ModeLabel from '@pmodules/AI/components/ModeLabel';
import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import type { AiMode, ConversationSummary } from '@pmodules/AI/types';

export type ConversationButtonProps = {
  conversationTitle?: string;
  mode?: AiMode;
  conversations?: ConversationSummary[];
  currentConversationId?: string;
  onLoadConversations?: () => Promise<void>;
  onLoadConversation?: (id: string) => Promise<void>;
  onClear?: () => void;
};

const ConversationButton = ({
  conversationTitle,
  mode,
  conversations = [],
  currentConversationId,
  onLoadConversations,
  onLoadConversation,
  onClear
}: ConversationButtonProps) => {
  const { currentMode } = useAiChatContext();

  const handleModalOpen = useCallback(() => {
    void onLoadConversations?.();
  }, [onLoadConversations]);

  const [id, open, onOpen, onClose] = useDisclosure({ onOpen: handleModalOpen });

  const handleSelect = useCallback(
    (conversationId: string) => {
      void onLoadConversation?.(conversationId);
      void onClose();
    },
    [onLoadConversation, onClose]
  );

  const handleNew = useCallback(() => {
    onClear?.();
    void onClose();
  }, [onClear, onClose]);

  const handleClose = useCallback(() => {
    void onClose();
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!open) {
          onOpen();
        } else {
          void onClose();
        }
      }
    };

    document.addEventListener('keydown', handler);

    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onLoadConversation, onLoadConversations, onOpen, open]);

  return (
    <>
      <button
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-left transition-colors hover:border-neutral-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
      >
        <span
          className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', {
            'bg-emerald-500 dark:bg-emerald-400': currentMode === 'build',
            'bg-sky-500 dark:bg-sky-400': currentMode === 'plan'
          })}
        />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100">
          {conversationTitle ?? 'New conversation'}
        </span>
        <ModeLabel mode={mode} />
        <KeyboardKey
          className="border-neutral-300 bg-neutral-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400"
          char="K"
        />
      </button>
      <Modal onClick={onOpen} onClose={onClose} id={id} open={open} size="sm" className={{ card: 'h-140 w-145' }}>
        <Modal.Header>
          <Modal.HeaderIcon>
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </Modal.HeaderIcon>
          Conversations
        </Modal.Header>
        <Modal.Body className="p-0">
          <HistoryPanel
            conversations={conversations}
            currentConversationId={currentConversationId}
            onClose={handleClose}
            onSelect={handleSelect}
            onNew={handleNew}
          />
        </Modal.Body>
      </Modal>
    </>
  );
};

export default ConversationButton;
