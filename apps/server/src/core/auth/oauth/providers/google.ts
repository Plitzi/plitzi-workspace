import { requestProfileJson } from '../client';

import type { OAuthProfile, OAuthProvider, OAuthProviderConfig } from '../types';

const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export const createGoogleProvider = (config: OAuthProviderConfig): OAuthProvider => ({
  id: 'google',
  label: 'Google',
  config,
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: 'openid email profile',
  usePkce: true,
  // No access_type=offline: we never call Google on the user's behalf, so a stored refresh token would be a
  // credential with no purpose. select_account keeps the chooser for people with several Google accounts.
  authorizationParams: { prompt: 'select_account' },

  // Google states the audience of an access token, which is what turns "a valid Google token" into "a token issued
  // to us". A token minted for any other site would name that site's client id here and is refused.
  async verifyAudience(accessToken: string): Promise<boolean> {
    const response = await fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
    if (!response.ok) {
      return false;
    }

    const info = (await response.json()) as { aud?: string };

    return info.aud === config.clientId;
  },

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const profile = await requestProfileJson<GoogleUserInfo>(USERINFO_URL, {
      Authorization: `Bearer ${accessToken}`
    });

    return {
      id: profile.sub,
      email: profile.email ?? '',
      emailVerified: profile.email_verified === true,
      username: profile.name ?? ''
    };
  }
});
