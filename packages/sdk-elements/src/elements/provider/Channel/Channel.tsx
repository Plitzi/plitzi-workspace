/* eslint-disable react-refresh/only-export-components */

import clsx from 'clsx';
import { use, useCallback, useMemo, useState } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { JOIN_TYPE, LEAVE_TYPE, PRESENCE_TYPE } from '@plitzi/sdk-shared/realtime';

import declaration from './declaration';
import pathFields from '../../../dataSource/pathFields';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';
import useChannel from '../../../realtime/useChannel';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback, RealtimeMessage } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ChannelProps = {
  ref?: RefObject<HTMLElement | null>;
  className?: string;
  children?: ReactNode;
  /** The topic, usually a template: `board:{{ id }}`. A channel the space declares must cover it. */
  topic?: string;
  /** What this page announces to the members — an object from a binding, or JSON text typed in the builder. */
  presence?: unknown;
  /** How many of the latest messages its source holds. */
  keep?: number | string;
  /** Empty renders no element of its own, as a provider does; a tag gives it one to style. */
  subType?: '' | 'div' | 'section' | 'aside' | 'main';
};

/** JSON text is what the builder hands over when somebody types a value; a binding hands over the value itself. */
const valueOf = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const CHANNEL_TYPES = new Set([PRESENCE_TYPE, JOIN_TYPE, LEAVE_TYPE]);

const Channel = ({ ref, className, children, topic = '', presence, keep = 20, subType = '' }: ChannelProps) => {
  const {
    id,
    definition: { label = 'Channel' }
  } = useElement();
  const {
    settings: { previewMode },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const limit = Math.max(0, Number(keep) || 0);
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);

  // Its own messages are the flows' business; the members' comings and goings are `onJoin`/`onLeave`.
  const onMessage = useCallback(
    (message: RealtimeMessage) => {
      if (message.type === JOIN_TYPE) {
        void interactionsManager.interactionTrigger(id, 'onJoin', { from: message.from });

        return;
      }

      if (message.type === LEAVE_TYPE) {
        void interactionsManager.interactionTrigger(id, 'onLeave', { from: message.from });

        return;
      }

      if (CHANNEL_TYPES.has(message.type)) {
        return;
      }

      if (limit > 0) {
        setMessages(previous => [...previous, message].slice(-limit));
      }

      void interactionsManager.interactionTrigger(id, 'onMessage', { ...message });
    },
    [id, interactionsManager, limit]
  );

  // The builder is editing a document, not attending a meeting: nothing connects there.
  const channel = useChannel(previewMode && topic ? topic : undefined, {
    presence: presence === undefined || presence === '' ? undefined : valueOf(presence),
    onMessage
  });

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({
      publish: {
        ...declaration.callbacks.publish,
        callback: ({ type, data }: { type?: unknown; data?: unknown }) =>
          typeof type === 'string' && type ? channel.publish(type, valueOf(data)) : Promise.resolve(false)
      },
      setPresence: {
        ...declaration.callbacks.setPresence,
        callback: ({ data }: { data?: unknown }) => channel.setPresence(valueOf(data))
      }
    }),
    [channel]
  );

  const sourceName = getSourceName(declaration.sourceType, id);
  const publishedData = useMemo<Record<string, unknown>>(
    () => ({
      connected: channel.connected,
      me: channel.me ?? '',
      members: channel.members,
      messages,
      last: messages.at(-1) ?? null
    }),
    [channel.connected, channel.me, channel.members, messages]
  );
  const sourceFields = useCallback(() => pathFields(publishedData), [publishedData]);
  useRegisterSource({ id, source: sourceName, name: label ? label : `Channel - ${id}`, fields: sourceFields });

  const storeContext = useMemo(
    () => (sourceName ? { runtime: { sources: { [sourceName]: publishedData } } } : emptyObject),
    [publishedData, sourceName]
  );

  return (
    <RootElement
      ref={ref}
      tag={subType}
      className={clsx('plitzi-component__channel', className)}
      interactionTriggers={declaration.triggers}
      interactionCallbacks={interactionCallbacks}
    >
      <StoreProvider inherit="live" name={`Channel:${id}`} value={storeContext}>
        {children}
      </StoreProvider>
    </RootElement>
  );
};

export default withElement(Channel);

export { Channel };
