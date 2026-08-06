/** Query-string or form fields as they arrive from a client: every name is optional, and an absent one is not
 *  distinguishable from an empty one — both mean "the client did not send this". */
export type OAuthParams = Record<string, string | undefined>;

export const field = (params: OAuthParams, name: string): string => params[name] ?? '';

export const optionalField = (params: OAuthParams, name: string): string | undefined => params[name] || undefined;
