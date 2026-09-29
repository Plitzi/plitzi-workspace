/**
 * `/pulse`: an event stream held open for as long as someone listens, saying how many are listening — what a function
 * cannot be. A function answers one request and is gone; this keeps its listeners in the runtime's memory and speaks
 * to all of them on its own clock.
 */

type Listener = ReadableStreamDefaultController<Uint8Array>;

export type Pulse = {
  /** The endpoint, as a web handler: a stream per listener, closed when they go. */
  handle: () => Response;
  /** Every stream ended: the runtime is stopping. */
  close: () => void;
};

const encoder = new TextEncoder();

export const createPulse = ({ everySeconds }: { everySeconds: number }): Pulse => {
  const listeners = new Set<Listener>();

  const say = (listener: Listener): void => {
    // In UTC, as everything a server says the time in.
    const beat = { listening: listeners.size, at: new Date().toISOString() };
    listener.enqueue(encoder.encode(`data: ${JSON.stringify(beat)}\n\n`));
  };

  const beat = (): void => {
    listeners.forEach(say);
  };

  const clock = setInterval(beat, everySeconds * 1000);
  clock.unref();

  return {
    handle: () => {
      let mine: Listener | undefined;
      const body = new ReadableStream<Uint8Array>({
        start: controller => {
          mine = controller;
          listeners.add(controller);
          // Everyone hears that one more is listening, the newcomer first of all.
          beat();
        },
        cancel: () => {
          if (mine) {
            listeners.delete(mine);
          }
        }
      });

      return new Response(body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
    },
    close: () => {
      clearInterval(clock);
      listeners.forEach(listener => listener.close());
      listeners.clear();
    }
  };
};
