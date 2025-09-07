import { useCallback, useEffect, useState } from 'react';

import type { RealTimeEvent } from '../types';

export type UseWebsocketProps = {
  url: string;
  protocols?: string[];
  processMessage: ((ev: MessageEvent) => unknown) | null;
  initMessage?: { type: 'init'; payload: { message: string } };
  retryReconnect?: number;
  connectMode?: 'auto' | 'manual';
};

const useWebsocket = ({
  url = '',
  protocols = [],
  processMessage = null,
  initMessage = { type: 'init', payload: { message: 'hi' } },
  retryReconnect = Infinity,
  connectMode = 'auto'
}: UseWebsocketProps) => {
  const [ws, setWs] = useState<WebSocket | undefined>(undefined);
  const [currentRetry, setCurrentRetry] = useState(0);

  const push = useCallback(
    (data: { type: RealTimeEvent; payload: unknown }) => {
      if (!ws || ws.readyState !== ws.OPEN) {
        return;
      }

      ws.send(JSON.stringify(data));
    },
    [ws]
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
    if (processMessage) {
      ws.onmessage = processMessage;
    }

    ws.onopen = () => {
      if (currentRetry > 0) {
        setCurrentRetry(0);
      }

      ws.send(JSON.stringify(initMessage));
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
      ws.onmessage = processMessage;
    }
  }, [ws, processMessage]);

  return { ws, push, close, connect };
};

export default useWebsocket;
