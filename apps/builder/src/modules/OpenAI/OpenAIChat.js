// Packages
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import get from 'lodash/get';
import Input from '@plitzi/plitzi-ui-components/Input';
import Button from '@plitzi/plitzi-ui-components/Button';
import ContainerResizable from '@plitzi/plitzi-ui-components/ContainerResizable';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

// Alias
import useNetwork from '@pmodules/Network/hooks/useNetwork';
import NetworkContext from '@pmodules/Network/NetworkContext';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';
import StyleContext from '@pmodules/Style/StyleContext';
import useMediaRecorder from './hooks/useMediaRecorder';
import VoiceVisualizer from './components/VoiceVisualizer';

const OpenAIChat = props => {
  const { className = '' } = props;
  const { server, webKey } = useContext(NetworkContext);
  const { rootDOM } = useContext(ContainerRootContext);
  const { networkQuery, networkLoading } = useNetwork({ initLoading: false, server, webKey });
  const [assistantThread, setAssistantThread] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [preview, setPreview] = useState({
    schema: { flat: {} },
    style: { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' },
    definition: { rootId: '' }
  });
  const [message, setMessage] = useState('');

  const getThreadMessages = useCallback(
    async threadId => {
      const response = await networkQuery('/assistant/thread-messages', { threadId }, 'post');
      if (!response || !response?.reply) {
        return;
      }
      setConversation(state => [...state, response?.reply]);
    },
    [networkQuery]
  );

  const initAssistant = useCallback(async () => {
    const response = await networkQuery('/assistant/generate-thread');
    if (!response) {
      return;
    }

    const threadId = get(response, 'threadId', '');
    setAssistantThread(threadId);
    await getThreadMessages(threadId);
  }, [getThreadMessages]);

  const askToAssistant = useCallback(
    async content => {
      const response = await networkQuery('/assistant/ask', { threadId: assistantThread, message: content }, 'post');
      if (!response || !response?.reply) {
        return {
          schema: { flat: {} },
          style: { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' },
          definition: { rootId: '' }
        };
      }

      return response?.reply;
    },
    [assistantThread]
  );

  const handleClickAsk = useCallback(async () => {
    setConversation(state => [...state, message]);
    const reply = await askToAssistant(message);
    setMessage('');
    setPreview(reply);
  }, [assistantThread, message, askToAssistant]);

  const onFinishRecording = useCallback(
    async (audioUrl, audioBlob) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      const response = await networkQuery('/assistant/transcription', formData, 'post');
      if (!response || !response.transcript) {
        return;
      }

      setMessage(response.transcript);
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

  useEffect(() => {
    initAssistant();
  }, []);

  const schemaMemo = useMemo(() => ({ schema: preview?.schema }), [preview?.schema]);

  const styleMemo = useMemo(() => ({ style: preview?.style }), [preview?.style]);

  const resizeHandles = useMemo(() => ['w'], []);

  return (
    <div className={classNames('h-full flex', className)}>
      <div className="flex flex-col grow basis-0 p-4 overflow-y-auto">
        <SchemaContext.Provider value={schemaMemo}>
          <StyleContext.Provider value={styleMemo}>
            <BuilderAreaPreview
              previewMode
              className="h-full"
              schema={schemaMemo?.schema}
              id={preview?.definition?.rootId}
              styleCache={styleMemo?.style?.cache}
            />
          </StyleContext.Provider>
        </SchemaContext.Provider>
      </div>
      <div className="flex h-full bg-white">
        <ContainerResizable
          className={className}
          autoGrow={false}
          minConstraintsX={280}
          minConstraintsY={Infinity}
          maxConstraintsX={500}
          width={280}
          resizeHandles={resizeHandles}
          parentElement={rootDOM}
        >
          <div className="flex flex-col grow px-4 py-2 overflow-y-auto border-b border-gray-300">
            {conversation.map((message, index) => (
              <div key={index} className="py-2">
                {JSON.stringify(message)}
              </div>
            ))}
          </div>
          <div className="flex p-4">
            <div className="flex grow basis-0">
              {!recording && (
                <Input
                  className="min-w-0 basis-0 grow"
                  inputClassName="rounded min-w-0 basis-0"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
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
                disabled={networkLoading}
                onClick={handleClickTranscript}
              >
                {!recording && <i className="fa-solid fa-microphone" />}
                {recording && <i className="fa-solid fa-stop" />}
              </Button>
            )}
            {!recording && (
              <Button
                size="sm"
                className="rounded w-[38px]"
                disabled={networkLoading}
                onClick={handleClickAsk}
                title="Ask"
              >
                {!networkLoading && <i className="fa-solid fa-star" />}
                {networkLoading && <i className="fa-solid fa-sync fa-spin" />}
              </Button>
            )}
          </div>
        </ContainerResizable>
      </div>
    </div>
  );
};

OpenAIChat.propTypes = {
  className: PropTypes.string
};

export default OpenAIChat;
