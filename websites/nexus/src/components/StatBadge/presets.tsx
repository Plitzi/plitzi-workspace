import StatBadge from './StatBadge';
import { GITHUB_STARS_API, GITHUB_URL, NPM_DOWNLOADS_API, NPM_URL } from '../../content';

const extractStars = (data: unknown): number | undefined => {
  if (typeof data === 'object' && data !== null && 'stargazers_count' in data) {
    const value = (data as { stargazers_count: unknown }).stargazers_count;

    return typeof value === 'number' ? value : undefined;
  }

  return undefined;
};

const extractDownloads = (data: unknown): number | undefined => {
  if (typeof data === 'object' && data !== null && 'downloads' in data) {
    const value = (data as { downloads: unknown }).downloads;

    return typeof value === 'number' ? value : undefined;
  }

  return undefined;
};

const StarIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.784 1.401 8.168L12 18.896l-7.335 3.86 1.401-8.168L.132 9.211l8.2-1.193z" />
  </svg>
);

const DownloadIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M12 3v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 19h16" strokeLinecap="round" />
  </svg>
);

export const GithubStars = () => (
  <StatBadge
    cacheKey="nexus.stars"
    url={GITHUB_STARS_API}
    extract={extractStars}
    label="stars"
    href={GITHUB_URL}
    icon={StarIcon}
  />
);

export const NpmDownloads = () => (
  <StatBadge
    cacheKey="nexus.downloads"
    url={NPM_DOWNLOADS_API}
    extract={extractDownloads}
    label="downloads / mo"
    href={NPM_URL}
    icon={DownloadIcon}
  />
);
