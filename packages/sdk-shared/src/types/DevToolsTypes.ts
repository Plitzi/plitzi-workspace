import type { InteractionNode, InteractionStatus } from './InteractionTypes';
import type { NavigationStatus } from './NavigationTypes';
import type { ElementInteraction } from './SchemaTypes';
import type { ReactNode } from 'react';

export type LogType = 'info' | 'warning' | 'danger' | 'success' | 'custom';
export type LogCategory = 'navigation' | 'interactions';

export type LogNavigation = { category: 'navigation'; params: { status: NavigationStatus; elementId: string } };
export type LogInteraction = {
  category: 'interactions';
  params: {
    elementId: string;
    startTime: number;
    endTime: number;
    node: ElementInteraction;
    status: InteractionStatus;
    nodes: Record<string, InteractionNode>;
  };
};

export type LogParams = LogNavigation['params'] | LogInteraction['params'];
export type Log = { logType: string; message: ReactNode; time?: string } & (LogInteraction | LogNavigation);

export type ProviderCallback = (...args: unknown[]) => Record<string, unknown>;
