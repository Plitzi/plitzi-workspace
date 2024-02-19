import axios from 'axios';

const callback = async params => {
  const { url, authorizationToken, body } = params;
  let { method } = params;
  let response = {};

  try {
    method = method.toLowerCase();
    const headers = {};
    if (authorizationToken) {
      headers.Authorization = `Bearer ${authorizationToken}`;
    }

    const dataOrParams = ['get', 'delete'].includes(method) ? 'params' : 'data';
    const { data, status } = await axios.request({
      url,
      method,
      headers,
      withCredentials: true,
      [dataOrParams]: body,
      validateStatus: () => true
    });
    response = { status: `${status}`, data };
    if (status >= 200 && status < 300 && method === 'delete') {
      response = { status: `${status}`, data: null };
    }
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
