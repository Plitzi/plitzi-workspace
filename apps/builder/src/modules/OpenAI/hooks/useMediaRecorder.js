// Packages
import { useCallback, useRef, useState } from 'react';
import noop from 'lodash/noop';

const useMediaRecorder = props => {
  const {
    mimeType = 'audio/webm',
    onPausedRecording = noop,
    onResumedRecording = noop,
    onUpdate = noop,
    onFinish = noop
  } = props;
  const [permission, setPermission] = useState(false);
  const [error, setError] = useState(undefined);
  const [recording, setRecording] = useState(false);
  const [audioData, setAudioData] = useState(new Uint8Array(0));
  const [paused, setPaused] = useState(false);

  const chunksRef = useRef([]);
  const mediaRecorderRef = useRef(undefined);

  const audioContextRef = useRef(undefined);
  const analyserRef = useRef(undefined);
  const dataArrayRef = useRef(undefined);
  const sourceRef = useRef(undefined);
  const rafRecordingRef = useRef(undefined);

  const getMicrophonePermission = useCallback(async () => {
    if ('MediaRecorder' in window) {
      try {
        const streamData = await navigator.mediaDevices.getUserMedia({
          // audio: {
          //   // sampleRate: 48000,
          //   // channelCount: 1,
          //   volume: 1.0,
          //   echoCancellation: true,
          //   noiseSuppression: true
          // },
          audio: true,
          video: false
        });
        setPermission(true);
        setError(undefined);

        return streamData;
      } catch (err) {
        setError(err.essage);
      }
    } else {
      setError('The MediaRecorder API is not supported in your browser.');
    }

    return undefined;
  }, []);

  // const processBlob = async blob => {
  //   if (!blob) return;

  //   try {
  //     if (blob.size === 0) {
  //       throw new Error('Error: The audio blob is empty');
  //     }

  //     const audioSrcFromBlob = URL.createObjectURL(blob);
  //     setAudioSrc(audioSrcFromBlob);

  //     const audioBuffer = await blob.arrayBuffer();
  //     const audioContext = new AudioContext();
  //     const buffer = await audioContext.decodeAudioData(audioBuffer);
  //     setBufferFromRecordedBlob(buffer);

  //     setError(null);
  //   } catch (error) {
  //     console.error('Error processing the audio blob:', error);
  //     setError(error instanceof Error ? error : new Error('Error processing the audio blob'));
  //   }
  // };

  const mediaDataAvailable = useCallback(
    event => {
      // processBlob(event.data);
      chunksRef.current.push(event.data);
      if (typeof onUpdate === 'function') {
        onUpdate(chunksRef.current, event.data);
      }
    },
    [onUpdate]
  );

  const mediaDataStop = useCallback(() => {
    const audioBlob = new Blob(chunksRef.current);
    const audioUrl = URL.createObjectURL(audioBlob);
    onFinish(audioUrl, audioBlob);

    mediaRecorderRef.current.removeEventListener('dataavailable', mediaDataAvailable);
    mediaRecorderRef.current.removeEventListener('stop', mediaDataStop);

    const tracks = mediaRecorderRef.current.stream.getTracks();
    tracks.forEach(track => {
      track.stop();
    });

    mediaRecorderRef.current = undefined;
  }, [onFinish]);

  const recordingFrame = () => {
    analyserRef.current?.getByteTimeDomainData(dataArrayRef.current);
    setAudioData(new Uint8Array(dataArrayRef.current));
    rafRecordingRef.current = requestAnimationFrame(recordingFrame);
  };

  const startRecording = useCallback(async () => {
    const stream = await getMicrophonePermission();
    if (!stream) {
      return;
    }

    audioContextRef.current = new window.AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    // analyserRef.current.fftSize = 2048;
    dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);

    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current.start();
    mediaRecorderRef.current.addEventListener('dataavailable', mediaDataAvailable);
    mediaRecorderRef.current.addEventListener('stop', mediaDataStop);

    setRecording(true);
    recordingFrame();
  }, [permission, onUpdate, getMicrophonePermission, mediaDataAvailable, mediaDataStop]);

  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current?.state !== 'recording') {
      return;
    }

    setPaused(true);
    if (onPausedRecording) {
      onPausedRecording();
    }

    mediaRecorderRef.current?.pause();
    if (rafRecordingRef.current) {
      cancelAnimationFrame(rafRecordingRef.current);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current?.state !== 'paused') {
      return;
    }

    if (onResumedRecording) {
      onResumedRecording();
    }

    setPaused(false);
    mediaRecorderRef.current?.resume();
    rafRecordingRef.current = requestAnimationFrame(recordingFrame);
  }, [onResumedRecording]);

  const stopRecording = useCallback(async () => {
    if (!permission) {
      return;
    }

    mediaRecorderRef.current.stop();

    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }

    if (rafRecordingRef.current) {
      cancelAnimationFrame(rafRecordingRef.current);
    }

    setPaused(false);
    setRecording(false);
    setAudioData(new Uint8Array(0));
    cancelAnimationFrame(recordingFrame);
    chunksRef.current = [];
  }, [permission, onFinish]);

  return {
    start: startRecording,
    resume: resumeRecording,
    pause: pauseRecording,
    stop: stopRecording,
    recording,
    error,
    audioData,
    paused
  };
};

export default useMediaRecorder;
