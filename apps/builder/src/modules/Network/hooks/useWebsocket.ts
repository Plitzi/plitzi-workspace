import { useCallback, useEffect, useMemo, useState } from 'react';

import RTCodec, { RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';

import type { RTMessageManagedClient } from '@plitzi/sdk-shared/websockets/RTCodec';

export type UseWebsocketProps<T> = {
  isBinary?: boolean;
  url: string;
  protocols?: string[];
  processMessage: ((data: T) => void) | null;
  initMessage?: { type: RTEvent.INIT; payload: undefined };
  retryReconnect?: number;
  connectMode?: 'auto' | 'manual';
};

const useWebsocket = <T = unknown>({
  isBinary = false,
  url = '',
  protocols = [],
  processMessage = null,
  initMessage = { type: RTEvent.INIT, payload: undefined },
  retryReconnect = Infinity,
  connectMode = 'auto'
}: UseWebsocketProps<T>) => {
  const [ws, setWs] = useState<WebSocket | undefined>(undefined);
  const rtCodec = useMemo(() => (isBinary ? new RTCodec() : undefined), [isBinary]);
  const [currentRetry, setCurrentRetry] = useState(0);

  const push = useCallback(
    (data: RTMessageManagedClient) => {
      if (!ws || ws.readyState !== ws.OPEN) {
        return;
      }

      if (isBinary && rtCodec) {
        ws.send(rtCodec.encode(data.type, data.payload));
      } else if (!isBinary) {
        ws.send(JSON.stringify(data));
      }
    },
    [rtCodec, isBinary, ws]
  );

  const handleProcess = useCallback(
    (ev: MessageEvent<T>) => {
      let data = ev.data;
      if (isBinary) {
        data = rtCodec?.decode(data as ArrayBuffer) as T;
      }

      processMessage?.(data);
    },
    [isBinary, processMessage, rtCodec]
  );

  const close = useCallback(
    (closeCode = 1000) => {
      if (!ws) {
        return;
      }

      if (ws.readyState === ws.OPEN) {
        ws.close(closeCode);
      }

      setWs(undefined);
    },
    [ws]
  );

  const connect = () => {
    if (retryReconnect !== Infinity && currentRetry > retryReconnect) {
      return undefined;
    }

    const ws = new WebSocket(url, protocols);
    if (isBinary) {
      ws.binaryType = 'arraybuffer';
    }

    if (processMessage) {
      ws.onmessage = handleProcess;
    }

    ws.onopen = () => {
      if (currentRetry > 0) {
        setCurrentRetry(0);
      }

      push(initMessage);
    };

    ws.onerror = () => ws.close();

    ws.onclose = e => {
      const { reason, code } = e;
      if (code === 1000) {
        return;
      }

      if (reason === 'Access Not Authorized') {
        ws.close();
      } else {
        setTimeout(() => {
          if (retryReconnect !== Infinity) {
            setCurrentRetry(state => state + 1);
          }

          setWs(connect());
        }, 2500);
      }
    };

    return ws;
  };

  useEffect(() => {
    let internalWs = ws;
    if (connectMode === 'auto' && !internalWs) {
      internalWs = connect();
      setWs(internalWs);
    }

    return () => {
      if (connectMode === 'auto' && internalWs && internalWs.readyState === internalWs.OPEN) {
        internalWs.close(1000);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, url, close, connectMode]);

  useEffect(() => {
    if (ws) {
      ws.onmessage = handleProcess;
    }
  }, [ws, handleProcess]);

  return { ws, push, close, connect };
};

export default useWebsocket;
