/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-condition */
import { useCallback, useRef, useState } from 'react';

import useMediaRecorder from './useMediaRecorder';

type UseVoiceOptions = {
  onTranscript: (text: string) => void;
};

// Web Speech API is not fully typed in all TS DOM lib versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSpeechRecognition = (): (new () => any) | undefined =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

const useVoice = ({ onTranscript }: UseVoiceOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const { start: startRecording, stop: stopRecording, audioData } = useMediaRecorder({});

  const start = useCallback(async () => {
    if (!isSupported || isListening) {
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR) {
      return;
    }

    await startRecording();

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = (event.results[0]?.[0]?.transcript as string | undefined) ?? '';
      if (transcript) {
        onTranscript(transcript);
      }
    };

    const cleanup = () => {
      stopRecording();
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = cleanup;
    recognition.onerror = cleanup;

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, isListening, startRecording, stopRecording, onTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { start, stop, isListening, isSupported, audioData };
};

export default useVoice;
