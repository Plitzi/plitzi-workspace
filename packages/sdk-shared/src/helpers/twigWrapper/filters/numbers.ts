import { formatNumber, numberOf, toStr } from './values';

import type { TwigFilter } from './types';

export const numberFilters: Record<string, TwigFilter> = {
  // `| number_format(2, '.', ',')` — formats a number with decimals and separators.
  number_format: (value, args) => {
    if (typeof value !== 'number') {
      return value;
    }

    const decimals = Number(args[0]) || 0;
    const decPoint = args[1] != null ? toStr(args[1]) : '.';
    const thousandsSep = args[2] != null ? toStr(args[2]) : '';

    const fixed = value.toFixed(decimals);
    if (thousandsSep === '') {
      return fixed.replace('.', decPoint);
    }

    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
    return parts.join(decPoint);
  },

  // `| currency('USD', 'en', { trimZeros: true })` — a price in a currency, as the locale writes one: `$2,040.57`,
  // `$440` when `trimZeros` drops the cents of a whole amount. The locale is `en` unless named, so a page rendered on a
  // server and hydrated in a browser in another locale writes the same text.
  currency: (value, args) => {
    const amount = numberOf(value);
    if (amount === undefined || args.length === 0) {
      return value;
    }

    const options: unknown = args[2];
    const trimZeros =
      typeof options === 'object' && options !== null && 'trimZeros' in options && options.trimZeros === true;
    const whole = trimZeros && Number.isInteger(amount);

    return formatNumber(amount, args[1], {
      style: 'currency',
      currency: toStr(args[0]),
      ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {})
    });
  },
  // `| percent(1)` — a share as a percentage: `0.256|percent(1)` is `25.6%`. Decimals 0 unless named; locale `en`.
  percent: (value, args) => {
    const share = numberOf(value);
    if (share === undefined) {
      return value;
    }

    const decimals = Number(args[0]) || 0;

    return formatNumber(share, args[1], {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }
};
