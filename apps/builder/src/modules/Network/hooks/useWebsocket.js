// Packages
import { useCallback, useEffect, useState } from 'react';

const useWebsocket = (props = {}) => {
  const {
    url = '',
    protocols = [],
    processMessage = null,
    initMessage = { type: 'init', payload: { message: 'hi' } },
    retryReconnect = Infinity,
    connectMode = 'auto'
  } = props;
  const [ws, setWs] = useState(null);
  const [currentRetry, setCurrentRetry] = useState(0);

  const push = useCallback(
    data => {
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

      if (ws && ws.readyState === ws.OPEN) {
        ws.close(closeCode);
      }

      setWs(null);
    },
    [ws]
  );

  const connect = () => {
    if (retryReconnect !== Infinity && currentRetry > retryReconnect) {
      return null;
    }

    const ws = new WebSocket(url, protocols);
    if (processMessage) {
      ws.onmessage = processMessage;
    }

    ws.onopen = () => {
      if (currentRetry > 0) {
        setCurrentRetry(0);
      }

      if (initMessage) {
        ws.send(JSON.stringify(initMessage));
      }
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
  }, [ws, url, close]);

  useEffect(() => {
    if (ws) {
      ws.onmessage = processMessage;
    }
  }, [ws, processMessage]);

  return { ws, push, close, connect };
};

export default useWebsocket;
