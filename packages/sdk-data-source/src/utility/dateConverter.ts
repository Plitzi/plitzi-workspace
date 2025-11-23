import { parseDate, formatDate, formatDateUTC, formatFromNow } from '@plitzi/sdk-shared';

import type { DataSourceUtility, DataSourceUtilityParamsValue, SupportedLocale } from '@plitzi/sdk-shared';

const callback = (
  source: string | number,
  { format = 'dd/MM/yyyy', asAge = false, isUnix = true, isUtc = false, locale = 'en' }: DataSourceUtilityParamsValue
) => {
  if (typeof source !== 'string' && typeof source !== 'number') {
    return source;
  }

  try {
    // Normalize date input using your helper
    const date = parseDate(isUnix ? Number(source) : source);

    if (isNaN(date.getTime())) {
      return source;
    }

    // ---- AGE MODE (e.g. “5 minutes ago”) ----
    if (asAge) {
      return formatFromNow(date, locale as SupportedLocale, { addSuffix: true });
    }

    // ---- UTC FORMATTING MODE ----
    if (isUtc) {
      return formatDateUTC(date, format as string, locale as SupportedLocale);
    }

    // ---- LOCAL FORMATTING MODE ----
    return formatDate(date, format as string, locale as SupportedLocale);
  } catch {
    return source;
  }
};

const dateConverter: DataSourceUtility = {
  action: 'dateConverter',
  title: 'Date Converter',
  type: 'utility',
  params: {
    format: { defaultValue: 'dd/MM/yyyy', type: 'text' },
    asAge: { defaultValue: false, type: 'checkbox' },
    isUnix: { defaultValue: true, type: 'checkbox' },
    isUtc: { defaultValue: false, type: 'checkbox' },
    locale: {
      defaultValue: 'en',
      type: 'select',
      options: [
        { label: 'en', value: 'en' },
        { label: 'es', value: 'es' },
        { label: 'pt', value: 'pt' }
      ]
    }
  },
  preview: { format: '', asAge: '', isUnix: '', isUtc: '', locale: '' },
  callback
};

export default dateConverter;
