import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, use, useEffect, useState, useTransition, useRef } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import Chat from './components/Chat';
import VoiceVisualizer from './components/VoiceVisualizer';
import useMediaRecorder from './hooks/useMediaRecorder';

import type { OpenAIMessage } from './types/openAI';
import type { BuilderState } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

const OpenAIChat = () => {
  const { useStore } = createStoreHook<BuilderState>();
  const [elementSelected] = useStore('elementSelected');
  const chatRef = useRef<HTMLDivElement | null>(null);
  const { server, webKey } = use(NetworkContext);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });
  const { currentPageId } = use(NavigationContext);
  const [threadId, setThreadId] = useStorage<string>('builder-state.assistantAI.threadId', '');
  const [conversation, setConversation] = useState<OpenAIMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [retrieveMessagePending, setRetrieveMessagePending] = useTransition();

  const getThreadMessages = useCallback(
    async (threadId: string) => {
      const response = await networkQuery<{ messages?: OpenAIMessage[] }>(
        `/assistant/thread/messages?threadId=${threadId}`
      );
      if (!response || !response.messages) {
        return;
      }

      setConversation(response.messages.reverse());
    },
    [networkQuery]
  );

  const initAssistant = useCallback(async () => {
    const response = await networkQuery<{ threadId: string }>('/assistant/thread', {}, 'post');
    if (!response) {
      return;
    }

    const threadIdResponse = get(response, 'threadId', '');
    await getThreadMessages(threadIdResponse);
    setThreadId(threadIdResponse);
  }, [networkQuery, getThreadMessages, setThreadId]);

  const askToAssistant = useCallback(
    (message: string) => {
      setRetrieveMessagePending(async () => {
        const responseAsk = await networkQuery<{ message: OpenAIMessage }>(
          '/assistant/thread/message',
          { threadId, message },
          'post'
        );
        if (!responseAsk?.message) {
          return;
        }

        setConversation(state => [...state, responseAsk.message]);
        const responseRetrieve = await networkQuery<{ messages: OpenAIMessage[] }>(
          '/assistant/thread/retrieve-message',
          { threadId, context: { currentPageId, elementSelected } },
          'post'
        );
        if (!responseRetrieve?.messages) {
          return;
        }

        setConversation(state => [...state, ...responseRetrieve.messages]);
      });
    },
    [threadId, networkQuery, currentPageId, elementSelected, setRetrieveMessagePending]
  );

  const handleClickAsk = useCallback(() => {
    setMessageInput('');
    askToAssistant(messageInput);
  }, [messageInput, askToAssistant]);

  const onFinishRecording = useCallback(
    async (_audioUrl: string, audioBlob: Blob) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      const response = await networkQuery<{ transcript: string }>('/assistant/transcription', formData, 'post');
      if (!response || !response.transcript) {
        return;
      }

      setMessageInput(response.transcript);
      // setConversation(state => [...state, response.transcript]);
      // const reply = await askToAssistant(response.transcript);
      // setPreview(reply);
    },
    [networkQuery]
  );

  const { start, resume, pause, stop, recording, audioData, paused } = useMediaRecorder({
    onFinish: onFinishRecording
  });

  const handleClickPauseTranscript = useCallback(() => {
    if (paused) {
      resume();

      return;
    }

    pause();
  }, [pause, resume, paused]);

  const handleClickTranscript = useCallback(() => {
    if (!recording) {
      void start();

      return;
    }

    stop();
  }, [start, stop, recording]);

  const handleChangeMessage = useCallback((value: string) => setMessageInput(value), []);

  const handleMessageKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !retrieveMessagePending) {
        handleClickAsk();
      }
    },
    [handleClickAsk, retrieveMessagePending]
  );

  const handleClickClearConversation = useCallback(() => {
    setConversation([]);
    setThreadId('');
    void initAssistant();
  }, [initAssistant, setThreadId]);

  useEffect(() => {
    if (!threadId) {
      void initAssistant();
    } else {
      void getThreadMessages(threadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = get(conversation, `${conversation.length - 1}.id`);
    if (!id) {
      return;
    }

    document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
  }, [conversation]);

  const loading = retrieveMessagePending || networkLoading;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex grow flex-col border-b border-gray-300">
        <Chat messages={conversation} ref={chatRef} />
      </div>
      <div className="flex gap-2 p-2">
        <div className="flex grow basis-0 gap-4">
          {!recording && (
            <Input
              className="min-w-0 grow basis-0"
              value={messageInput}
              size="sm"
              onChange={handleChangeMessage}
              onKeyDown={handleMessageKeyDown}
            />
          )}
          {recording && (
            <VoiceVisualizer
              className="h-9.5 pr-2"
              backgroundColor="transparent"
              mainBarColor="#7290e7"
              barWidth={2}
              fullscreen
              isRecording={recording}
              audioData={audioData}
            />
          )}
        </div>
        {recording && (
          <div className="flex overflow-hidden rounded-sm">
            <Button className="w-9.5" size="sm" intent="danger" onClick={handleClickPauseTranscript}>
              {!paused && <Button.Icon icon="fa-solid fa-pause" />}
              {paused && <Button.Icon icon="fa-solid fa-play" />}
            </Button>
            <Button className="w-9.5" size="sm" intent="danger" onClick={handleClickTranscript}>
              <Button.Icon icon="fa-solid fa-stop" />
            </Button>
          </div>
        )}
        {!recording && (
          <Button
            className="w-9.5 rounded-sm"
            size="sm"
            intent="primary"
            disabled={loading}
            onClick={handleClickTranscript}
          >
            <Button.Icon icon="fa-solid fa-microphone" />
          </Button>
        )}
        {!recording && (
          <Button size="sm" className="w-9.5 rounded-sm" disabled={loading} onClick={handleClickAsk} title="Ask">
            {!loading && <Button.Icon icon="fa-solid fa-star" />}
            {loading && <Button.Icon icon="fa-solid fa-sync fa-spin" />}
          </Button>
        )}
        <Button
          size="sm"
          intent="danger"
          className="w-9.5 rounded-sm"
          disabled={loading}
          onClick={handleClickClearConversation}
          title="Clear the conversation"
        >
          <Button.Icon icon="fa-solid fa-eraser" />
        </Button>
      </div>
      <div className="mx-2 flex items-center justify-end text-xs">{threadId}</div>
    </div>
  );
};

export default OpenAIChat;
