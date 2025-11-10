/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

const isServer = !(process as NodeJS.Process & { browser?: boolean }).browser;

type Sdk = Record<string, unknown> & { default: unknown };

// @ts-ignore
const sdk: Sdk = isServer ? await import('../ssr/plitzi-sdk.js') : await import('../plitzi-sdk.js');

export const { ...exports } = sdk;

export default sdk.default;
