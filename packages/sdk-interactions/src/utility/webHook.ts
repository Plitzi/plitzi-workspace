type CallbackParams = { url: string; method: string; authorizationToken: string; body: { [key: string]: unknown } };

const callback = async (params: CallbackParams) => {
  const { url, authorizationToken, body } = params;
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

    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => {
      formData.append(key, value as string);
    });

    const fetchOptions: { method: CallbackParams['method']; headers: { [key: string]: string }; body?: FormData } = {
      method,
      headers,
      body: formData
    };
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
};

const delayTime = {
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
    authorizationToken: { canBind: true, defaultValue: '', type: 'text', label: 'Authorization Token' }
  },
  preview: { url: '', method: '', response: { status: '', data: '' } },
  callback
};

export default delayTime;
