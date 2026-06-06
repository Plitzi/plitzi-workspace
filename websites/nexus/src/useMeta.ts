import { useEffect } from 'react';

export type PageMeta = {
  title: string;
  description: string;
  image?: string;
};

const SITE = 'https://plitzi.github.io/plitzi-workspace';
const DEFAULT_IMAGE = `${SITE}/og.svg`;

const setMeta = (name: string, content: string) => {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"], meta[property="${name}"]`);
  if (el) {
    el.content = content;
  }
};

const useMeta = (meta: PageMeta) => {
  useEffect(() => {
    const title = `${meta.title} — @plitzi/nexus`;
    const image = meta.image ?? DEFAULT_IMAGE;

    document.title = title;

    setMeta('description', meta.description);
    setMeta('og:title', title);
    setMeta('og:description', meta.description);
    setMeta('og:image', image);
    setMeta('twitter:title', title);
    setMeta('twitter:description', meta.description);
    setMeta('twitter:image', image);
  }, [meta.title, meta.description, meta.image]);
};

export default useMeta;
