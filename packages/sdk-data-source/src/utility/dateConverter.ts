import moment from 'moment';

import type { Moment } from 'moment';

const callback = (source: string | number, { format = 'DD/MM/YYYY', asAge = false, isUnix = true, isUtc = false }) => {
  if (typeof source !== 'string' && typeof source !== 'number') {
    return source;
  }

  let value: number | string | Moment = source;
  try {
    if (isUtc) {
      value = moment.utc(source);
    } else if (isUnix) {
      value = moment.unix(source as number);
    } else {
      value = moment(source);
    }

    if (!value.isValid()) {
      return source;
    }

    if (asAge) {
      value = value.fromNow();
    } else {
      value = value.format(format);
    }
  } catch {
    value = source;
  }

  return value;
};

const dateConverter = {
  action: 'dateConverter',
  title: 'Date Converter',
  type: 'utility',
  params: {
    format: { defaultValue: 'DD/MM/YYYY', type: 'text' },
    asAge: { defaultValue: false, type: 'checkbox' },
    isUnix: { defaultValue: true, type: 'checkbox' },
    isUtc: { defaultValue: false, type: 'checkbox' }
  },
  preview: { time: '' },
  callback
};

export default dateConverter;
