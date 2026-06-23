import type { ElementContextValue } from './ElementContext';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { Context, CSSProperties, FC, JSX, ReactNode, RefObject } from 'react';

export type RootElementProps<T extends keyof JSX.IntrinsicElements> = {
  ref?: RefObject<HTMLElement | null>;
  children?: ReactNode;
  tag?: T;
  className?: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  style?: string | CSSProperties;
} & Omit<Partial<JSX.IntrinsicElements[T]>, 'ref' | 'style'>;

export type ElementTag = FC<{ [key: string]: unknown }>;

export type DebugParams = Record<string, string | undefined | boolean>;

export type ResolvedProps = {
  elementContext: ElementContextValue;
  Tag: ElementTag;
  refProp?: RefObject<HTMLElement | null>;
  styleParsed?: CSSProperties;
  className: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  otherProps: Record<string, unknown>;
  children?: ReactNode;
};

export type InteractiveProps = ResolvedProps & {
  InteractionsContext: Context<InteractionsContextValue>;
  previewMode: boolean;
  debugMode: boolean;
  baseElementId?: string;
  params: DebugParams;
  serverMarker?: { 'data-rsc-id': string };
};

export type StaticTagProps = {
  Tag: ElementTag;
  refProp?: RefObject<HTMLElement | null>;
  style?: CSSProperties;
  className: string;
  otherProps: Record<string, unknown>;
  params?: DebugParams;
  serverMarker?: { 'data-rsc-id': string };
  events?: Record<string, unknown>;
  children?: ReactNode;
};
