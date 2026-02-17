import type { InteractionCallback } from '@plitzi/sdk-shared';

const delayTime: InteractionCallback<{
  url: string;
  method: string;
  body: Record<string, string | Blob>;
  authorizationToken: string;
  credentials: RequestCredentials;
}> = {
  action: 'webHook',
  title: 'Webhook',
  type: 'utility',
  params: {
    url: { canBind: true, defaultValue: '', type: 'text', label: 'Url' },
    method: {
      label: 'Method',
      type: 'select',
      defaultValue: 'get',
      options: [
        { label: 'Get', value: 'get' },
        { label: 'Post', value: 'post' },
        { label: 'Put', value: 'put' },
        { label: 'Delete', value: 'delete' },
        { label: 'Patch', value: 'patch' },
        { label: 'Head', value: 'head' }
      ]
    },
    body: { canBind: true, defaultValue: '', type: 'textarea', label: 'Body' },
    authorizationToken: { canBind: true, defaultValue: '', type: 'text', label: 'Authorization Token' },
    credentials: {
      canBind: true,
      defaultValue: 'same-origin',
      type: 'select',
      options: [
        { label: 'Include', value: 'include' },
        { label: 'Omit', value: 'omit' },
        { label: 'Same Origin', value: 'same-origin' }
      ],
      label: 'Credentials'
    }
  },
  preview: { response: { status: '', data: '' } },
  callback: async params => {
    const { url, authorizationToken, body, credentials } = params;
    let { method } = params;
    let response: { status?: number; data?: string } = {};

    try {
      method = method.toUpperCase();
      const headers: { [key: string]: string } = {};
      if (authorizationToken) {
        headers.Authorization = `Bearer ${authorizationToken}`;
      }

      Object.values(body).forEach(value => {
        if (value instanceof Blob && headers['Content-Type'] !== 'multipart/form-data') {
          headers['Content-Type'] = 'multipart/form-data';

          return;
        }
      });

      const formData = new FormData() as FormData | undefined;
      Object.entries(body).forEach(([key, value]) => {
        formData?.append(key, value);
      });

      const fetchOptions: RequestInit = { method, headers, body: formData, credentials };
      if (method === 'get') {
        delete fetchOptions.body;
      }

      const res = await fetch(url, fetchOptions);

      let data: string = '';
      try {
        data = (await res.json()) as string;
      } catch {
        // nothing, just ignore
      }

      response = { status: res.status, data };
    } catch (e) {
      console.error(e);
    } finally {
      // test
    }

    return { response };
  }
};

export default delayTime;
