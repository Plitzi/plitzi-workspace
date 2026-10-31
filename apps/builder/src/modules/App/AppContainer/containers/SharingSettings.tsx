import Input from '@plitzi/plitzi-ui/Input';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, use, useState } from 'react';

import { EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { spaceIdentity, spaceIdentityProblems } from '@plitzi/sdk-shared/schema';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import Notice from '@pmodules/App/components/Notice';

import ViewPage from '../../components/ViewPage';
import ViewSection from '../../components/ViewSection';

import type { SpaceIdentity } from '@plitzi/sdk-shared/schema';

/** The identity settings edited as one line of text each. */
type TextSetting = 'siteName' | 'language' | 'favicon' | 'shareImage';

/**
 * Who the site is where a link to it shows — its name, its language, its tab's icon, the picture a link shows when a
 * page names none, the colour a phone paints around it — and what search engines may crawl (`robots.txt`). Held as it
 * is typed to what a head reads (`spaceIdentityProblems`), the same check authoring refuses on; a page's own title,
 * description and picture are the page's (its settings → SEO).
 */
const SharingSettings = () => {
  const [[settings]] = useBuilderStore(['schema.settings']);
  const { eventBridge } = use(EventBridgeContext);
  const [identity, setIdentity] = useState<SpaceIdentity>(() => spaceIdentity(settings));
  const [robotsTxt, setRobotsTxt] = useState(settings.robotsTxt ?? '');
  const light =
    typeof identity.themeColor === 'object' ? (identity.themeColor.light ?? '') : (identity.themeColor ?? '');
  const dark = typeof identity.themeColor === 'object' ? (identity.themeColor.dark ?? '') : '';
  const problems = spaceIdentityProblems(identity);

  const save = useCallback(
    (name: string, value: unknown) => {
      void eventBridge.emit('main', 'schemaUpdateSettings', value, name);
    },
    [eventBridge]
  );

  // An emptied field is a setting left out — the default — never an empty value the head would write.
  const handleText = useCallback(
    (name: TextSetting) => (value: string) => {
      const next = value === '' ? undefined : value;
      setIdentity(state => {
        const { [name]: _dropped, ...rest } = state;

        return next === undefined ? rest : { ...rest, [name]: next };
      });
      save(name, next);
    },
    [save]
  );

  const handleColour = useCallback(
    (scheme: 'light' | 'dark') => (value: string) => {
      const colours = { light, dark, [scheme]: value };
      const next =
        colours.light === '' && colours.dark === ''
          ? undefined
          : colours.dark === ''
            ? colours.light
            : { ...(colours.light ? { light: colours.light } : {}), dark: colours.dark };
      setIdentity(state => {
        const { themeColor: _dropped, ...rest } = state;

        return next === undefined ? rest : { ...rest, themeColor: next };
      });
      save('themeColor', next);
    },
    [light, dark, save]
  );

  const handleRobots = useCallback(
    (value: string) => {
      setRobotsTxt(value);
      save('robotsTxt', value === '' ? undefined : value);
    },
    [save]
  );

  return (
    <ViewPage className="gap-8">
      <ViewSection title="Where a link to the site shows">
        <Input
          size="sm"
          name="siteName"
          label="Site name"
          placeholder="My site"
          value={identity.siteName ?? ''}
          onChange={handleText('siteName')}
        />
        <Input
          size="sm"
          name="language"
          label="Language"
          placeholder="en, es, es-MX"
          value={identity.language ?? ''}
          onChange={handleText('language')}
        />
        <Input
          size="sm"
          name="shareImage"
          label="Share image"
          placeholder="/og.png (in public/) or https://… — about 1200×630"
          value={identity.shareImage ?? ''}
          onChange={handleText('shareImage')}
        />
        <Notice tone="info">
          The picture a link shows when its page names none. Each page sets its own in its settings, under SEO.
        </Notice>
      </ViewSection>
      <ViewSection title="The browser around it">
        <Input
          size="sm"
          name="favicon"
          label="Icon"
          placeholder="/favicon.svg — Plitzi's when left out"
          value={identity.favicon ?? ''}
          onChange={handleText('favicon')}
        />
        <Input
          size="sm"
          name="themeColorLight"
          label="Theme colour"
          placeholder="#fbf7f0"
          value={light}
          onChange={handleColour('light')}
        />
        <Input
          size="sm"
          name="themeColorDark"
          label="Theme colour, dark scheme"
          placeholder="#0b0a10 — the one above for both when left out"
          value={dark}
          onChange={handleColour('dark')}
        />
      </ViewSection>
      {problems.length > 0 && (
        <Notice tone="caution">
          <ul className="flex flex-col gap-1">
            {problems.map(problem => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Notice>
      )}
      <ViewSection title="Search engines">
        <TextArea
          size="sm"
          name="robotsTxt"
          label="robots.txt"
          placeholder={'User-agent: *\nAllow: /'}
          rows={5}
          value={robotsTxt}
          onChange={handleRobots}
        />
        <Notice tone="info">
          Left empty, crawlers may read every page. A page kept out of search says so itself, with its robots under SEO.
        </Notice>
      </ViewSection>
    </ViewPage>
  );
};

export default SharingSettings;
