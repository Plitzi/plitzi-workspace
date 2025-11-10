/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
let sdk: Record<string, unknown> & { default: unknown };

if (typeof window === 'undefined') {
  // @ts-ignore
  sdk = await import('./ssr/plitzi-sdk.js');
} else {
  // @ts-ignore
  sdk = await import('./plitzi-sdk.js');
}

export const { ...exports } = sdk;

export default sdk.default;
