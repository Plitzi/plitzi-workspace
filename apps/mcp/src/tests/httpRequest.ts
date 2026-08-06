import http from 'node:http';

export type HttpProbeResult = { status: number; body: string };

/** Minimal HTTP client for the server-level tests. They drive a real listening server rather than calling a
 *  handler, because what is under test is the pipeline — which stage answers, and in what order. */
export const httpRequest = (
  port: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string
): Promise<HttpProbeResult> =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, res => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }

    req.end();
  });

/** Headers every MCP JSON-RPC call needs: the Streamable HTTP transport refuses a request that does not accept
 *  both a JSON body and an SSE stream. */
export const RPC_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

export const jsonRpc = (method: string, params?: unknown, id = 1): string =>
  JSON.stringify({ jsonrpc: '2.0', id, method, params });
