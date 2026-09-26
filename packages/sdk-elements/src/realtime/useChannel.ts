import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { realtimeClientFor, trackPresence } from '@plitzi/sdk-shared/realtime';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import type { RealtimeMessage } from '@plitzi/sdk-shared';
import type { PresenceTracker, RealtimeMember } from '@plitzi/sdk-shared/realtime';

export type UseChannelOptions = {
  /** What this page announces to the channel's members — a name, a colour. Announced again when it changes. */
  presence?: unknown;
  /** Each message, as it arrives. Read through a ref: a new function each render does not reconnect anything. */
  onMessage?: (message: RealtimeMessage) => void;
};

export type ChannelHandle = {
  connected: boolean;
  /** This page's name on the channel — the `from` of what it sends. */
  me: string | undefined;
  members: RealtimeMember[];
  publish: (type: string, data: unknown) => Promise<boolean>;
  setPresence: (state: unknown) => void;
};

/**
 * A realtime channel, for a component: what the `channel` element is built on, and what a plugin that has to move at
 * the speed of a cursor reads directly.
 *
 * Messages arrive through `onMessage` rather than as state, so a canvas redrawing sixty cursors a second does not
 * re-render the component sixty times a second. Closed — no connection, no members — where the page has no server to
 * connect to (the builder, an embed), and on the server.
 */
const useChannel = (topic: string | undefined, { presence, onMessage }: UseChannelOptions = {}): ChannelHandle => {
  const [endpoint] = useCommonStore('realtime.endpoint');
  const [transport] = useCommonStore('realtime.transport');
  const client = useMemo(
    () => (endpoint && typeof window !== 'undefined' ? realtimeClientFor(endpoint, transport) : undefined),
    [endpoint, transport]
  );
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<RealtimeMember[]>([]);
  const tracker = useRef<PresenceTracker | undefined>(undefined);
  const listener = useRef(onMessage);
  useEffect(() => {
    listener.current = onMessage;
  });

  useEffect(() => {
    if (!client || !topic) {
      return undefined;
    }

    const current = trackPresence(client, topic, setMembers, message => listener.current?.(message));
    tracker.current = current;
    setConnected(client.status === 'open');
    const stopStatus = client.onStatus(status => setConnected(status === 'open'));

    return () => {
      stopStatus();
      current.stop();
      tracker.current = undefined;
      setMembers([]);
      setConnected(false);
    };
  }, [client, topic]);

  // Compared as JSON: a presence written as a template is a new object on every render with the same meaning.
  const announced = presence === undefined ? undefined : JSON.stringify(presence);
  useEffect(() => {
    if (announced !== undefined) {
      tracker.current?.set(JSON.parse(announced) as unknown);
    }
  }, [announced, client, topic]);

  const publish = useCallback(
    (type: string, data: unknown) => (client && topic ? client.publish(topic, type, data) : Promise.resolve(false)),
    [client, topic]
  );
  const setPresence = useCallback((state: unknown) => tracker.current?.set(state), []);

  return { connected, me: connected ? client?.me : undefined, members, publish, setPresence };
};

export default useChannel;
