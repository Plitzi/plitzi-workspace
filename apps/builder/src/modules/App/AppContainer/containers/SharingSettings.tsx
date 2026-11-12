import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, use, useState } from 'react';

import { EventBridgeContext } from '@plitzi/sdk-event-bridge';
import {
  AI_CRAWLER_KIND_LABEL,
  AI_CRAWLER_KINDS,
  AI_CRAWLERS,
  DEFAULT_FAVICON,
  isAiCrawlerKind,
  spaceIdentity,
  spaceIdentityProblems
} from '@plitzi/sdk-shared/schema';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import Notice from '@pmodules/App/components/Notice';

import ViewPage from '../../components/ViewPage';
import ViewSection from '../../components/ViewSection';

import type { AiCrawlerKind, SpaceIdentity } from '@plitzi/sdk-shared/schema';
import type { ChangeEvent } from 'react';

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
  const [securityTxt, setSecurityTxt] = useState(settings.securityTxt ?? '');
  const [llmsTxt, setLlmsTxt] = useState(settings.llmsTxt ?? '');
  const [blockAiCrawlers, setBlockAiCrawlers] = useState<AiCrawlerKind[]>(() =>
    Array.isArray(settings.blockAiCrawlers) ? settings.blockAiCrawlers.filter(isAiCrawlerKind) : []
  );
  const light =
    typeof identity.themeColor === 'object' ? (identity.themeColor.light ?? '') : (identity.themeColor ?? '');
  const dark = typeof identity.themeColor === 'object' ? (identity.themeColor.dark ?? '') : '';
  const problems = spaceIdentityProblems(identity);
  // What the tab shows, drawn here when this page can reach it: an address, or Plitzi's own (served by every page
  // server, this one's included). A file of the site (`/assets/favicon.svg`) is the site's, on another host.
  const iconShown = identity.favicon ?? DEFAULT_FAVICON;
  const showsIcon = identity.favicon === undefined || /^https?:\/\//.test(identity.favicon);

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

  const handleSecurity = useCallback(
    (value: string) => {
      setSecurityTxt(value);
      save('securityTxt', value === '' ? undefined : value);
    },
    [save]
  );

  const handleLlms = useCallback(
    (value: string) => {
      setLlmsTxt(value);
      save('llmsTxt', value === '' ? undefined : value);
    },
    [save]
  );

  // Each kind its owner's to decide (D10). None kept out is the setting left out, never an empty list carried for nothing.
  const handleAiCrawlers = useCallback(
    (kind: AiCrawlerKind) => (event: ChangeEvent<HTMLInputElement>) => {
      const next = AI_CRAWLER_KINDS.filter(each =>
        each === kind ? event.target.checked : blockAiCrawlers.includes(each)
      );
      setBlockAiCrawlers(next);
      save('blockAiCrawlers', next.length > 0 ? next : undefined);
    },
    [blockAiCrawlers, save]
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
          placeholder="https://… — Plitzi's when left out"
          value={identity.favicon ?? ''}
          onChange={handleText('favicon')}
        />
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
          {showsIcon && <img src={iconShown} alt="" width={16} height={16} className="size-4 shrink-0" />}
          <span>
            {identity.favicon === undefined
              ? "The tab shows Plitzi's icon. Name an address here — a file on your CDN — or, in a project, keep a favicon.svg, .png or .ico in public/assets/: it is found by its name."
              : showsIcon
                ? 'The tab shows this icon.'
                : `The tab shows ${identity.favicon}, a file of the site: it is drawn on the site, not here.`}
          </span>
        </div>
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
        {AI_CRAWLER_KINDS.map(kind => (
          <Checkbox
            key={kind}
            size="sm"
            name={`blockAiCrawlers-${kind}`}
            type="checkbox"
            checked={blockAiCrawlers.includes(kind)}
            onChange={handleAiCrawlers(kind)}
            label={`Keep out: ${AI_CRAWLER_KIND_LABEL[kind].toLowerCase()} (${AI_CRAWLERS[kind].slice(0, 3).join(', ')}…)`}
          />
        ))}
        <TextArea
          size="sm"
          name="securityTxt"
          label="security.txt"
          placeholder={'Contact: mailto:security@example.com\nExpires: 2027-12-31T23:00:00.000Z'}
          rows={3}
          value={securityTxt}
          onChange={handleSecurity}
        />
        <TextArea
          size="sm"
          name="llmsTxt"
          label="llms.txt"
          placeholder={'# Your site\n\n> What it is, in a sentence.\n\n## Pages\n\n- [Home](https://example.com/): …'}
          rows={4}
          value={llmsTxt}
          onChange={handleLlms}
        />
        <Notice tone="info">
          Search engines keep reading whatever is ticked here. Left empty, crawlers may read every page. A page kept out
          of search says so itself, with its robots under SEO. The site answers /sitemap.xml with its public pages — the
          map of pages marks the ones left out — and robots.txt names it. security.txt is where whoever finds a flaw in
          the site writes to you, served at /.well-known/security.txt; left empty, that address answers that the site
          publishes none. llms.txt is the index an assistant reads to find its way around: left empty, the site writes
          one from its public pages — each one's SEO title and description — and with assistants kept out it publishes
          none.
        </Notice>
      </ViewSection>
    </ViewPage>
  );
};

export default SharingSettings;
