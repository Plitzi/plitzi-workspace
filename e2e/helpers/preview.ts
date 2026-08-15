import { expect } from '@playwright/test';

import type { APIRequestContext } from '@playwright/test';

/** Minting a draft, the way an agent does: hand the endpoint operations, get back a one-shot token, then load a
 *  normal page carrying it. Nothing is saved — which is what makes it the right tool for a spec that wants a
 *  different page without leaving one behind. */

export const PREVIEW_SECRET = 'e2e-preview-secret';

export type PreviewOperation = Record<string, unknown> & { type: string };

export const mintPreview = async (
  request: APIRequestContext,
  origin: string,
  operations: PreviewOperation[]
): Promise<string> => {
  const response = await request.post(`${origin}/__preview`, {
    headers: { 'content-type': 'application/json', 'x-preview-secret': PREVIEW_SECRET },
    data: { spaceId: 1, operations }
  });

  expect(response.status(), 'preview refused to mint a draft').toBe(200);

  const { ok, token } = (await response.json()) as { ok: boolean; token?: string };

  expect(ok).toBe(true);
  expect(token, 'preview returned no token').toBeTruthy();

  return token as string;
};

export const previewUrl = (origin: string, token: string, path = '/'): string => `${origin}${path}?__pt=${token}`;
