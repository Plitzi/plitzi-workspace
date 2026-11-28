import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RTCodec, isRTEventCloseCode, RTEvent, RTEventCloseCode } from '@plitzi/sdk-shared/websockets';

import type { RTMessageManagedClient } from '@plitzi/sdk-shared/websockets';

export type UseWebsocketProps<T> = {
  isBinary?: boolean;
  /**
   * Read as each connection opens, never kept: what the address carries — the person's credential — is renewed under
   * a socket that outlives it, and an address captured in a render reopened the socket with the token it replaced.
   */
  url: () => string;
  protocols?: string[];
  processMessage: ((data: T) => void) | null;
  initMessage?: { type: RTEvent.INIT; payload: undefined };
  retryReconnect?: number;
  connectMode?: 'auto' | 'manual';
  /**
   * The server refused the session the socket was opened with (`SESSION_REFUSED`, its reason the refusal's): answers
   * whether it was renewed, and the socket opens again at once — with the renewed credential, `url` being read then.
   * Without it, or answered `false`, the socket stays closed, as it does for any refusal.
   */
  onSessionRefused?: (reason: string) => Promise<boolean>;
};

const useWebsocket = <T = unknown>({
  isBinary = false,
  url,
  protocols = [],
  processMessage = null,
  initMessage = { type: RTEvent.INIT, payload: undefined },
  retryReconnect = Infinity,
  connectMode = 'auto',
  onSessionRefused
}: UseWebsocketProps<T>) => {
  const [ws, setWs] = useState<WebSocket | undefined>(undefined);
  const rtCodec = useMemo(() => (isBinary ? new RTCodec() : undefined), [isBinary]);
  const [currentRetry, setCurrentRetry] = useState(0);
  // Set by a renewal-driven reopen, cleared by the first message the server sends — it sends none before it accepted
  // the session. A renewed credential refused again before that is not the session's doing, and renewing once more
  // would loop.
  const renewedUnheard = useRef(false);

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
      renewedUnheard.current = false;
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

  const reopenRenewed = async (reason: string) => {
    if (!onSessionRefused) {
      return;
    }

    if (renewedUnheard.current) {
      console.warn(
        `[builder] The realtime socket was refused again (${reason}) with the credential a renewal had just handed ` +
          'it: it stays closed, and collaborators are not shown until the page is loaded again.'
      );

      return;
    }

    if (await onSessionRefused(reason)) {
      renewedUnheard.current = true;
      setWs(connect());
    }
  };

  const connect = () => {
    if (retryReconnect !== Infinity && currentRetry > retryReconnect) {
      return undefined;
    }

    const ws = new WebSocket(url(), protocols);
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
      const { reason } = e;
      const code = isRTEventCloseCode(e.code) ? e.code : RTEventCloseCode.UNKNOWN;
      if (code === RTEventCloseCode.NORMAL || code === RTEventCloseCode.AWAY) {
        return;
      }

      if (code === RTEventCloseCode.SESSION_REFUSED) {
        reopenRenewed(reason).catch((error: unknown) => {
          console.error('[builder] The realtime socket was not opened again after its session was refused:', error);
        });

        return;
      }

      if (
        reason === 'Access Not Authorized' ||
        code === RTEventCloseCode.NOT_AUTHORISED ||
        code === RTEventCloseCode.INSTANCE_ID_NOT_FOUND ||
        code === RTEventCloseCode.USER_TOKEN_NOT_FOUND
      ) {
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
    // `connect` is a function of each render: as a dependency it would open a socket on every one. The address is read
    // as it opens, never a reason to close one that is open — a renewed token reaches the next connection, and the
    // server checked this one's when it accepted it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, close, connectMode]);

  useEffect(() => {
    if (ws) {
      ws.onmessage = handleProcess;
    }
  }, [ws, handleProcess]);

  return { ws, push, close, connect };
};

export default useWebsocket;
