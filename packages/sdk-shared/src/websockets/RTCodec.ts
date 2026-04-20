/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import type { SubscriptionCollaborator } from '../types';

export enum RTEventCloseCode {
  NORMAL = 1000,
  AWAY = 1001,
  ABNORMAL = 1002,
  UNSUPPORTED = 1003,
  UNKNOWN = 4000,
  NOT_AUTHORISED = 4001,
  INSTANCE_ID_NOT_FOUND = 4002,
  USER_TOKEN_NOT_FOUND = 4003
}

export enum RTEvent {
  INIT = 0,
  KA = 1,
  MOUSE = 10,
  ELEMENT = 11,
  COLLABORATOR_CONNECTED = 12,
  COLLABORATOR_DISCONNECTED = 13
}

export const isRTEvent = (value: unknown): value is RTEvent => {
  return typeof value === 'number' && value in RTEvent;
};

export type RTMessageManagedClient =
  | { type: RTEvent.INIT; payload: undefined }
  | { type: RTEvent.KA; payload: undefined }
  | {
      type: RTEvent.MOUSE;
      payload:
        | { action: 'mouseEnter'; rootId: string }
        | { action: 'mouseLeave'; rootId: string }
        | { action: 'mouseMove'; x: number; y: number; zoom: number; rootId: string };
    }
  | {
      type: RTEvent.ELEMENT;
      payload: { action: 'hovered'; rootId: string; id?: string } | { action: 'selected'; rootId: string; id?: string };
    }
  | { type: RTEvent.COLLABORATOR_CONNECTED; payload: SubscriptionCollaborator }
  | { type: RTEvent.COLLABORATOR_DISCONNECTED; payload: SubscriptionCollaborator };

export type RTMessageManagedServer =
  | { type: RTEvent.INIT; payload: { collaborators: SubscriptionCollaborator[] } & { instanceId: string } }
  | { type: RTEvent.KA; payload: undefined }
  | {
      type: RTEvent.MOUSE;
      payload:
        | { action: 'mouseEnter'; rootId: string; instanceId: string }
        | { action: 'mouseLeave'; rootId: string; instanceId: string }
        | { action: 'mouseMove'; x: number; y: number; zoom: number; rootId: string; instanceId: string };
    }
  | {
      type: RTEvent.ELEMENT;
      payload:
        | { action: 'hovered'; rootId: string; id?: string; instanceId: string }
        | { action: 'selected'; rootId: string; id?: string; instanceId: string };
    }
  | { type: RTEvent.COLLABORATOR_CONNECTED; payload: SubscriptionCollaborator }
  | { type: RTEvent.COLLABORATOR_DISCONNECTED; payload: SubscriptionCollaborator };

export type RTCallback = (...args: any[]) => void;

export type RTMessage<T = unknown> = {
  type: RTEvent;
  payload: T;
};

/**
 * Realtime binary codec (no globals)
 */
export default class RTCodec {
  private readonly encoder: TextEncoder;
  private readonly decoder: TextDecoder;

  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  /**
   * Encode ANY payload to binary
   *
   * | 1 byte | 4 bytes | N bytes |
   * | type   | length  | payload |
   */
  encode<T>(type: RTEvent, payload?: T): ArrayBuffer {
    const hasPayload = payload !== undefined;

    const json = hasPayload ? JSON.stringify(payload) : '';
    const payloadBytes = hasPayload ? this.encoder.encode(json) : new Uint8Array(0);

    const buffer = new ArrayBuffer(1 + 4 + payloadBytes.length);
    const view = new DataView(buffer);

    view.setUint8(0, type);
    view.setUint32(1, payloadBytes.length);

    if (payloadBytes.length > 0) {
      new Uint8Array(buffer, 5).set(payloadBytes);
    }

    return buffer;
  }

  /**
   * Decode binary to typed message
   */
  decode<T = unknown>(data: ArrayBuffer): RTMessage<T> {
    const view = new DataView(data);

    const type = view.getUint8(0);
    const length = view.getUint32(1);
    if (length === 0) {
      return { type, payload: undefined as T };
    }

    const payloadBytes = new Uint8Array(data, 5, length);
    const payload = JSON.parse(this.decoder.decode(payloadBytes)) as T;

    return { type, payload };
  }
}

let rtCodecInstance: RTCodec | undefined = undefined;

export const setInstance = (instance?: RTCodec) => {
  rtCodecInstance = instance;
};

// overloads
export function getInstance(autoInit?: true): RTCodec;
export function getInstance(autoInit: false): RTCodec | undefined;
export function getInstance(autoInit = true) {
  if (autoInit && !rtCodecInstance) {
    rtCodecInstance = new RTCodec();
  }

  return rtCodecInstance;
}
