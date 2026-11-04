import DOMPurify from 'dompurify';

import { scriptPolicyEnforced, trustedTypesFactory } from '@plitzi/sdk-shared/security';

import { keptByText } from '../helpers/keptByText';

import type { TrustedTypesPolicy } from '@plitzi/sdk-shared/security';

/**
 * Markup an author or the data wrote — a raw HTML block, rich text, an SVG — made a trusted value through the
 * `plitzi-author-html` policy where the browser asks for one (Trusted Types), and cleaned there when the page's script
 * policy is enforced: what DOMPurify leaves is the markup and its styles, without what runs — a `<script>`, an `on…`
 * handler, a `javascript:` address. Reported only, it passes as it was: cleaning it then would take away a handler the
 * page still runs.
 *
 * On the server, and in a browser without Trusted Types, the markup as it is: the server's HTML is held to the page's
 * script policy, which refuses what runs in it whatever wrote it.
 */
let policy: TrustedTypesPolicy | null | undefined;

const authorPolicy = (): TrustedTypesPolicy | null => {
  if (policy !== undefined) {
    return policy;
  }

  const factory = trustedTypesFactory();
  policy = factory
    ? factory.createPolicy('plitzi-author-html', {
        createHTML: input => (scriptPolicyEnforced() ? DOMPurify.sanitize(input) : input)
      })
    : null;

  return policy;
};

/**
 * Kept by the markup it was made from: React writes `innerHTML` again whenever the value is another object, and cleaning
 * a block is work — every render of a page asked for the same blocks. Bounded by what the markup weighs.
 */
const made = keptByText<TrustedHTML>(512 * 1024);

export const authorHtml = (html: string): string | TrustedHTML => {
  const trusted = authorPolicy();
  if (!trusted) {
    return html;
  }

  const known = made.get(html);
  if (known) {
    return known;
  }

  const value = trusted.createHTML(html);
  made.set(html, value);

  return value;
};
