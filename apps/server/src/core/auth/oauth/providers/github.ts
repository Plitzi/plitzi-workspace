import { requestProfileJson } from '../client';

import type { OAuthProfile, OAuthProvider, OAuthProviderConfig } from '../types';

const USER_URL = 'https://api.github.com/user';
const EMAILS_URL = 'https://api.github.com/user/emails';

interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

// api.github.com rejects requests without a User-Agent.
const apiHeaders = (accessToken: string): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'plitzi-sdk-server'
});

export const createGitHubProvider = (config: OAuthProviderConfig): OAuthProvider => ({
  id: 'github',
  label: 'GitHub',
  config,
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  // user:email is required because /user hides the address unless the profile is public.
  scope: 'read:user user:email',
  // GitHub OAuth apps ignore the PKCE challenge; sending one would only be noise.
  usePkce: false,

  // GitHub has no audience claim to read, so the app asks GitHub directly whether this token is one of its own.
  // The check is authenticated with the client secret, which is exactly what makes the answer meaningful: only
  // this application can ask about its own tokens, and a token belonging to another app answers 404.
  async verifyAudience(accessToken: string): Promise<boolean> {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const response = await fetch(`https://api.github.com/applications/${config.clientId}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'plitzi-sdk-server',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ access_token: accessToken })
    });

    return response.ok;
  },

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const headers = apiHeaders(accessToken);
    const user = await requestProfileJson<GitHubUser>(USER_URL, headers);

    // /user reports the *public* profile email, with no way to tell whether GitHub verified it, so the
    // verified primary address from /user/emails is the only one we may match an account on. An unverified
    // address is still reported (never matched on): it lets the flow say "verify it at GitHub" rather than
    // "we got no email from GitHub".
    const emails = await requestProfileJson<GitHubEmail[]>(EMAILS_URL, headers);
    const verified = emails.find(entry => entry.primary && entry.verified) ?? emails.find(entry => entry.verified);
    // .at() rather than [0]: an account can have no addresses at all, which indexing does not express here.
    const address = verified ?? emails.find(entry => entry.primary) ?? emails.at(0);

    return {
      id: String(user.id),
      email: address?.email ?? user.email ?? '',
      emailVerified: verified !== undefined,
      username: user.name ?? user.login
    };
  }
});
