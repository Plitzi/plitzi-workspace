import type { Asset, ManifestAsset } from '@plitzi/sdk-shared';

const manifestAssetToAsset = (baseSrc: string, { src, type, isMain }: ManifestAsset, settingsAsset = false): Asset => {
  const url = `${baseSrc}/${src}`;
  const urlEncoded = btoa(url);
  let asset: Asset | undefined = undefined;
  if (type === 'style' && url.endsWith('.css')) {
    asset = {
      type: 'link',
      id: urlEncoded,
      params: { href: url, rel: 'stylesheet', type: 'text/css' },
      isMain
    } satisfies Asset;
  } else {
    asset = { type: 'script', id: urlEncoded, params: { src: url, type: 'text/javascript' }, isMain } satisfies Asset;
  }

  if (settingsAsset) {
    delete asset.isMain;
  }

  return asset;
};

export default manifestAssetToAsset;
