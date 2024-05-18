// Packages
import React, { useCallback, use, useEffect, useState, useTransition, useRef } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import Input from '@plitzi/plitzi-ui-components/Input';
import Button from '@plitzi/plitzi-ui-components/Button';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Alias
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import NetworkContext from '@pmodules/Network/NetworkContext';
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
  const [, setCache, getCacheByKey] = useCache();
  const [threadId, setThreadId] = useState(() =>
    getCacheByKey('assistantAI.threadId', 'thread_BrjclqslTbCRzSUFSbadon4F')
  );
  const [conversation, setConversation] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [retrieveMessagePending, setRetrieveMessagePending] = useTransition();

  const getThreadMessages = useCallback(
    async threadId => {
      const response = await networkQuery('/assistant/thread-messages', { threadId }, 'post');
      if (!response || !response?.messages) {
        return;
      }

      setConversation(response?.messages.reverse());
    },
    [networkQuery]
  );

  const initAssistant = useCallback(async () => {
    const response = await networkQuery('/assistant/generate-thread');
    if (!response) {
      return;
    }

    const threadIdResponse = get(response, 'threadId', '');
    setThreadId(threadIdResponse);
    await getThreadMessages(threadIdResponse);
    setCache(threadIdResponse, 'assistantAI.threadId');
  }, [getThreadMessages, threadId]);

  const askToAssistant = useCallback(
    message => {
      setRetrieveMessagePending(async () => {
        const responseAsk = await networkQuery('/assistant/ask', { threadId, message }, 'post');
        if (!responseAsk || !responseAsk?.message) {
          return;
        }

        setConversation(state => [...state, responseAsk?.message]);
        const responseRetrieve = await networkQuery('/assistant/retrieve-message', { threadId }, 'post');
        if (!responseRetrieve || !responseRetrieve?.messages) {
          return;
        }

        setConversation(responseRetrieve?.messages.reverse());
      });
    },
    [threadId]
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
      console.log(e.ctrlKey, e);
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !retrieveMessagePending) {
        handleClickAsk();
      }
    },
    [handleClickAsk, retrieveMessagePending]
  );

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
    <div className={classNames('h-full flex flex-col min-h-0 relative', className)}>
      <div className="flex flex-col grow border-b border-gray-300">
        <Chat className="flex basis-0 grow m-3" messages={conversation} ref={chatRef} />
      </div>
      <div className="flex p-4">
        <div className="flex grow basis-0">
          {!recording && (
            <Input
              className="min-w-0 basis-0 grow"
              inputClassName="rounded min-w-0 basis-0"
              value={messageInput}
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
          <div className="flex ml-2 rounded overflow-hidden">
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
            className="rounded mx-2 w-[38px]"
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
          <Button size="sm" className="rounded w-[38px]" disabled={loading} onClick={handleClickAsk} title="Ask">
            {!loading && <i className="fa-solid fa-star" />}
            {loading && <i className="fa-solid fa-sync fa-spin" />}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OpenAIChat;
