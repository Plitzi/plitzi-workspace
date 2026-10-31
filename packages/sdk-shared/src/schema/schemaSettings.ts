import type { Schema } from '../types';

/**
 * Every setting a space can carry, which `schemaSettings.test.ts` holds to the `Schema['settings']` type — what the
 * builder writes (`SCHEMA_UPDATE_SETTINGS`) and the reader of a space keeps. A key outside it is one nothing reads any
 * more — `head`, from before a space declared its fonts.
 */
export const SCHEMA_SETTINGS = [
  'keepState',
  'stateStorage',
  'transientState',
  'keptState',
  'paintedState',
  'robotsTxt',
  'blockAiCrawlers',
  'viewTransitions',
  'siteName',
  'language',
  'favicon',
  'shareImage',
  'themeColor',
  'customCss',
  'withheldPage',
  'visitorRoles',
  'userProvider',
  'tokenStorage',
  'loginUrl',
  'userUrl',
  'refreshUrl',
  'logoutUrl',
  'revokeUrl',
  'detailsPath',
  'tokenPath',
  'refreshTokenPath',
  'expirationTimePath',
  'refreshExpirationTimePath',
  'sessionHintCookie',
  'sessionExchangeUrl',
  'mfaUrl',
  'sessionGate',
  'sessionRevalidateSeconds',
  'debugMode',
  'computed',
  'channels'
] as const satisfies readonly (keyof Schema['settings'])[];

const SETTINGS = new Set<string>(SCHEMA_SETTINGS);

/** Whether a key is a setting a space may carry: one the builder may write, though the space has no value for it yet. */
export const isSchemaSetting = (key: string): key is (typeof SCHEMA_SETTINGS)[number] => SETTINGS.has(key);

/**
 * What one setting holds — text, a number, a flag, a list of keys, the visitors' roles, a colour a scheme — or nothing,
 * to leave it out: what the builder writes one with.
 */
export type SchemaSettingValue = Schema['settings'][keyof Schema['settings']] | undefined;
