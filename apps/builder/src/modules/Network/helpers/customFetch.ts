const parseHeaders = (rawHeaders: string) => {
  const headers = new Headers();
  // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
  // https://tools.ietf.org/html/rfc7230#section-3.2
  const preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
  preProcessedHeaders.split(/\r?\n/).forEach(line => {
    const parts = line.split(':');
    const key = parts.shift()?.trim();
    if (key) {
      const value = parts.join(':').trim();
      headers.append(key, value);
    }
  });

  return headers;
};

type UploadOptions = {
  onError?: (e: ProgressEvent) => void;
  onProgress?: () => void;
  onAbortPossible?: (callback: () => void) => void;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  customFetch?: boolean;
};

export const uploadFetch = (url: URL | RequestInfo, options?: UploadOptions) =>
  new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      const opts = {
        url: '',
        status: xhr.status,
        statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders() || '')
      };
      opts.url = 'responseURL' in xhr ? xhr.responseURL : (opts.headers.get('X-Request-URL') ?? '');
      const body = (xhr.response as unknown) ?? xhr.responseText;

      resolve(new Response(body as BodyInit, opts));
    };

    xhr.onerror = (e: ProgressEvent) => {
      reject(new TypeError('Network request failed'));
      if (options?.onError) {
        options.onError(e);
      }
    };

    xhr.ontimeout = () => {
      reject(new TypeError('Network request failed'));
    };

    xhr.open(options?.method ?? 'GET', url as string | URL, true);

    if (options?.headers) {
      Object.keys(options.headers).forEach(key => {
        const headersRecord = options.headers as Record<string, string>;
        if (headersRecord[key]) {
          xhr.setRequestHeader(key, headersRecord[key]);
        }
      });
    }

    if (options?.onProgress) {
      xhr.upload.onprogress = options.onProgress;
    }

    if (options?.onAbortPossible) {
      options.onAbortPossible(() => {
        xhr.abort();
      });
    }

    if (options?.body) {
      xhr.send(options.body as string);
    }
  });

const customFetch = (uri: URL | RequestInfo, options?: UploadOptions) => {
  if (options?.customFetch) {
    return uploadFetch(uri, options);
  }

  return fetch(uri, options);
};

export default customFetch;
