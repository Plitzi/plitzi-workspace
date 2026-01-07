import { describe, it, expect } from 'vitest';

import RTCodec, { RTEvent } from './RTCodec';

import type { RTMessage } from './RTCodec';

describe('RTCodec', () => {
  const codec = new RTCodec();

  it('encodes and decodes a simple object payload', () => {
    const payload = { x: 10, y: 20 };

    const buffer = codec.encode(RTEvent.MOUSE, payload);
    const decoded = codec.decode<typeof payload>(buffer);

    expect(decoded).toEqual<RTMessage<typeof payload>>({
      type: RTEvent.MOUSE,
      payload
    });
  });

  it('supports different payload shapes', () => {
    const payload = {
      id: 'abc',
      active: true,
      count: 42,
      tags: ['a', 'b', 'c']
    };

    const buffer = codec.encode(RTEvent.ELEMENT, payload);
    const decoded = codec.decode<typeof payload>(buffer);

    expect(decoded.type).toBe(RTEvent.ELEMENT);
    expect(decoded.payload).toEqual(payload);
  });

  it('encodes payload length correctly', () => {
    const payload = { message: 'hello world' };
    const buffer = codec.encode(RTEvent.ELEMENT, payload);

    const view = new DataView(buffer);
    const length = view.getUint32(1);

    const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));

    expect(length).toBe(encodedPayload.length);
  });

  it('throws on invalid JSON payload', () => {
    const buffer = new ArrayBuffer(10);
    const view = new DataView(buffer);

    view.setUint8(0, RTEvent.MOUSE);
    view.setUint32(1, 5);

    // bytes inválidos (no JSON)
    new Uint8Array(buffer, 5).set([255, 255, 255, 255, 255]);

    expect(() => codec.decode(buffer)).toThrow();
  });

  it('can handle empty payload object', () => {
    const payload = {};

    const buffer = codec.encode(RTEvent.MOUSE, payload);
    const decoded = codec.decode<typeof payload>(buffer);

    expect(decoded.payload).toEqual({});
  });

  it('encodes and decodes when payload is undefined', () => {
    const buffer = codec.encode(RTEvent.MOUSE);
    const decoded = codec.decode(buffer);

    expect(decoded.type).toBe(RTEvent.MOUSE);
    expect(decoded.payload).toBeUndefined();

    const view = new DataView(buffer);
    const length = view.getUint32(1);

    expect(length).toBe(0);
  });
});
