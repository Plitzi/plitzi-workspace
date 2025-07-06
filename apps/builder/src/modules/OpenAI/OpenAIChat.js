// Packages
import React, { useCallback, use, useEffect, useState, useTransition, useRef } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import Input from '@plitzi/plitzi-ui-components/Input';
import Button from '@plitzi/plitzi-ui-components/Button';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';

// Alias
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import useMediaRecorder from './hooks/useMediaRecorder';
import VoiceVisualizer from './components/VoiceVisualizer';
import Chat from './components/Chat';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const OpenAIChat = props => {
  const { className = '' } = props;
  const chatRef = useRef();
  const { server, webKey } = use(NetworkContext);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });
  const { currentPageId } = use(NavigationContext);
  const { elementSelected } = use(BuilderSelectedContext);
  const [threadId, setThreadId] = useStorage('builder-state.assistantAI.threadId', ''); // <string>
  const [conversation, setConversation] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [retrieveMessagePending, setRetrieveMessagePending] = useTransition();

  const getThreadMessages = useCallback(
    async threadId => {
      const response = await networkQuery(`/assistant/thread/messages?threadId=${threadId}`);
      if (!response || !response?.messages) {
        return;
      }

      setConversation(response?.messages.reverse());
    },
    [networkQuery]
  );

  const initAssistant = useCallback(async () => {
    const response = await networkQuery('/assistant/thread', {}, 'post');
    if (!response) {
      return;
    }

    const threadIdResponse = get(response, 'threadId', '');
    await getThreadMessages(threadIdResponse);
    setThreadId(threadIdResponse);
  }, [getThreadMessages, threadId, setThreadId]);

  const askToAssistant = useCallback(
    message => {
      setRetrieveMessagePending(async () => {
        const responseAsk = await networkQuery('/assistant/thread/message', { threadId, message }, 'post');
        if (!responseAsk?.message) {
          return;
        }

        setConversation(state => [...state, responseAsk.message]);
        const responseRetrieve = await networkQuery(
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

  const handleClickAsk = useCallback(async () => {
    setMessageInput('');
    askToAssistant(messageInput);
  }, [messageInput, askToAssistant, threadId]);

  const onFinishRecording = useCallback(
    async (audioUrl, audioBlob) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      const response = await networkQuery('/assistant/transcription', formData, 'post');
      if (!response || !response.transcript) {
        return;
      }

      setMessageInput(response.transcript);
      // setConversation(state => [...state, response.transcript]);
      // const reply = await askToAssistant(response.transcript);
      // setPreview(reply);
    },
    [askToAssistant]
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

  const handleClickTranscript = useCallback(async () => {
    if (!recording) {
      start();

      return;
    }

    stop();
  }, [start, stop, recording]);

  const handleChangeMessage = useCallback(e => setMessageInput(e.target.value), []);

  const handleMessageKeyDown = useCallback(
    e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !retrieveMessagePending) {
        handleClickAsk();
      }
    },
    [handleClickAsk, retrieveMessagePending]
  );

  const handleClickClearConversation = useCallback(() => {
    setConversation([]);
    setThreadId('');
    initAssistant();
  }, [initAssistant, setThreadId]);

  useEffect(() => {
    if (!threadId) {
      initAssistant();
    } else {
      getThreadMessages(threadId);
    }
  }, []);

  useEffect(() => {
    const id = get(conversation, `${conversation.length - 1}.id`);
    if (!id) {
      return;
    }

    document.getElementById(id).scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
  }, [conversation]);

  const loading = retrieveMessagePending || networkLoading;

  return (
    <div className={classNames('relative flex h-full min-h-0 flex-col', className)}>
      <div className="flex grow flex-col border-b border-gray-300">
        <Chat className="m-3 flex grow basis-0" messages={conversation} ref={chatRef} />
      </div>
      <div className="flex gap-2 p-2">
        <div className="flex grow basis-0 gap-4">
          {!recording && (
            <Input
              className="min-w-0 grow basis-0"
              inputClassName="rounded-sm min-w-0 basis-0"
              value={messageInput}
              size="sm"
              onChange={handleChangeMessage}
              onKeyDown={handleMessageKeyDown}
            />
          )}
          {recording && (
            <VoiceVisualizer
              className="h-[38px] pr-2"
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
            <Button className="w-[38px]" size="sm" intent="danger" onClick={handleClickPauseTranscript}>
              {!paused && <i className="fa-solid fa-pause" />}
              {paused && <i className="fa-solid fa-play" />}
            </Button>
            <Button className="w-[38px]" size="sm" intent="danger" onClick={handleClickTranscript}>
              <i className="fa-solid fa-stop" />
            </Button>
          </div>
        )}
        {!recording && (
          <Button
            className="w-[38px] rounded-sm"
            size="sm"
            intent={recording ? 'danger' : 'primary'}
            disabled={loading}
            onClick={handleClickTranscript}
          >
            {!recording && <i className="fa-solid fa-microphone" />}
            {recording && <i className="fa-solid fa-stop" />}
          </Button>
        )}
        {!recording && (
          <Button size="sm" className="w-[38px] rounded-sm" disabled={loading} onClick={handleClickAsk} title="Ask">
            {!loading && <i className="fa-solid fa-star" />}
            {loading && <i className="fa-solid fa-sync fa-spin" />}
          </Button>
        )}
        <Button
          size="sm"
          intent="danger"
          className="w-[38px] rounded-sm"
          disabled={loading}
          onClick={handleClickClearConversation}
          title="Clear the conversation"
        >
          <i className="fa-solid fa-eraser" />
        </Button>
      </div>
      <div className="mx-2 flex items-center justify-end text-xs">{threadId}</div>
    </div>
  );
};

export default OpenAIChat;
