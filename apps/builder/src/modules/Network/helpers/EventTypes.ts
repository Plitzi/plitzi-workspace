import type { RealTimeEvent, RealTimeSelfEvent } from '../types';

const validEvents = new Set(['INIT', 'KA', 'MOUSE', 'ELEMENT', 'COLLABORATOR_CONNECTED', 'COLLABORATOR_DISCONNECTED']);

export const isRealTimeEvent = (value: unknown): value is RealTimeEvent =>
  typeof value === 'string' && validEvents.has(value);

const validSelfEvents = new Set(['COLLABORATOR_CONNECTED', 'COLLABORATOR_DISCONNECTED']);

export const isRealTimeSelfEvent = (value: unknown): value is RealTimeSelfEvent =>
  typeof value === 'string' && validSelfEvents.has(value);
